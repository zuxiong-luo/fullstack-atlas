import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceSession, createDemoSource } from './session.mjs';
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve=a;reject=b; }); return { promise, resolve, reject }; };
test('normal reading, duplicate sequence, wrong device and subscription ownership', () => {
 const source=createDemoSource(), values=[];const session=new DeviceSession(source,{read:async()=>''},value=>values.push(value));
 session.connect('A');source.emit({deviceId:'A',sequence:2,battery:80});source.emit({deviceId:'A',sequence:1,battery:1});
 assert.equal(session.state.battery,80);session.connect('B');assert.equal(source.listenerCount(),1);
 source.emit({deviceId:'A',sequence:3,battery:1});assert.equal(session.state.battery,null);
 source.emit({deviceId:'B',sequence:1,battery:65});assert.equal(session.state.battery,65);
 session.dispose();assert.equal(source.listenerCount(),0);
});
test('late result cannot write into newly selected device',async()=>{
 const request=deferred(),session=new DeviceSession(createDemoSource(),{read:()=>request.promise},()=>{});
 session.connect('A');const pending=session.readFirmware();session.connect('B');request.resolve('A-old');await pending;
 assert.equal(session.state.firmware,'');assert.equal(session.state.command,'idle');session.dispose();
});
test('pending result after dispose cannot publish',async()=>{
 const request=deferred(),values=[],session=new DeviceSession(createDemoSource(),{read:()=>request.promise},value=>values.push(value));
 session.connect('A');const pending=session.readFirmware(),before=values.length;session.dispose();request.resolve('old');await pending;
 assert.equal(values.length,before);
});
for(const code of ['permission_denied','unsupported','network_error'])test('classifies '+code,async()=>{
 const session=new DeviceSession(createDemoSource(),{read:async()=>{throw Object.assign(new Error(code),{code});}},()=>{});
 session.connect('A');await session.readFirmware();assert.equal(session.state.command,code==='network_error'?'failed':code);session.dispose();
});
test('repeated read while pending starts only one call',async()=>{
 const request=deferred();let count=0;const session=new DeviceSession(createDemoSource(),{read:()=>{count+=1;return request.promise;}},()=>{});
 session.connect('A');const first=session.readFirmware();await session.readFirmware();assert.equal(count,1);request.resolve('v1');await first;
 assert.equal(session.state.firmware,'v1');assert.equal(session.state.command,'success');session.dispose();
});
