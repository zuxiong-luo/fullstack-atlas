const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const {tmpdir}=require('node:os');const path=require('node:path');
const {assertSender,reportId,safeTarget,externalURL}=require('../policy.cjs');const {createExportHandler}=require('../export-service.cjs');
const url='atlas://app/index.html';
function context(){const mainFrame={url};const win={isDestroyed:()=>false,webContents:{id:1,mainFrame}};return {win,event:{sender:win.webContents,senderFrame:mainFrame}};}
test('requires both owning webContents and exact main frame/url',()=>{
 const {win,event}=context();assert.doesNotThrow(()=>assertSender(event,win,url));
 for(const bad of [{...event,sender:{}},{...event,senderFrame:{url}},{...event,senderFrame:null}])assert.throws(()=>assertSender(bad,win,url),{code:'UNAUTHORIZED'});
 event.senderFrame.url='atlas://app/other.html';assert.throws(()=>assertSender(event,win,url),{code:'UNAUTHORIZED'});
});
test('strict input rejects traversal, extra fields and prototype keys; target remains under root',()=>{
 for(const reportId of ['../secret','/tmp/a','a/b','a\\b','a%2fb','',123,'a'.repeat(41)])assert.throws(()=>safeTarget('/safe',reportId),{code:'INVALID_INPUT'});
 assert.throws(()=>reportId({reportId:'summary',path:'/tmp/stolen'}),{code:'INVALID_INPUT'});assert.equal(safeTarget('/safe','summary'),path.resolve('/safe/summary.csv'));
});
test('only one exact HTTPS help destination is accepted',()=>{
 assert.equal(externalURL('https://www.electronjs.org/docs/latest/tutorial/security'),'https://www.electronjs.org/docs/latest/tutorial/security');
 for(const value of ['file:///etc/passwd','javascript:alert(1)','https://www.electronjs.org.evil.example/docs/latest/tutorial/security','https://user:pass@www.electronjs.org/docs/latest/tutorial/security','https://www.electronjs.org/docs/latest/tutorial/security?target=evil'])assert.throws(()=>externalURL(value),{code:'INVALID_URL'});
});
test('real file export enforces sender, role, no overwrite, busy and symlink boundary',async()=>{
 const root=await fs.mkdtemp(path.join(tmpdir(),'electron-boundary-'));const {win,event}=context();const dir=path.join(root,'exports');const handler=createExportHandler({getWindow:()=>win,entryURL:url,exportDir:dir});
 try{
  assert.equal((await handler({...event,sender:{}},{reportId:'summary'})).code,'UNAUTHORIZED');
  assert.equal((await handler(event,{reportId:'finance'})).code,'FORBIDDEN');assert.equal((await handler(event,{reportId:'constructor'})).code,'FORBIDDEN');
  const one=handler(event,{reportId:'summary'});assert.equal((await handler(event,{reportId:'summary'})).code,'BUSY');const result=await one;assert.equal(result.ok,true);assert.equal(result.filename,'summary.csv');assert.match(await fs.readFile(path.join(dir,'summary.csv'),'utf8'),/month,total/);assert.equal((await handler(event,{reportId:'summary'})).code,'ALREADY_EXISTS');
  const outside=path.join(root,'outside.csv');await fs.writeFile(outside,'unchanged');await fs.unlink(path.join(dir,'summary.csv'));await fs.symlink(outside,path.join(dir,'summary.csv'));
  assert.equal((await handler(event,{reportId:'summary'})).code,'ALREADY_EXISTS');assert.equal(await fs.readFile(outside,'utf8'),'unchanged');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('destroyed window and failed filesystem return safe predictable results',async()=>{
 const root=await fs.mkdtemp(path.join(tmpdir(),'electron-error-'));const {win,event}=context();
 try{win.isDestroyed=()=>true;let handler=createExportHandler({getWindow:()=>win,entryURL:url,exportDir:root});assert.equal((await handler(event,{reportId:'summary'})).code,'UNAUTHORIZED');
  win.isDestroyed=()=>false;const file=path.join(root,'not-directory');await fs.writeFile(file,'x');handler=createExportHandler({getWindow:()=>win,entryURL:url,exportDir:file});const result=await handler(event,{reportId:'summary'});assert.equal(result.code,'IO_ERROR');assert.doesNotMatch(JSON.stringify(result),new RegExp(root));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
