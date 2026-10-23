import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { createExportService } from './server.mjs';
import { createCapacity } from './capacity.mjs';
import { createRows } from './rows.mjs';

async function until(predicate) {
  for (let n = 0; n < 400; n += 1) {
    if (predicate()) return;
    await pause(5);
  }
  assert.fail('condition was not reached in 2 seconds');
}
async function service(run, options = {}) {
  const app = createExportService(options);
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try { await run(app, base); }
  finally { await app.close({ graceMs: 0 }); await until(() => app.snapshot().active === 0); }
}

test('lease has no waiting queue and release is idempotent', () => {
  const capacity = createCapacity(1);
  const release = capacity.tryAcquire();
  assert.equal(capacity.active, 1);
  assert.equal(capacity.tryAcquire(), null);
  release(); release();
  assert.equal(capacity.active, 0);
  assert.equal(typeof capacity.tryAcquire(), 'function');
  assert.throws(() => createCapacity(0), RangeError);
});

test('normal HTTP export returns exact ordered rows and releases lease', async () => service(async (app, base) => {
  const response = await fetch(`${base}/export?rows=3&delay=0`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/csv/);
  const text = await response.text();
  assert.equal(text, 'id,payload\n' + [1, 2, 3].map(id => `${id},${'x'.repeat(1024)}\n`).join(''));
  await until(() => app.snapshot().completed === 1);
  assert.equal(app.snapshot().active, 0);
}));

test('bad inputs fail before occupying export capacity', async () => service(async (app, base) => {
  for (const query of ['rows=0', 'rows=10001', 'rows=1.2', 'rows=3&rows=4', 'delay=51', 'unknown=1', 'failAt=1']) {
    const response = await fetch(`${base}/export?${query}`);
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).error, 'INVALID_QUERY');
    assert.equal(app.snapshot().active, 0);
  }
  assert.equal((await fetch(`${base}/export`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/missing`)).status, 404);
}));

test('saturated service immediately rejects another export but health still responds', async () => service(async (app, base) => {
  const first = await fetch(`${base}/export?rows=100&delay=30`);
  assert.equal(app.snapshot().active, 1);
  const rejected = await fetch(`${base}/export?rows=1`);
  assert.equal(rejected.status, 503);
  assert.equal(rejected.headers.get('retry-after'), '1');
  assert.equal((await rejected.json()).error, 'EXPORT_BUSY');
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).active, 1);
  await first.body.cancel();
  await until(() => app.snapshot().active === 0);
  assert.equal(app.snapshot().rejected, 1);
}, { maxActive: 1, deadlineMs: 5000 }));

test('client cancellation stops generation, clears capacity and allows recovery', async () => service(async (app, base) => {
  const first = await fetch(`${base}/export?rows=100&delay=20`);
  await until(() => app.snapshot().generatedRows >= 1);
  await first.body.cancel();
  await until(() => app.snapshot().active === 0);
  const generated = app.snapshot().generatedRows;
  assert.ok(generated < 100);
  await pause(50);
  assert.equal(app.snapshot().generatedRows, generated);
  assert.equal(app.snapshot().cancelled, 1);
  const response = await fetch(`${base}/export?rows=1&delay=0`);
  assert.equal(response.status, 200);
  await response.text();
}, { deadlineMs: 5000 }));

test('deadline interrupts an already started body and releases capacity', async () => service(async (app, base) => {
  const response = await fetch(`${base}/export?rows=100&delay=20`);
  assert.equal(response.status, 200);
  await assert.rejects(response.text());
  await until(() => app.snapshot().active === 0);
  assert.equal(app.snapshot().timedOut, 1);
  assert.equal(app.snapshot().completed, 0);
}, { deadlineMs: 50 }));

test('source failure cannot change sent 200 to JSON; connection is terminated and slot recovered', async () => service(async (app, base) => {
  const response = await fetch(`${base}/export?rows=5&delay=10&failAt=3`);
  assert.equal(response.status, 200);
  await assert.rejects(response.text());
  await until(() => app.snapshot().active === 0);
  assert.equal(app.snapshot().failed, 1);
  const recovered = await fetch(`${base}/export?rows=1&delay=0`);
  assert.equal(recovered.status, 200);
  await recovered.text();
}, { enableFaults: true }));

test('the real row source honors pipeline backpressure with a deliberately slow Writable', async () => {
  let produced = 0, consumed = 0, ahead = 0;
  const source = createRows({ count: 30, delayMs: 0, highWaterMark: 1024, onRow: () => { produced += 1; ahead = Math.max(ahead, produced - consumed); } });
  const destination = new Writable({
    highWaterMark: 1,
    write(chunk, encoding, callback) {
      setTimeout(() => { if (chunk.toString() !== 'id,payload\n') consumed += 1; callback(); }, 3);
    },
  });
  await pipeline(source, destination);
  assert.equal(produced, 30);
  assert.equal(consumed, 30);
  assert.ok(ahead <= 3, `producer ran ahead by ${ahead} rows`);
});

test('shutdown gives an in-flight export a bounded grace period, then aborts it', async () => service(async (app, base) => {
  const response = await fetch(`${base}/export?rows=100&delay=30`);
  const body = response.text();
  const rejected = assert.rejects(body);
  await app.close({ graceMs: 20 });
  await rejected;
  await until(() => app.snapshot().active === 0);
  assert.equal(app.snapshot().closing, true);
  assert.equal(app.snapshot().cancelled, 1);
}, { deadlineMs: 5000 }));

test('article contains the full published implementation rather than linking away', async t => {
  const { readFile } = await import('node:fs/promises');
  const path = '../../src/data/articles/legacy/node-capacity.ts';
  let source;
  try { source = await readFile(path, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    t.skip('standalone example archive does not include site article');
    return;
  }
  const data = JSON.parse(source.slice(source.indexOf('= {') + 2, source.lastIndexOf(';\nexport default')));
  const blocks = data.sections.flatMap(section => section.blocks ?? []);
  for (const file of ['capacity.mjs', 'rows.mjs', 'event-loop.mjs', 'backpressure.mjs', 'server.mjs']) {
    const displayed = blocks.filter(block => block.type === 'code' && block.filename?.startsWith(file + ' ·')).map(block => block.code).join('\n');
    assert.equal(displayed, (await readFile(file, 'utf8')).trimEnd(), file);
  }
});
