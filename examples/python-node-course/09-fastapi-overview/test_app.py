import json
from pathlib import Path
import unittest
from fastapi.testclient import TestClient
from api import get_pricing_service
from main import create_app
from schemas import QuoteInput
from service import HdDurationExceeded, PricingService

CASES = json.loads((Path(__file__).parents[1] / "shared/quotes.json").read_text())


class ApiTests(unittest.TestCase):
    def test_shared_cases_and_response_projection(self):
        with TestClient(create_app()) as client:
            for case in CASES:
                with self.subTest(case=case["name"]):
                    raw = case.get("raw", json.dumps(case.get("body")))
                    response = client.post("/api/quotes", content=raw, headers={"Content-Type": "application/json"})
                    self.assertEqual(response.status_code, case["status"])
                    self.assertEqual(response.headers["X-Demo-Framework"], "fastapi")
                    if "expected" in case:
                        self.assertEqual(response.json(), case["expected"])
                    self.assertNotIn("internal_rule", response.json())

    def test_health_and_openapi(self):
        with TestClient(create_app()) as client:
            self.assertEqual(client.get("/health").json(), {"ok": True})
            spec = client.get("/openapi.json").json()
            operation = spec["paths"]["/api/quotes"]["post"]
            self.assertIn("200", operation["responses"])
            self.assertIn("422", operation["responses"])
            self.assertEqual(spec["components"]["schemas"]["QuoteInput"]["additionalProperties"], False)
            self.assertEqual(client.get("/docs").status_code, 200)
            self.assertNotIn("409", operation["responses"])

    def test_lifespan_uses_an_explicit_app_instance(self):
        first, second = create_app(), create_app()
        with TestClient(first) as client:
            service = first.state.pricing
            client.post("/api/quotes", json={"seconds": 1})
            self.assertIs(first.state.pricing, service)
            with TestClient(second):
                self.assertIsNot(second.state.pricing, service)
        self.assertIsNone(first.state.pricing)
        self.assertIsNone(second.state.pricing)

    def test_invalid_body_does_not_run_business_method(self):
        class Spy:
            def __init__(self): self.calls = 0
            def quote(self, seconds, quality):
                self.calls += 1
                return {"seconds": seconds, "quality": quality, "credits": 99}
        spy = Spy()
        app = create_app()
        app.dependency_overrides[get_pricing_service] = lambda: spy
        with TestClient(app) as client:
            self.assertEqual(client.post("/api/quotes", json={"seconds": "30"}).status_code, 422)
            self.assertEqual(spy.calls, 0)
            result = client.post("/api/quotes", json={"seconds": 30})
            self.assertEqual(result.json()["credits"], 99)
            self.assertEqual(spy.calls, 1)

    def test_dependency_may_execute_before_body_validation_finishes(self):
        calls = []
        app = create_app()
        def replacement():
            calls.append("dependency")
            return PricingService()
        app.dependency_overrides[get_pricing_service] = replacement
        with TestClient(app) as client:
            self.assertEqual(client.post("/api/quotes", json={"seconds": "30"}).status_code, 422)
        self.assertEqual(calls, ["dependency"])

    def test_plain_annotations_do_not_apply_input_validation(self):
        def typed(seconds: int): return seconds
        self.assertEqual(typed("30"), "30")
        with self.assertRaises(ValueError): QuoteInput(seconds="30")
        with self.assertRaises(HdDurationExceeded): PricingService().quote(61, "hd")

    def test_response_model_validates_server_output(self):
        class Broken:
            def quote(self, seconds, quality): return {"credits": "invalid"}
        app = create_app()
        app.dependency_overrides[get_pricing_service] = lambda: Broken()
        with TestClient(app, raise_server_exceptions=False) as client:
            self.assertEqual(client.post("/api/quotes", json={"seconds": 30}).status_code, 500)


if __name__ == "__main__":
    unittest.main()
