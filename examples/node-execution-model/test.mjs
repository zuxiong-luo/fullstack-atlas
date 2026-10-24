import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { experiment } from './main.mjs';
const run = file => execFileSync(process.execPath, [file], { cwd: import.meta.dirname, encoding: 'utf8', timeout: 3000 }).trim();

test('async CPU completes before the caller receives its Promise', async () => {
  assert.deepEqual(await experiment(), ['cpu:start','cpu:end:49995000','caller:promise','caller:awaited','file:notes','turn:resumed']);
});
test('CJS entry and ESM entry have different nextTick checkpoints', () => {
  assert.deepEqual(JSON.parse(run('order.cjs')), ['sync','nextTick','promise','microtask']);
  assert.deepEqual(JSON.parse(run('order.mjs')), ['sync','promise','microtask','nextTick']);
});
test('inside this file I/O callback, immediate runs before newly scheduled timer', () => {
  assert.deepEqual(JSON.parse(run('io-order.cjs')), ['io','immediate','timer']);
});
test('an unresolved Promise alone does not retain the process', () => {
  const out = execFileSync(process.execPath, ['-e', 'new Promise(() => {}); console.log("returned")'], { encoding:'utf8', timeout:3000 });
  assert.equal(out.trim(), 'returned');
});
test('an unref timer alone does not retain the process', () => {
  const out = execFileSync(process.execPath, ['-e', 'setTimeout(() => console.log("late"), 60000).unref(); console.log("returned")'], { encoding:'utf8', timeout:3000 });
  assert.equal(out.trim(), 'returned');
});
test('chunking preserves result and rejects invalid work size', async () => {
  const {sumInChunks} = await import('./chunks.mjs');
  assert.equal(await sumInChunks(10000),49995000);
  await assert.rejects(sumInChunks(1000001),RangeError);
});
test('cooperative work can observe cancellation between chunks', async () => {
  const {sumInChunks} = await import('./chunks.mjs');
  const controller = new AbortController();
  setImmediate(() => controller.abort());
  await assert.rejects(sumInChunks(1000000,{signal:controller.signal}), {name:'AbortError'});
});
test('an async throw becomes a rejected Promise handled by the awaiting caller', () => {
  assert.equal(run('errors.mjs'), 'caller continued\ncaught SyntaxError');
});
