import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withCluster, sql } from './harness.mjs';
export const recent=`SELECT id, amount_cents FROM orders
WHERE tenant_id=42 AND status='paid'
  AND created_at >= timestamp '2026-01-02'
ORDER BY created_at DESC, id DESC LIMIT 20`;
const flatten=node=>[node,...(node.Plans??[]).flatMap(flatten)];
const plan=async query=>JSON.parse(await sql(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`))[0].Plan;
test('PostgreSQL 17 index experiments: fresh private cluster',async t=>withCluster(async()=>{
  await sql(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
  let expected;
  await t.test('without matching index, filter table and sort',async()=>{
    expected=await sql(recent);
    const nodes=flatten(await plan(recent));
    assert.ok(nodes.some(n=>n['Node Type']==='Seq Scan'));
    assert.ok(nodes.some(n=>n['Node Type']==='Sort'));
    console.log('before:',nodes.map(n=>n['Node Type']).join(' > '));
  });
  await sql('CREATE INDEX orders_recent ON orders(tenant_id,status,created_at DESC,id DESC) INCLUDE(amount_cents);');
  await sql('VACUUM (ANALYZE) orders;');
  await t.test('leading equalities plus ordered suffix return same rows without Sort',async()=>{
    assert.equal(await sql(recent),expected);
    const nodes=flatten(await plan(recent));
    const index=nodes.find(n=>n['Index Name']==='orders_recent');
    assert.ok(index);
    assert.equal(index['Node Type'],'Index Only Scan');
    assert.ok(!nodes.some(n=>n['Node Type']==='Sort'));
    assert.equal(index['Heap Fetches'],0);
    console.log('after:',JSON.stringify({type:index['Node Type'],rows:index['Actual Rows'],heapFetches:index['Heap Fetches'],condition:index['Index Cond']}));
  });
  await t.test('INCLUDE is payload: dirty visibility map requires heap checks',async()=>{
    await sql('UPDATE orders SET amount_cents=amount_cents+1 WHERE tenant_id=42;');
    const dirty=flatten(await plan(recent)).find(n=>n['Index Name']==='orders_recent');
    assert.equal(dirty['Node Type'],'Index Only Scan');
    assert.ok(dirty['Heap Fetches']>0);
    console.log('dirty heap fetches:',dirty['Heap Fetches']);
    await sql('VACUUM (ANALYZE) orders;');
    const clean=flatten(await plan(recent)).find(n=>n['Index Name']==='orders_recent');
    assert.equal(clean['Heap Fetches'],0);
  });
  await t.test('missing leading key does not make an SQL query illegal',async()=>{
    const count=Number(await sql("SELECT count(*) FROM orders WHERE status='paid';"));
    assert.equal(count,66666);
    const nodes=flatten(await plan("SELECT * FROM orders WHERE status='paid'"));
    console.log('non-leading broad query:',nodes.map(n=>n['Node Type']).join(' > '));
    // A different cost configuration may choose a full index/bitmap path; correctness is invariant.
  });
  await t.test('a function on key is not the same expression as the ordinary key',async()=>{
    const nodes=flatten(await plan("SELECT id FROM orders WHERE tenant_id+1=43 AND status='paid'"));
    assert.ok(nodes.some(n=>(n.Filter??'').includes('tenant_id + 1')));
    await sql('CREATE INDEX orders_tenant_expression ON orders((tenant_id+1)); ANALYZE orders;');
    const expression=flatten(await plan("SELECT id FROM orders WHERE tenant_id+1=43 AND status='paid'"));
    assert.ok(expression.some(n=>n['Index Name']==='orders_tenant_expression'));
  });
}));
