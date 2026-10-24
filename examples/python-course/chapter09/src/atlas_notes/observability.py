import json
import logging
import time
from uuid import uuid4
from starlette.types import ASGIApp, Receive, Scope, Send

LOGGER = logging.getLogger("atlas.notes")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({"level": record.levelname, **getattr(record, "atlas", {})},
                          ensure_ascii=False, separators=(",", ":"))


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    LOGGER.handlers[:] = [handler]
    LOGGER.setLevel(logging.INFO)
    LOGGER.propagate = False


def event(name: str, **fields: object) -> None:
    LOGGER.info(name, extra={"atlas": {"event": name, **fields}})


class RequestLog:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id, started, status = uuid4().hex, time.perf_counter(), 500

        async def observed(message: dict) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message = dict(message, headers=[*message.get("headers", []),
                                                (b"x-request-id", request_id.encode())])
            await send(message)

        try:
            await self.app(scope, receive, observed)
        finally:
            route = getattr(scope.get("route"), "path", "unmatched")
            event("request", request_id=request_id, method=scope["method"], route=route,
                  status=status, elapsed_ms=round((time.perf_counter() - started) * 1000, 3))
            # Deliberately exclude headers, token, query string, raw path and body.
