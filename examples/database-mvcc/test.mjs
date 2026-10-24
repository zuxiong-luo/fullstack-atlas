import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withCluster,sql,query,session } from './harness.mjs';
test('PostgreSQL 17 MVCC: observed snapshots, not timing guesses',async t=>withCluster(async()=>{
  await sql(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
  for(const [level,second] of [['READ COMMITTED',20],['REPEATABLE READ',10]]) {
    await t.test(level+' determines snapshot lifetime',async()=>{
      await sql('UPDATE account SET balance=10 WHERE id=1;');
      const a=session('snapshot-reader');
      a.send(`BEGIN ISOLATION LEVEL ${level}; SELECT 'first='||balance FROM account WHERE id=1;\n\\echo FIRST`);
      assert.match(await a.wait('FIRST'),/first=10/);
      await sql('UPDATE account SET balance=20 WHERE id=1;','snapshot-writer');
      a.send("SELECT 'second='||balance FROM account WHERE id=1;\n\\echo SECOND");
      assert.match(await a.wait('SECOND'),new RegExp('second='+second));
      assert.equal((await a.end('COMMIT;')).code,0);
      assert.equal(await sql('SELECT balance FROM account WHERE id=1;'),'20');
      console.log(level,`first=10 second=${second} new-transaction=20`);
    });
  }
  await t.test('own writes visible, rollback restores committed value',async()=>{
    assert.equal(await sql("BEGIN ISOLATION LEVEL REPEATABLE READ; UPDATE account SET balance=99 WHERE id=1; SELECT balance FROM account WHERE id=1; ROLLBACK;"),'BEGIN\nUPDATE 1\n99\nROLLBACK');
    assert.equal(await sql('SELECT balance FROM account WHERE id=1;'),'20');
  });
  await t.test('repeatable-read stale writer receives SQLSTATE 40001',async()=>{
    const a=session('stale-writer');
    a.send('BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT balance FROM account WHERE id=1;\n\\echo SNAPSHOT');
    await a.wait('SNAPSHOT');
    await sql('UPDATE account SET balance=21 WHERE id=1;');
    const result=await a.end('UPDATE account SET balance=balance+1 WHERE id=1; COMMIT;');
    assert.notEqual(result.code,0);
    assert.match(result.error,/40001/);
    assert.equal(await sql('SELECT balance FROM account WHERE id=1;'),'21');
  });
  for(const level of ['REPEATABLE READ','SERIALIZABLE']) {
    await t.test(level+' protects different kinds of invariants',async()=>{
      await sql('DROP TABLE IF EXISTS doctors; CREATE TABLE doctors(id integer PRIMARY KEY,on_call boolean NOT NULL); INSERT INTO doctors VALUES(1,true),(2,true);');
      const a=session('skew-first'),b=session('skew-second');
      a.send(`BEGIN ISOLATION LEVEL ${level}; SELECT count(*) FROM doctors WHERE on_call;\n\\echo A_COUNTED`);
      b.send(`BEGIN ISOLATION LEVEL ${level}; SELECT count(*) FROM doctors WHERE on_call;\n\\echo B_COUNTED`);
      await Promise.all([a.wait('A_COUNTED'),b.wait('B_COUNTED')]);
      assert.equal((await a.end('UPDATE doctors SET on_call=false WHERE id=1; COMMIT;')).code,0);
      const second=await b.end('UPDATE doctors SET on_call=false WHERE id=2; COMMIT;');
      if(level==='REPEATABLE READ') {
        assert.equal(second.code,0);
        assert.equal(await sql('SELECT count(*) FROM doctors WHERE on_call;'),'0');
      } else {
        assert.notEqual(second.code,0);
        assert.match(second.error,/40001/);
        assert.equal(await sql('SELECT count(*) FROM doctors WHERE on_call;'),'1');
      }
    });
  }
  await t.test('a retained snapshot prevents old-version removal until released',async()=>{
    const a=session('vacuum-reader');
    a.send("BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT count(*) FROM versions WHERE payload LIKE 'old%';\n\\echo HELD");
    await a.wait('HELD');
    await sql("UPDATE versions SET payload=repeat('new',100);");
    const held=await query('VACUUM (VERBOSE) versions;');
    assert.match(held.stderr,/5000 are dead but not yet removable/);
    a.send("SELECT 'old-visible='||count(*) FROM versions WHERE payload LIKE 'old%';\n\\echo STILL_OLD");
    assert.match(await a.wait('STILL_OLD'),/old-visible=5000/);
    assert.equal((await a.end('COMMIT;')).code,0);
    const released=await query('VACUUM (VERBOSE) versions;');
    assert.match(released.stderr,/0 are dead but not yet removable/);
    assert.equal(await sql("SELECT count(*) FROM versions WHERE payload LIKE 'new%';"),'5000');
    console.log('held snapshot: 5000 old versions not yet removable; released: 0');
  });
}));
