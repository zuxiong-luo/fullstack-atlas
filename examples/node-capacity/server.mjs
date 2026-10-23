import { createServer } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { createCapacity } from './capacity.mjs';
import { createRows } from './rows.mjs';

function integer(params, key, fallback, min, max) {
  if (!params.has(key)) return fallback;
  const raw = params.get(key);
  if (params.getAll(key).length !== 1 || !/^\d+$/.test(raw)) throw new Error(`invalid ${key}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`invalid ${key}`);
  return value;
}
function json(response, status, value, extra = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extra });
  response.end(JSON.stringify(value));
}

export function createExportService({ maxActive = 2, deadlineMs = 1000, enableFaults = false } = {}) {
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1) throw new RangeError('invalid deadlineMs');
  const capacity = createCapacity(maxActive);
  const controllers = new Set();
  const stats = { completed: 0, rejected: 0, cancelled: 0, timedOut: 0, failed: 0, generatedRows: 0 };
  const lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  let closing = false;
  let closePromise;
  const snapshot = () => ({
    ...stats, active: capacity.active, maxActive, closing,
    rssBytes: process.memoryUsage().rss,
    eventLoopDelayMs: lag.count > 0 ? { mean: lag.mean / 1e6, p99: lag.percentile(99) / 1e6 } : null,
  });

  async function handle(request, response) {
    if (request.method !== 'GET') return json(response, 405, { error: 'METHOD_NOT_ALLOWED' }, { allow: 'GET' });
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/health') return json(response, closing ? 503 : 200, snapshot());
    if (url.pathname !== '/export') return json(response, 404, { error: 'NOT_FOUND' });
    if (closing) return json(response, 503, { error: 'SHUTTING_DOWN' });
    let count, delayMs, failAt;
    try {
      for (const key of url.searchParams.keys()) {
        if (!['rows', 'delay', 'failAt'].includes(key)) throw new Error('unknown query');
      }
      count = integer(url.searchParams, 'rows', 100, 1, 10000);
      delayMs = integer(url.searchParams, 'delay', 1, 0, 50);
      failAt = integer(url.searchParams, 'failAt', 0, 0, count);
      if (failAt > 0 && !enableFaults) throw new Error('fault injection disabled');
    } catch {
      return json(response, 400, { error: 'INVALID_QUERY' });
    }
    const release = capacity.tryAcquire();
    if (!release) {
      stats.rejected += 1;
      return json(response, 503, { error: 'EXPORT_BUSY' }, { 'retry-after': '1' });
    }
    const controller = new AbortController();
    controllers.add(controller);
    let timedOut = false;
    let sourceFailed = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('EXPORT_DEADLINE'));
    }, deadlineMs);
    const onClose = () => {
      if (!response.writableFinished) controller.abort(new Error('CLIENT_CLOSED'));
    };
    response.on('close', onClose);
    try {
      response.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="tasks.csv"' });
      response.flushHeaders();
      const source = createRows({ count, delayMs, failAt, signal: controller.signal, onRow: () => { stats.generatedRows += 1; } });
      source.once('error', error => { if (error.name !== 'AbortError') sourceFailed = true; });
      await pipeline(source, response, { signal: controller.signal });
      stats.completed += 1;
    } catch {
      if (timedOut) stats.timedOut += 1;
      else if (sourceFailed) stats.failed += 1;
      else if (controller.signal.aborted) stats.cancelled += 1;
      else stats.failed += 1;
      // Headers may already be on the wire. Terminate instead of appending JSON to CSV.
      if (!response.destroyed) response.destroy();
    } finally {
      clearTimeout(timer);
      response.off('close', onClose);
      controllers.delete(controller);
      release();
    }
  }
  const server = createServer((request, response) => {
    handle(request, response).catch(() => {
      // Protect the process from unexpected handler errors outside the export try block.
      if (!response.headersSent) json(response, 500, { error: 'INTERNAL_ERROR' });
      else response.destroy();
    });
  });
  async function close({ graceMs = 1000 } = {}) {
    if (!Number.isSafeInteger(graceMs) || graceMs < 0) throw new RangeError('invalid graceMs');
    if (closePromise) return closePromise;
    closing = true;
    closePromise = new Promise((resolve, reject) => {
      const force = setTimeout(() => {
        for (const controller of controllers) controller.abort(new Error('SERVER_SHUTDOWN'));
        server.closeAllConnections();
      }, graceMs);
      server.close(error => {
        clearTimeout(force);
        lag.disable();
        if (error) reject(error); else resolve();
      });
    });
    return closePromise;
  }
  return { server, snapshot, close };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const service = createExportService({ enableFaults: process.env.EXPORT_FAULTS === '1' });
  service.server.listen(4310, '127.0.0.1', () => console.log('http://127.0.0.1:4310 — maxActive=2, deadlineMs=1000'));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      service.close().then(() => console.log('closed', service.snapshot())).catch(error => { console.error(error); process.exitCode = 1; });
    });
  }
}
