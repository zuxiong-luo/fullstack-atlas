from fastapi import FastAPI

app = FastAPI()


def health():
    return {"ok": True}


register = app.get("/health")
health = register(health)
print(health())
print(any(route.path == "/health" for route in app.routes))
