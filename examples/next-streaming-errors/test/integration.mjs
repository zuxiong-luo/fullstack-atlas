import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {get} from 'node:http';
import {start} from './harness.mjs';
let app;before(async()=>{app=await start(4335);});after(async()=>{await app?.stop();});
async function control(input){const res=await fetch(app.base+'/api/gates',{method:'POST',headers:{origin:app.base,'content-type':'application/json'},body:JSON.stringify(input)});return {res,body:await res.json()};}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function stream(path){
 const chunks=[];let status=0,html='',closed=false;
 let accept,reject;const done=new Promise((resolve,fail)=>{accept=resolve;reject=fail;});
 const request=get(app.base+path,{headers:{'user-agent':'Mozilla/5.0 Chrome/128.0.0.0'}},res=>{
  status=res.statusCode;res.setEncoding('utf8');res.on('data',data=>{chunks.push(data);html+=data;});res.on('end',()=>{closed=true;accept();});res.on('error',reject);
 });request.on('error',reject);request.setTimeout(15000,()=>request.destroy(new Error('stream test timeout')));
 return {chunks,done,get html(){return html;},get status(){return status;},async wait(marker){for(let i=0;i<200;i++){if(html.includes(marker))return;if(closed)throw new Error('stream closed before '+marker);await pause(10);}throw new Error('marker not observed: '+marker);},close(){request.destroy();}};
}
test('real HTTP bytes contain a shell and fallback before controlled data release',async()=>{
 assert.equal((await control({op:'init',id:'normal',mode:'ok'})).res.status,200);
 const wire=await stream('/reports/normal');try{
  await wire.wait('REGION_PENDING');assert.match(wire.html,/STREAM_SHELL/);assert.doesNotMatch(wire.html,/REPORT_READY/);
  const before=wire.chunks.length;assert.equal((await control({op:'release',id:'normal'})).res.status,200);
  await wire.done;assert.equal(wire.status,200);assert.match(wire.html,/REPORT_READY/);assert(wire.chunks.length>before);console.log(JSON.stringify({evidence:'controlled-stream',chunksBeforeRelease:before,chunksAfterRelease:wire.chunks.length,status:wire.status}));
 }finally{wire.close();}
});
test('streamed server error hides internal detail; same segment can be fetched again successfully',async()=>{
 await control({op:'init',id:'one-failure',mode:'fail-once'});const wire=await stream('/reports/one-failure');
 try{await wire.wait('REGION_PENDING');await control({op:'release',id:'one-failure'});await wire.done;
  assert.doesNotMatch(wire.html,/INTERNAL_ONCE_FAILURE_DO_NOT_SEND/);assert.match(wire.html,/digest/);
  const state=await(await fetch(app.base+'/api/gates?id=one-failure')).json();assert.equal(state.state.failureUsed,true);
  const recovered=await(await fetch(app.base+'/reports/one-failure')).text();assert.match(recovered,/REPORT_READY/);assert.doesNotMatch(recovered,/INTERNAL_ONCE_FAILURE_DO_NOT_SEND/);
 }finally{wire.close();}
});
test('gate timeout becomes an encoded server error, not fake successful report',async()=>{
 await control({op:'init',id:'timeout',mode:'ok',timeoutMs:100});
 const res=await fetch(app.base+'/reports/timeout'),html=await res.text();assert.doesNotMatch(html,/REPORT_READY|INTERNAL_GATE_TIMEOUT/);assert.match(html,/digest/);
 assert.equal((await(await fetch(app.base+'/api/gates?id=timeout')).json()).state.timedOut,true);
});
test('input and origin guards fail before creating uncontrolled waits',async()=>{
 assert.equal((await control({op:'init',id:'bad id',mode:'ok'})).res.status,400);
 await control({op:'init',id:'busy',mode:'ok'});assert.equal((await control({op:'init',id:'busy',mode:'ok'})).res.status,409);await control({op:'release',id:'busy'});
 const forbidden=await fetch(app.base+'/api/gates',{method:'POST',headers:{origin:'https://outside.invalid'},body:'{}'});assert.equal(forbidden.status,403);
 const missing=await(await fetch(app.base+'/reports/absent')).text();assert.match(missing,/报告未初始化/);
});
