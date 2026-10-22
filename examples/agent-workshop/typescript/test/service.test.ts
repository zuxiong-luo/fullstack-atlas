import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer, type ServerResponse, type IncomingMessage } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { httpProvider, loadConfig, mockProvider, type Scenario } from '../src/providers.js';
const input = { question: '问题', documents: [{ id: 'guide', text: '正文' }] };
const cases = JSON.parse(await readFile(new URL('../../shared/cases.json', import.meta.url), 'utf8')) as { name: string; scenario: Scenario; request: object; status: number; code?: string; citations?: string[] }[];
for (const fixture of cases) test(`shared: ${fixture.name}`, async () => {
  const app = buildApp({ provider: mockProvider(fixture.scenario), timeoutMs: 50 });
  try {
    const res = await app.inject({ method: 'POST', url: '/v1/answers', payload: fixture.request });
    assert.equal(res.statusCode, fixture.status);
    if (fixture.code) assert.equal(res.json().error.code, fixture.code);
    else { assert.equal(res.json().ok, true); assert.deepEqual(res.json().result.citations, fixture.citations); }
  } finally { await app.close(); }
});
test('health, strict type validation, malformed JSON, payload size', async () => {
  const app = buildApp({ provider: mockProvider('success') });
  try {
    assert.deepEqual((await app.inject('/health')).json(), { status: 'ok' });
    for (const payload of [{ ...input, question: 123 }, { ...input, documents: [{id: 'a\n', text: 'text'}] }, { ...input, documents: [{ id: 'a', text: 'text', extra: true }] }, { ...input, question: '🙂'.repeat(2001) }]) {
      assert.equal((await app.inject({ method: 'POST', url: '/v1/answers', payload })).statusCode, 400);
    }
    const validUnicode = await app.inject({ method: 'POST', url: '/v1/answers', payload: { ...input, question: '🙂'.repeat(2000) } });
    assert.equal(validUnicode.statusCode, 200);
    const malformed = await app.inject({ method: 'POST', url: '/v1/answers', headers: { 'content-type': 'application/json' }, payload: '{' });
    assert.equal(malformed.json().error.code, 'INVALID_REQUEST');
    const huge = await app.inject({ method: 'POST', url: '/v1/answers', payload: { ...input, question: 'a'.repeat(256 * 1024) } });
    assert.equal(huge.statusCode, 413); assert.equal(huge.json().error.code, 'PAYLOAD_TOO_LARGE');
  } finally { await app.close(); }
});
test('model schema failures and unknown exceptions never expose upstream text', async () => {
  for (const output of [{ answer: 'ok', citations: ['guide', 'guide'] }, { answer: ' ', citations: ['guide'] }, { answer: 'ok', citations: ['guide\n'] }, { answer: 'ok', citations: ['guide'], secret: 'KEY' }]) {
    const app = buildApp({ provider: async () => JSON.stringify(output) });
    try {
      const res = await app.inject({ method: 'POST', url: '/v1/answers', payload: input });
      assert.equal(res.json().error.code, 'MODEL_SCHEMA_ERROR'); assert.ok(!res.body.includes('KEY'));
    } finally { await app.close(); }
  }
});
test('invalid startup configuration is rejected', () => {
  for (const env of [{ MODEL_PROVIDER: 'bad' }, { MOCK_SCENARIO: 'bad' }, { MODEL_TIMEOUT_MS: '0' }, { MODEL_TIMEOUT_MS: 'Infinity' }, { MODEL_PROVIDER: 'http', MODEL_API_URL: 'file:///secret' }]) assert.throws(() => loadConfig(env));
});
async function withUpstream(handler: (req: IncomingMessage, res: ServerResponse) => void, fn: (url: string) => Promise<void>) {
  const server = createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try { await fn(`http://127.0.0.1:${address.port}/v1/chat/completions`); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
async function callHttp(url: string, timeoutMs = 1000) {
  const app = buildApp({ provider: httpProvider({ url, key: 'test-key', model: 'local-fake' }), timeoutMs });
  try { return await app.inject({ method: 'POST', url: '/v1/answers', payload: input }); }
  finally { await app.close(); }
}
test('HTTP adapter decodes envelope and sends expected wire format', async () => {
  let captured: unknown; let auth: string | undefined;
  await withUpstream((req, res) => {
    auth = req.headers.authorization; let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { captured = JSON.parse(body); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: '根据资料', citations: ['guide'] }) } }] })); });
  }, async url => { assert.equal((await callHttp(url)).statusCode, 200); });
  assert.equal(auth, 'Bearer test-key');
  assert.deepEqual((captured as any).response_format, { type: 'json_object' });
  assert.deepEqual(JSON.parse((captured as any).messages[1].content), input);
});
test('HTTP failure, malformed envelope, response limit and redirect are classified', async () => {
  for (const handler of [
    (_req: IncomingMessage, res: ServerResponse) => { res.writeHead(503); res.end('SECRET'); },
    (_req: IncomingMessage, res: ServerResponse) => { res.end('{}'); },
    (_req: IncomingMessage, res: ServerResponse) => { res.end('{'); },
    (_req: IncomingMessage, res: ServerResponse) => { res.end('a'.repeat(1024 * 1024 + 1)); },
    (_req: IncomingMessage, res: ServerResponse) => { res.writeHead(302, { location: 'http://127.0.0.1:1/' }); res.end(); },
  ]) await withUpstream(handler, async url => {
    const res = await callHttp(url); assert.equal(res.statusCode, 502); assert.equal(res.json().error.code, 'UPSTREAM_ERROR'); assert.ok(!res.body.includes('SECRET'));
  });
});
test('deadline aborts a stalled response body at the transport', async () => {
  let disconnected!: () => void;
  const closed = new Promise<void>(resolve => { disconnected = resolve; });
  await withUpstream((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' }); res.write('{'); res.on('close', disconnected);
  }, async url => {
    const res = await callHttp(url, 50); assert.equal(res.statusCode, 504); assert.equal(res.json().error.code, 'UPSTREAM_TIMEOUT');
    await Promise.race([closed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('transport not aborted')), 1000); timer.unref(); })]);
  });
});
