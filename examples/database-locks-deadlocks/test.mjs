import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withCluster,sql,session,until } from './harness.mjs';
const isBlocked=name=>sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${name}' AND cardinality(pg_blocking_pids(pid))>0;`).then(x=>x==='1');
const observe=`SELECT application_name,wait_event_type,wait_event,pg_blocking_pids(pid)
FROM pg_stat_activity WHERE application_name LIKE 'locks-%' ORDER BY application_name;`;
export async function transfer(from,to,amount,maxAttempts=3) {
  for(let attempt=1;attempt<=maxAttempts;attempt++) {
    try {
      // Inputs are trusted integers in this lab. Real drivers must bind parameters.
      assert.ok([from,to,amount].every(Number.isSafeInteger)&&from!==to&&amount>0);
      return await sql(`BEGIN; SELECT move_funds(${from},${to},${amount}); COMMIT;`);
    } catch(error) {
      if(!/\b(40P01|40001)\b/.test(error.stderr??'')||attempt===maxAttempts)throw error;
      // Reopen a connection and BEGIN again; never retry only the failed UPDATE.
      await new Promise(resolve=>setTimeout(resolve,attempt*10));
    }
  }
}
test('PostgreSQL 17 real locking and deadlock recovery',async t=>withCluster(async()=>{
  await sql(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
  await t.test('ordinary MVCC read passes; FOR UPDATE waits for the owner',async()=>{
    const a=session('locks-owner');
    a.send('BEGIN; UPDATE accounts SET balance=90 WHERE id=1;\n\\echo HELD');
    await a.wait('HELD');
    assert.equal(await sql('SELECT balance FROM accounts WHERE id=1;'),'100');
    const b=session('locks-waiter');
    b.send('BEGIN; SELECT balance FROM accounts WHERE id=1 FOR UPDATE;\n\\echo ACQUIRED');
    await until(()=>isBlocked('locks-waiter'),'waiter blocked by owner');
    console.log(await sql(observe));
    assert.equal((await a.end('COMMIT;')).code,0);
    assert.match(await b.wait('ACQUIRED'),/90/);
    assert.equal((await b.end()).code,0);
  });
  await t.test('NOWAIT gives 55P03, SKIP LOCKED omits a locked row',async()=>{
    const a=session('locks-owner');
    a.send('BEGIN; SELECT id FROM accounts WHERE id=1 FOR UPDATE;\n\\echo HELD');
    await a.wait('HELD');
    await assert.rejects(sql('SELECT id FROM accounts WHERE id=1 FOR UPDATE NOWAIT;'),error=>/55P03/.test(error.stderr));
    assert.equal(await sql('SELECT id FROM accounts ORDER BY id FOR UPDATE SKIP LOCKED;'),'2');
    assert.equal((await a.end()).code,0);
  });
  await t.test('AccessExclusive table lock waits for AccessShare reader',async()=>{
    const a=session('locks-reader');
    a.send('BEGIN; SELECT count(*) FROM accounts;\n\\echo READ');
    await a.wait('READ');
    const b=session('locks-ddl');
    b.send('BEGIN; LOCK TABLE accounts IN ACCESS EXCLUSIVE MODE;\n\\echo TABLE_HELD');
    await until(()=>isBlocked('locks-ddl'),'table lock blocked by reader');
    assert.equal((await a.end()).code,0);
    await b.wait('TABLE_HELD');
    assert.equal((await b.end()).code,0);
  });
  await t.test('opposite lock order creates a cycle; exactly one victim rolls back',async()=>{
    await sql('UPDATE accounts SET balance=100;');
    const a=session('locks-dead-a'),b=session('locks-dead-b');
    a.send('BEGIN; SET deadlock_timeout=\'2s\'; UPDATE accounts SET balance=balance-10 WHERE id=1;\n\\echo A_FIRST');
    b.send('BEGIN; SET deadlock_timeout=\'2s\'; UPDATE accounts SET balance=balance-20 WHERE id=2;\n\\echo B_FIRST');
    await Promise.all([a.wait('A_FIRST'),b.wait('B_FIRST')]);
    a.send('UPDATE accounts SET balance=balance+10 WHERE id=2;');
    await until(()=>isBlocked('locks-dead-a'),'A waits for B');
    b.send('UPDATE accounts SET balance=balance+20 WHERE id=1;');
    await until(async()=>await isBlocked('locks-dead-a')&&await isBlocked('locks-dead-b'),'observed wait cycle');
    console.log('Observed both wait edges before PostgreSQL detector ran');
    const [ra,rb]=await Promise.all([a.end('COMMIT;'),b.end('COMMIT;')]);
    assert.equal([ra,rb].filter(x=>x.code!==0).length,1);
    const victim=ra.code!==0?ra:rb;
    assert.match(victim.error,/40P01/);
    assert.equal(await sql('SELECT sum(balance) FROM accounts;'),'200');
    // Only the rejected, fully rolled-back transaction is retried.
    if(ra.code!==0)await transfer(1,2,10);else await transfer(2,1,20);
    assert.equal(await sql('SELECT string_agg(balance::text,\',\' ORDER BY id) FROM accounts;'),'110,90');
    console.log('40P01 victim replayed as a whole transaction; final balances=110,90');
  });
  await t.test('same sorted lock order lets opposing transfers both finish',async()=>{
    await sql('UPDATE accounts SET balance=100;');
    await Promise.all([transfer(1,2,10),transfer(2,1,20)]);
    assert.equal(await sql('SELECT string_agg(balance::text,\',\' ORDER BY id) FROM accounts;'),'110,90');
  });
  await t.test('missing account rejects whole transfer without creating money',async()=>{
    await assert.rejects(transfer(999,1,10),error=>/22023/.test(error.stderr));
    assert.equal(await sql('SELECT sum(balance) FROM accounts;'),'200');
  });
  await t.test('business constraint error 23514 is not retried',async()=>{
    await assert.rejects(transfer(1,2,1000),error=>/23514/.test(error.stderr));
    assert.equal(await sql('SELECT string_agg(balance::text,\',\' ORDER BY id) FROM accounts;'),'110,90');
  });
}));
