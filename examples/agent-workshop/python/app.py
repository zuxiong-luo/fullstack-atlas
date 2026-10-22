"""Run: python -m uvicorn app:create_app --factory --host 127.0.0.1 --port 8000"""
import asyncio
import json
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from models import AnswerRequest, ModelAnswer
from providers import HTTPProvider, MockProvider, Provider, ServiceError, Settings, upstream_error, strict_json

MAX_REQUEST_BYTES = 256 * 1024

def error_response(error: ServiceError):
    return JSONResponse(status_code=error.status, content={'ok': False, 'error': {'code': error.code, 'message': error.message}})

def create_app(provider: Provider | None = None, settings: Settings | None = None):
    config = settings or Settings.from_env()
    model = provider if provider is not None else (MockProvider(config.scenario) if config.provider == 'mock' else HTTPProvider(config))
    app = FastAPI(title='Agent workshop — chapter 01', version='chapter-01-v1')

    @app.get('/health')
    async def health():
        return {'status': 'ok'}

    @app.post('/v1/answers')
    async def answer(request: Request):
        try:
            if request.headers.get('content-type', '').split(';', 1)[0].strip().lower() != 'application/json':
                raise ServiceError(400, 'INVALID_REQUEST', '请求必须使用 application/json')
            # Count actual received bytes rather than trusting Content-Length.
            body = bytearray()
            async for chunk in request.stream():
                if len(body) + len(chunk) > MAX_REQUEST_BYTES:
                    raise ServiceError(413, 'PAYLOAD_TOO_LARGE', '请求体超过 256 KiB')
                body.extend(chunk)
            try:
                incoming = AnswerRequest.model_validate(strict_json(body))
            except (ValueError, UnicodeError):
                raise ServiceError(400, 'INVALID_REQUEST', '请求不符合输入契约')
            try:
                # This is a total deadline, so a slow trickle cannot reset the budget.
                async with asyncio.timeout(config.timeout_ms / 1000):
                    raw = await model.generate(incoming)
            except TimeoutError:
                raise ServiceError(504, 'UPSTREAM_TIMEOUT', '模型服务超时')
            except ServiceError:
                raise
            except Exception:
                raise upstream_error()
            try:
                decoded = strict_json(raw)
            except (ValueError, TypeError):
                raise ServiceError(502, 'MODEL_FORMAT_ERROR', '模型输出不是有效 JSON')
            try:
                result = ModelAnswer.model_validate(decoded)
            except ValidationError:
                raise ServiceError(502, 'MODEL_SCHEMA_ERROR', '模型输出不符合结果契约')
            supplied = {doc.id for doc in incoming.documents}
            if not set(result.citations) <= supplied:
                raise ServiceError(502, 'UNSUPPORTED_CITATION', '模型引用了未提供的资料')
            return {'ok': True, 'result': result.model_dump()}
        except ServiceError as exc:
            return error_response(exc)
        except Exception:
            return error_response(ServiceError(500, 'INTERNAL_ERROR', '服务处理失败'))

    return app
