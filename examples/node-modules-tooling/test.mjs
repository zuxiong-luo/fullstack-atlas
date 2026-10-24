import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseNote } from './dist/notes.js';
const run = args => execFileSync(process.execPath, args, { cwd: import.meta.dirname, encoding:'utf8', timeout:15000, stdio:['ignore','pipe','pipe'] }).trim();
test('input is checked at runtime, not merely asserted to be Note', () => {
  const raw = {title:'  notes  ',tags:['node']};
  const note = parseNote(raw);
  raw.tags.push('mutated');
  assert.deepEqual(note,{title:'notes',tags:['node']});
  for (const bad of [null, [], {}, {title:'',tags:[]}, {title:'ok',tags:[3]}, {title:'ok',tags:new Array(1)}, {title:'x'.repeat(81),tags:[]}]) {
    assert.throws(() => parseNote(bad), TypeError);
  }
});
test('compiled ESM uses emitted .js paths and removes type imports', () => {
  const output = readFileSync(new URL('./dist/main.js', import.meta.url),'utf8');
  assert.match(output,/from '.\/notes\.js'/);
  assert.doesNotMatch(output,/import type|: Note/);
  assert.deepEqual(JSON.parse(run(['dist/main.js'])), {title:'Learn Node',tags:['node']});
});
test('an extensionless ESM relative import is rejected', () => {
  assert.throws(() => run(['--input-type=module','-e',"await import('./dist/notes')"]), error => /ERR_MODULE_NOT_FOUND/.test(error.stderr.toString()));
});
test('package exports exposes root and rejects private deep imports', () => {
  assert.equal(run(['--input-type=module','-e',"const {parseNote}=await import('node-modules-tooling');console.log(parseNote({title:'ok',tags:[]}).title)"]), 'ok');
  assert.throws(() => run(['--input-type=module','-e',"await import('node-modules-tooling/dist/notes.js')"]), error => /ERR_PACKAGE_PATH_NOT_EXPORTED/.test(error.stderr.toString()));
});
test('ESM can consume CJS default export', () => { assert.equal(run(['bridge.mjs']),'bridged'); });
test('compiler rejects an extensionless ESM path and a statically wrong type', () => {
  const common = ['node_modules/typescript/bin/tsc','--noEmit','--strict','--skipLibCheck','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext'];
  assert.throws(() => run([...common,'failures/extension.ts']), error => /TS2835/.test(error.stdout.toString()));
  assert.throws(() => run([...common,'failures/type.ts']), error => /TS2322/.test(error.stdout.toString()));
});
test('same ESM URL shares a module, different query creates another instance', async () => {
  const first = await import('./counter.mjs');
  const again = await import('./counter.mjs');
  const separate = await import('./counter.mjs?separate');
  first.increment();
  assert.equal(first,again);
  assert.equal(again.state.count,1);
  assert.equal(separate.state.count,0);
  assert.notEqual(first,separate);
});
