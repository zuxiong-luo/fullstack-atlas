import {test} from 'node:test';import assert from 'node:assert/strict';
import {evaluate} from '../src/eval.js';import {readShared} from '../src/contracts.js';
test('evaluation rejects empty, no-positive and no-negative fixtures instead of passing NaN',async()=>{
 await assert.rejects(evaluate([]));await assert.rejects(evaluate([{id:'n',owner:'alice',question:'none',expected:[]}]))
 await assert.rejects(evaluate([{id:'p',owner:'alice',question:'cache',expected:['cache-guide']}]))
});
test('shared retrieval regression produces per-case recall and no-hit with no model invocation',async()=>{
 const report=await evaluate(readShared('retrieval-cases.json'));assert.equal(report.cases.length,6);assert.equal(report.mean_recall_at_3,1);assert.equal(report.no_hit_pass,true);assert.equal(report.model_calls,0);assert.equal(report.not_model_quality,true);
});
test('Recall@3 never credits a relevant document returned at rank four',async()=>{
 const report=await evaluate([{id:'p',owner:'alice',question:'positive',expected:['target']},{id:'n',owner:'alice',question:'none',expected:[]}],{search:async(_owner,question)=>question==='none'?[]:['a','b','c','target'].map(id=>({id,title:id,text:id}))});
 assert.deepEqual(report.cases[0].selected,['a','b','c']);assert.equal(report.cases[0].recall_at_3,0);assert.equal(report.mean_recall_at_3,0);
});
