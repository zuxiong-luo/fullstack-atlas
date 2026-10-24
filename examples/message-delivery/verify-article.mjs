import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const id=JSON.parse(await readFile(new URL('./package.json',import.meta.url),'utf8')).name.replace('-lab','');
const path=new URL(`../../src/data/articles/tasks/${id}.ts`,import.meta.url);
let text;
try { text=await readFile(path,'utf8'); }
catch(error) { if(error.code!=='ENOENT')throw error; console.log('Standalone download: article source not present; syntax checks still run.'); }
if(text) {
  const article=JSON.parse(text.slice(text.indexOf('= {')+2,text.lastIndexOf(';\nexport default')));
  let count=0;
  for(const block of article.sections.flatMap(s=>s.blocks??[])) {
    if(block.type!=='code'||!block.filename?.startsWith(`examples/${id}/`))continue;
    const file=block.filename.slice(`examples/${id}/`.length);
    const original=await readFile(new URL(file,import.meta.url),'utf8');
    assert.ok(original.includes(block.code),`${block.filename}: article excerpt must be contiguous actual source`);
    count++;
  }
  assert.ok(count>0,'must expose actual decisive source');
  console.log(`${id}: ${count} article source excerpts match actual files.`);
}
