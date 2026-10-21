import {describe,it,expect} from 'vitest';
import {parseBackup,filterQuestions} from './storage';
import {createWorkerSource,createReactDocument} from './runner';
import {questions,paths,topics} from '../data/content';
import vm from 'node:vm';
describe('backup compatibility and safety',()=>{
 it('round-trips notes, statuses, bookmarks and code without executing content',()=>{const data={version:1,records:{oauth:{status:'review',favorite:true,note:'<script>alert(1)</script>',updatedAt:'2026-10-21'}},drafts:{js:'console.log(42)'}};expect(parseBackup(JSON.stringify(data))).toEqual(data)});
 it('rejects invalid status and malformed draft',()=>{expect(()=>parseBackup(JSON.stringify({version:1,records:{q:{status:'wrong',favorite:true,note:'',updatedAt:''}},drafts:{}}))).toThrow();expect(()=>parseBackup('{"version":1,"records":{},"drafts":{"js":42}}')).toThrow()});
 it('rejects dangerous record names and unknown schema',()=>{expect(()=>parseBackup('{"version":1,"records":{},"drafts":{"__proto__":"x"}}')).toThrow();expect(()=>parseBackup('{"version":2,"records":{},"drafts":{}}')).toThrow()});
});
describe('knowledge navigation',()=>{
 it('has unique IDs and all links resolve',()=>{const ids=new Set(questions.map(q=>q.id));expect(ids.size).toBe(questions.length);for(const q of questions){expect(topics.some(t=>t.id===q.topic)).toBe(true);for(const id of q.related)expect(ids.has(id)).toBe(true)}for(const path of paths)for(const id of path.ids)expect(ids.has(id)).toBe(true)});
 it('searches tags and combines query terms with topic filters',()=>{expect(filterQuestions(questions,'OAUTH pkce','network').some(q=>q.id==='oauth')).toBe(true);expect(filterQuestions(questions,'OAUTH','infra')).toHaveLength(0);expect(filterQuestions(questions,'不存在的词','all')).toHaveLength(0)});
});
describe('code runner',()=>{
 it('captures async logs in correct order',async()=>{const output:any[]=[];const scope={self:{postMessage:(data:any)=>output.push(data),addEventListener:()=>{}},console:{log:()=>{}},setTimeout,Promise};vm.runInNewContext(createWorkerSource("console.log('sync'); Promise.resolve().then(()=>console.log('micro')); setTimeout(()=>console.log('timer'),0);"),scope);await new Promise(resolve=>setTimeout(resolve,15));expect(output.filter(x=>x.kind==='log').map(x=>x.text)).toEqual(['sync','micro','timer'])});
 it('caps console flooding',async()=>{const output:any[]=[];vm.runInNewContext(createWorkerSource("for(let i=0;i<1000;i++)console.log(i)"),{self:{postMessage:(data:any)=>output.push(data),addEventListener:()=>{}},console:{log:()=>{}}});expect(output.filter(x=>x.kind==='log')).toHaveLength(200)});
 it('escapes script termination from user source',()=>{const doc=createReactDocument('',"console.log('</script><h1>escape</h1>')",'nonce');expect(doc).toContain('<\\/script>');expect(doc.match(/<script>/g)).toHaveLength(3)});
});
