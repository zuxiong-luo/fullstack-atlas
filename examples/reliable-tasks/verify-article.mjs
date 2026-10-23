import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
let text;
try { text=await readFile('../../src/data/articles/legacy/reliable-tasks.ts','utf8'); }
catch(error) { if(error.code!=='ENOENT')throw error; console.log('Article check skipped: standalone archive'); }
if(text){
 const article=JSON.parse(text.slice(text.indexOf('= {')+2,text.lastIndexOf(';\nexport default')));
 const blocks=article.sections.flatMap(section=>section.blocks??[]);
 for(const file of ["schema.sql", "harness.mjs", "test.mjs", "worker.mjs"]){
  const block=blocks.find(block=>block.type==='code'&&block.filename===file+' · 完整文件');
  assert.ok(block,file+' must be displayed');
  assert.equal(block.code,(await readFile(file,'utf8')).trimEnd(),file);
 }
 console.log('Published business and reproduction code matches files');
}
