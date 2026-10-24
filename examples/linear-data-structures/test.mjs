import test from 'node:test';import assert from 'node:assert/strict';
import {Vector,SinglyList,Stack,RingQueue,bracketsBalanced} from './dist/core.js';
import {readFileSync} from 'node:fs';
let seed=20261024;function random(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
test('vector/list differential: 3000 controlled mixed insert/remove/read operations each',()=>{
 for(const Type of [Vector,SinglyList]){const x=new Type(),model=[];
  for(let k=0;k<3000;k++){
   if(!model.length||random(3)===0){const at=random(model.length+1),v=random(100);x.insert(at,v);model.splice(at,0,v);}
   else if(random(2)){const at=random(model.length);assert.equal(x.remove(at),model.splice(at,1)[0]);}
   else{const at=random(model.length);assert.equal(x.get(at),model[at]);}
   x.assertInvariant();assert.deepEqual(x.values(),model);assert.equal(x.size,model.length);
  }
 }
});
test('invalid indices cannot mutate structures',()=>{for(const Type of [Vector,SinglyList]){const x=new Type();for(const n of [-1,0.5,NaN,Infinity,1])assert.throws(()=>x.insert(n,1),RangeError);assert.throws(()=>x.get(0),RangeError);assert.throws(()=>x.remove(0),RangeError);assert.equal(x.size,0);}});
test('doubling copies are <2N over append prefixes, never a timing claim',()=>{const x=new Vector();for(let n=1;n<=4096;n++){x.insert(x.size,n);assert.ok(x.cost.copies<2*n);assert.equal(x.cost.shifts,0);}assert.equal(x.capacity,4096);});
test('front insertion shifts N(N-1)/2 entries; indexed list access walks',()=>{const x=new Vector(),y=new SinglyList();for(let i=0;i<50;i++){x.insert(0,i);y.insert(y.size,i);}assert.equal(x.cost.shifts,50*49/2);assert.equal(y.get(49),49);assert.equal(y.cost.hops,49);});
test('single node list empties and can be reused without stale tail',()=>{const x=new SinglyList();x.insert(0,0);assert.equal(x.remove(0),0);x.assertInvariant();x.insert(0,1);x.insert(1,2);assert.equal(x.remove(1),2);x.assertInvariant();assert.deepEqual(x.values(),[1]);});
test('ring wraps, grows in logical order, clears removed references',()=>{const q=new RingQueue();for(let i=0;i<4;i++)q.enqueue(i);assert.equal(q.dequeue(),0);assert.equal(q.dequeue(),1);q.enqueue(4);q.enqueue(5);assert.equal(q.head,2);q.enqueue(6);assert.equal(q.head,0);assert.deepEqual(q.values(),[2,3,4,5,6]);assert.equal(q.copies,4);while(q.size)q.dequeue();assert.ok(q.slots().every(x=>x===null));q.assertInvariant();assert.equal(q.dequeue(),undefined);});
test('FIFO and LIFO differential properties over 5000 actions',()=>{const q=new RingQueue(),s=new Stack(),fifo=[],lifo=[];for(let i=0;i<5000;i++){if(random(3)){const n=random(1000);q.enqueue(n);s.push(n);fifo.push(n);lifo.push(n);}else{assert.equal(q.dequeue(),fifo.shift());assert.equal(s.pop(),lifo.pop());}q.assertInvariant();assert.deepEqual(q.values(),fifo);assert.deepEqual(s.values(),lifo);}});
test('bracket nesting: empty, mismatch, crossed, and unfinished cases',()=>{for(const text of ['', '([]){}','a[b](c)'])assert.equal(bracketsBalanced(text),true);for(const text of ['([)]','(',')','{[]'])assert.equal(bracketsBalanced(text),false);});
test('browser entry contains exact core and imports only React',()=>{const app=readFileSync(new URL('./App.tsx',import.meta.url),'utf8'),core=readFileSync(new URL('./core.ts',import.meta.url),'utf8');assert.ok(app.includes(core));assert.deepEqual(app.split('\n').filter(x=>x.startsWith('import ')),["import React, {useState} from 'react';"]);});
