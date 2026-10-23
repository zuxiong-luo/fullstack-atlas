import {it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {articles} from '../data/articles';
import {sectionBlocks} from '../data/articleTypes';
const ids=['algorithms-invariants','webgl-pipeline','flutter-engineering','cross-platform-models','electron-trust-boundary'];
it('keeps complete example files and split implementations in article bodies synchronized with runnable sources',()=>{
 for(const id of ids){
  const article=articles.find(a=>a.id===id)!;
  const groups=new Map<string,string[]>();
  for(const block of article.sections.flatMap(sectionBlocks)){
   if(block.type!=='code'||!block.filename)continue;
   const label=block.filename.split(' · ')[0];
   const filename=label.startsWith('examples/')?label:path.join('examples',id,label);
   if(!fs.existsSync(filename)||!fs.statSync(filename).isFile())continue;
   const snippets=groups.get(filename)||[];snippets.push(block.code.trim());groups.set(filename,snippets);
  }
  expect(groups.size,id+' has source mapped code').toBeGreaterThan(0);
  for(const [filename,snippets] of groups){
   let remainder=fs.readFileSync(filename,'utf8').trim();
   for(const snippet of snippets){expect(remainder,filename+' inline excerpt').toContain(snippet);remainder=remainder.replace(snippet,'');}
   expect(remainder.trim(),filename+' complete in body').toBe('');
  }
 }
});

it('keeps Agent inline production code synchronized with the shared workshop',()=>{
 for(const article of articles.filter(a=>a.id.startsWith('agent-'))){
  let mapped=0;
  for(const block of article.sections.flatMap(sectionBlocks)){
   if(block.type!=='code'||!block.filename)continue;
   const label=block.filename.split(' · ')[0].replace(/^examples\/agent-workshop\//,'');
   if(!/^(python(?:-v2)?|typescript(?:-v2)?|shared)\//.test(label))continue;
   const filename=path.join('examples/agent-workshop',label);
   if(!fs.existsSync(filename))throw new Error('Missing inline source: '+filename);
   const source=fs.readFileSync(filename,'utf8').trim();
   mapped++;
   expect(source,article.id+': '+filename).toContain(block.code.trim());
  }
  expect(mapped,article.id+' has inline source').toBeGreaterThan(0);
 }
});

it('keeps article metadata and download paths valid for the public reader',()=>{
 for(const article of articles){
  expect(Array.isArray(article.tags),article.id+' tags').toBe(true);
  for(const entry of article.examples||[]){
   expect(entry.path,article.id+' download path').not.toMatch(/^(examples|downloads)\//);
   const source=path.join('examples',entry.path.endsWith('.zip')?entry.path.slice(0,-4):entry.path);
   expect(fs.existsSync(source),article.id+': '+source).toBe(true);
  }
 }
});
