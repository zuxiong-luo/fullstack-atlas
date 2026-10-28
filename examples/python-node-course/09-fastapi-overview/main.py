from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from api import router
from service import PricingService


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.pricing = PricingService()
        try:
            yield
        finally:
            app.state.pricing = None

    app = FastAPI(title="MV Quote Demo", lifespan=lifespan)

    @app.middleware("http")
    async def identify(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Demo-Framework"] = "fastapi"
        return response

    @app.get("/health")
    def health():
        return {"ok": True}

    app.include_router(router)
    return app


app = create_app()
