import Fastify from 'fastify';
import { parseInput, parseAnswer, ServiceError } from './contracts.js';
import { loadConfig, type Provider } from './providers.js';
export function buildApp(options?: { provider: Provider; timeoutMs?: number }) {
  const config = options ?? loadConfig();
  const timeoutMs = config.timeoutMs ?? 3000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 60000) throw new Error('Invalid timeoutMs');
  const app = Fastify({ bodyLimit: 256 * 1024, logger: false });
  app.setErrorHandler((error, _request, reply) => {
    const err = error as Error & { code?: string };
    const known = error instanceof ServiceError ? error : err.code === 'FST_ERR_CTP_BODY_TOO_LARGE'
      ? new ServiceError(413, 'PAYLOAD_TOO_LARGE', '请求正文超过 256 KiB。')
      : ['FST_ERR_CTP_INVALID_JSON_BODY', 'FST_ERR_CTP_EMPTY_JSON_BODY', 'FST_ERR_CTP_INVALID_MEDIA_TYPE', 'FST_ERR_CTP_INVALID_CONTENT_LENGTH'].includes(err.code ?? '')
        ? new ServiceError(400, 'INVALID_REQUEST', '请求必须是合法 application/json。')
        : new ServiceError(500, 'INTERNAL_ERROR', '服务内部错误。');
    reply.code(known.status).send({ ok: false, error: { code: known.code, message: known.message } });
  });
  app.get('/health', async () => ({ status: 'ok' }));
  app.post('/v1/answers', async request => {
    const input = parseInput(request.body);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ServiceError(504, 'UPSTREAM_TIMEOUT', '上游调用超时。'));
      }, timeoutMs);
    });
    let raw: string;
    try { raw = await Promise.race([config.provider(input, controller.signal), deadline]); }
    catch (error) {
      if (controller.signal.aborted) throw new ServiceError(504, 'UPSTREAM_TIMEOUT', '上游调用超时。');
      throw error instanceof ServiceError ? error : new ServiceError(502, 'UPSTREAM_ERROR', '上游服务暂时不可用。');
    } finally { clearTimeout(timer!); }
    return { ok: true, result: parseAnswer(raw, input) };
  });
  return app;
}
