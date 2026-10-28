const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {createApp} = require('../dist/nest-comparison.js');

test('real NestJS HTTP follows shared cases, including JSON-number representation difference', async () => {
 const app = await createApp();
 await app.listen(0, '127.0.0.1');
 const port = app.getHttpServer().address().port;
 try {
  const cases = JSON.parse(readFileSync(join(__dirname, '../shared/quotes.json'), 'utf8'));
  for (const c of cases) {
   const response = await fetch(`http://127.0.0.1:${port}/api/quotes`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: c.raw ?? JSON.stringify(c.body),
   });
   assert.equal(response.status, c.nestjsStatus ?? c.status, c.name);
   const body = await response.json();
   const expected = c.nestjsExpected ?? c.expected;
   if (expected) assert.deepEqual(body, expected, c.name);
   assert.equal(Object.hasOwn(body, 'internal_rule'), false, c.name);
  }
 } finally { await app.close(); }
});
