import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { temporaryCluster, sql, session, waitFor } from './harness.mjs';
test('PostgreSQL 17 real transaction experiments, isolated cluster only', async t => temporaryCluster(async () => {
  await sql(await readFile('schema.sql', 'utf8'));
  async function reset(stock = 1) { await sql(`TRUNCATE orders, inventory RESTART IDENTITY CASCADE; INSERT INTO inventory VALUES(1,${stock}),(2,1);`); }
  await t.test('naive read-then-assign allows two orders even with stock CHECK', async () => {
    await reset();
    const a=session('naive-a'), b=session('naive-b');
    a.send("BEGIN; SELECT stock FROM inventory WHERE sku=1;\n\\echo READ_A");
    b.send("BEGIN; SELECT stock FROM inventory WHERE sku=1;\n\\echo READ_B");
    await Promise.all([a.wait('READ_A'),b.wait('READ_B')]);
    assert.equal((await a.end("UPDATE inventory SET stock=0 WHERE sku=1; INSERT INTO orders(request_key,sku) VALUES('a',1); COMMIT;")).code,0);
    assert.equal((await b.end("UPDATE inventory SET stock=0 WHERE sku=1; INSERT INTO orders(request_key,sku) VALUES('b',1); COMMIT;")).code,0);
    assert.equal(await sql('SELECT stock,(SELECT count(*) FROM orders) FROM inventory WHERE sku=1;'),'0|2');
  });
  await t.test('second connection waits, rechecks stock and fails without a second order', async () => {
    await reset();
    const a=session('lock-a');
    a.send("BEGIN; SELECT purchase('a',1);\n\\echo LOCK_HELD");
    await a.wait('LOCK_HELD');
    const waiting=sql("SELECT purchase('b',1);",'lock-b').then(value=>({value}),error=>({error}));
    await waitFor(async()=>await sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='lock-b' AND wait_event_type='Lock';")==='1');
    assert.equal((await a.end('COMMIT;')).code,0);
    assert.match((await waiting).error.stderr,/INSUFFICIENT_STOCK/);
    assert.equal(await sql('SELECT stock,(SELECT count(*) FROM orders) FROM inventory WHERE sku=1;'),'0|1');
  });
  await t.test('a later error rolls back stock and order together', async () => {
    await reset();
    await assert.rejects(sql("BEGIN; SELECT purchase('rollback',1); SELECT 1/0; COMMIT;"),/division by zero/);
    assert.equal(await sql('SELECT stock,(SELECT count(*) FROM orders) FROM inventory WHERE sku=1;'),'1|0');
  });
  await t.test('idempotency key neither deducts twice nor accepts changed business input', async () => {
    await reset(2);
    assert.equal(await sql("SELECT purchase('same',1);"),'created');
    assert.equal(await sql("SELECT purchase('same',1);"),'duplicate');
    await assert.rejects(sql("SELECT purchase('same',2);"),/IDEMPOTENCY_KEY_CONFLICT/);
    assert.equal(await sql('SELECT stock,(SELECT count(*) FROM orders) FROM inventory WHERE sku=1;'),'1|1');
  });
  for(const level of ['REPEATABLE READ','SERIALIZABLE']) await t.test(`${level} cross-row write skew`, async()=>{
    await sql('TRUNCATE doctors; INSERT INTO doctors VALUES(1,true),(2,true);');
    const a=session('skew-a'), b=session('skew-b');
    a.send(`BEGIN ISOLATION LEVEL ${level}; SELECT count(*) FROM doctors WHERE on_call;\n\\echo SEEN_A`);
    b.send(`BEGIN ISOLATION LEVEL ${level}; SELECT count(*) FROM doctors WHERE on_call;\n\\echo SEEN_B`);
    await Promise.all([a.wait('SEEN_A'),b.wait('SEEN_B')]);
    const first=await a.end('UPDATE doctors SET on_call=false WHERE id=1; COMMIT;');
    const second=await b.end('UPDATE doctors SET on_call=false WHERE id=2; COMMIT;');
    assert.equal(first.code,0);
    if(level==='REPEATABLE READ') { assert.equal(second.code,0); assert.equal(await sql('SELECT count(*) FROM doctors WHERE on_call;'),'0'); }
    else { assert.notEqual(second.code,0); assert.match(second.error,/could not serialize/); assert.equal(await sql('SELECT count(*) FROM doctors WHERE on_call;'),'1'); }
  });
}));
