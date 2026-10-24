import { createServer } from 'node:http';
import { setTimeout as pause } from 'node:timers/promises';

export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
// Event listeners keep body-limit errors separate from destroying the socket.
export function readBody(req, signal, limit) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks = [];
    const cleanup = () => {
      req.off('data', onData); req.off('end', onEnd);
      req.off('error', onError); req.off('close', onClose);
      signal.removeEventListener('abort', onAbort);
    };
    const fail = error => { cleanup(); reject(error); };
    const onData = chunk => {
      bytes += chunk.length;
      if (bytes > limit) {
        fail(new HttpError(413, 'BODY_TOO_LARGE'));
        req.resume(); // Discard remaining input; the response closes the connection.
      } else chunks.push(chunk);
    };
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')); };
    const onError = error => fail(error);
    const onClose = () => { if (!req.complete) fail(new HttpError(499, 'CLIENT_LEFT')); };
    const onAbort = () => { fail(signal.reason); req.resume(); };
    if (signal.aborted) { reject(signal.reason); return; }
    req.on('data', onData); req.once('end', onEnd);
    req.once('error', onError); req.once('close', onClose);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
export function parseInput(text) {
  let value;
  try { value = JSON.parse(text); } catch { throw new HttpError(400, 'BAD_JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      typeof value.title !== 'string' || value.title.trim().length < 1 || value.title.length > 80 ||
      !Number.isSafeInteger(value.delayMs) || value.delayMs < 0 || value.delayMs > 2000 ||
      Object.keys(value).some(key => !['title', 'delayMs'].includes(key))) {
    throw new HttpError(422, 'BAD_NOTE');
  }
  return { title: value.title.trim(), delayMs: value.delayMs };
}
function json(res, status, value) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Connection': 'close' });
  res.end(JSON.stringify(value));
}
export function createApp({ bodyLimit = 1024, budgetMs = 1000, maxActive = 4 } = {}) {
  for (const value of [bodyLimit, budgetMs, maxActive]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError('positive limits required');
  }
  const active = new Set();
  const stats = { completed: 0, cancelled: 0, timedOut: 0, rejected: 0 };
  let draining = false, closing;
  const server = createServer({ headersTimeout: 5000, requestTimeout: 10000, maxHeaderSize: 8192 }, (req, res) => {
    req.on('error', () => {}); // Observe late transport errors after body readers detach.
    void handle(req, res).catch(() => res.destroy());
  });
  async function handle(req, res) {
    if (draining) { json(res, 503, { error: 'DRAINING' }); return; }
    if (req.method !== 'POST' || req.url !== '/notes') { json(res, 404, { error: 'NOT_FOUND' }); return; }
    if (active.size >= maxActive) { json(res, 503, { error: 'BUSY' }); return; }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
      json(res, 415, { error: 'JSON_REQUIRED' }); return;
    }
    const controller = new AbortController();
    active.add(controller);
    const clientLeft = () => {
      if (!res.writableFinished) controller.abort(new HttpError(499, 'CLIENT_LEFT'));
    };
    res.once('close', clientLeft);
    const timer = setTimeout(() => controller.abort(new HttpError(408, 'REQUEST_BUDGET')), budgetMs);
    try {
      const input = parseInput(await readBody(req, controller.signal, bodyLimit));
      await pause(input.delayMs, undefined, { signal: controller.signal });
      controller.signal.throwIfAborted();
      json(res, 200, { title: input.title }); // No durable write: an acknowledgement demo.
      stats.completed += 1;
    } catch (error) {
      const cause = controller.signal.aborted ? controller.signal.reason : error;
      if (cause.code === 'CLIENT_LEFT') stats.cancelled += 1;
      else {
        if (cause.code === 'REQUEST_BUDGET') stats.timedOut += 1;
        else stats.rejected += 1;
        json(res, cause instanceof HttpError ? cause.status : 500, {
          error: cause instanceof HttpError ? cause.code : 'INTERNAL',
        });
      }
    } finally {
      clearTimeout(timer);
      res.off('close', clientLeft);
      active.delete(controller);
    }
  }
  return {
    server,
    get snapshot() { return { ...stats, active: active.size, draining }; },
    close(graceMs = 500) {
      if (closing) return closing;
      draining = true;
      closing = new Promise((resolve, reject) => {
        // Stop accepting before force-closing, avoiding an admission race.
        const deadline = setTimeout(() => {
          for (const controller of active) controller.abort(new HttpError(503, 'SHUTDOWN'));
          server.closeAllConnections();
        }, graceMs);
        server.close(error => {
          clearTimeout(deadline);
          if (error) reject(error); else resolve();
        });
      });
      return closing;
    },
  };
}
