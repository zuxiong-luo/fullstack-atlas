import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import App from './dist/App.js';
import {DeviceController,PortFailure,decodeDevice,decodeResult,uiError} from './dist/core.js';
import {TimerDeviceAdapter} from './dist/demo-adapter.js';
import {readFile} from 'node:fs/promises';
class ControlledPort {
  loads=[];commands=[];
  load(id,signal){return new Promise((resolve,reject)=>this.loads.push({id,signal,resolve,reject}));}
  inspect(id,commandId,signal){return new Promise((resolve,reject)=>this.commands.push({id,commandId,signal,resolve,reject}));}
}
const device=(id,canInspect=true)=>({id,label:'device '+id,canInspect});
async function ready(controller,port,id='A',canInspect=true){const pending=controller.connect(id);port.loads.at(-1).resolve(device(id,canInspect));await pending;}
test('wire decoding accepts the explicit normal DTO',()=>{
 assert.deepEqual(decodeDevice({id:'A',label:'device A',canInspect:true},'A'),device('A'));
});
test('invalid wire records and task correlation cannot cross the adapter',()=>{
 for(const raw of [null,{}, {id:'B',label:'B',canInspect:true},{id:'A',label:'A',canInspect:'yes'}])assert.throws(()=>decodeDevice(raw,'A'),PortFailure);
 assert.throws(()=>decodeResult({deviceId:'B',commandId:'A:1',summary:'ok'},'A','A:1'),PortFailure);
 assert.throws(()=>decodeResult({deviceId:'A',commandId:'old',summary:'ok'},'A','A:1'),PortFailure);
});
test('connection normal path publishes loading then ready',async()=>{
 const port=new ControlledPort(),seen=[],controller=new DeviceController(port,state=>seen.push(state));
 await ready(controller,port);
 assert.deepEqual(seen.map(state=>state.connection),['loading','ready']);assert.equal(controller.snapshot.label,'device A');controller.dispose();
});
test('switch aborts old load and ignores its late success',async()=>{
 const port=new ControlledPort(),controller=new DeviceController(port);
 const a=controller.connect('A'),b=controller.connect('B');assert.equal(port.loads[0].signal.aborted,true);
 port.loads[1].resolve(device('B'));await b;port.loads[0].resolve(device('A'));await a;
 assert.equal(controller.snapshot.deviceId,'B');assert.equal(controller.snapshot.label,'device B');controller.dispose();
});
test('same-device retry also rejects an older generation',async()=>{
 const port=new ControlledPort(),controller=new DeviceController(port);
 const old=controller.connect('A'),fresh=controller.connect('A');port.loads[1].resolve({...device('A'),label:'fresh'});await fresh;
 port.loads[0].resolve({...device('A'),label:'stale'});await old;assert.equal(controller.snapshot.label,'fresh');controller.dispose();
});
test('explicit cancellation invalidates an ignored late result',async()=>{
 const port=new ControlledPort(),controller=new DeviceController(port);
 const pending=controller.connect('A');controller.cancel();assert.equal(controller.snapshot.connection,'idle');
 port.loads[0].resolve(device('A'));await pending;assert.equal(controller.snapshot.connection,'idle');controller.dispose();
});
test('command success is correlated and duplicate starts are suppressed',async()=>{
 const port=new ControlledPort(),controller=new DeviceController(port);assert.equal(await controller.inspect(),false);
 await ready(controller,port);const first=controller.inspect();assert.equal(await controller.inspect(),false);assert.equal(port.commands.length,1);
 const command=port.commands[0];command.resolve({deviceId:'A',commandId:command.commandId,summary:'inspected A'});assert.equal(await first,true);
 assert.equal(controller.snapshot.command,'success');assert.equal(controller.snapshot.result,'inspected A');controller.dispose();
});
test('capability is enforced in the controller rather than only the disabled button',async()=>{
 const port=new ControlledPort(),controller=new DeviceController(port);await ready(controller,port,'readonly',false);
 assert.equal(await controller.inspect(),false);assert.equal(port.commands.length,0);controller.dispose();
});
test('switching invalidates a pending command without contaminating the next device',async()=>{
 const port=new ControlledPort(),controller=new DeviceController(port);await ready(controller,port);
 const command=controller.inspect(),load=controller.connect('B'),entry=port.commands[0];assert.equal(entry.signal.aborted,true);
 entry.resolve({deviceId:'A',commandId:entry.commandId,summary:'late A'});assert.equal(await command,false);
 assert.equal(controller.snapshot.connection,'loading');assert.equal(controller.snapshot.result,null);
 port.loads[1].resolve(device('B'));await load;assert.equal(controller.snapshot.label,'device B');controller.dispose();
});
test('known port failures map to bounded UI errors and unknown details stay private',async()=>{
 for(const code of ['permission','unsupported','offline','timeout','protocol']){
  const port=new ControlledPort(),controller=new DeviceController(port);const pending=controller.connect('A');port.loads[0].reject(new PortFailure(code));await pending;
  assert.equal(controller.snapshot.connectionError.code,code);controller.dispose();
 }
 assert.equal(uiError(new Error('secret://device-token')).code,'unexpected');assert.doesNotMatch(uiError(new Error('secret')).message,/secret/);
});
test('dispose is idempotent and suppresses late failures and future work',async()=>{
 const port=new ControlledPort(),seen=[],controller=new DeviceController(port,state=>seen.push(state));const pending=controller.connect('A');
 controller.dispose();controller.dispose();port.loads[0].reject(new Error('late'));await pending;
 await controller.connect('B');assert.equal(await controller.inspect(),false);assert.equal(port.loads.length,1);assert.equal(seen.length,1);
});
test('view snapshots do not let observers rewrite controller errors',async()=>{
 const port=new ControlledPort(),controller=new DeviceController(port);const pending=controller.connect('A');port.loads[0].reject(new PortFailure('offline'));await pending;
 const snapshot=controller.snapshot;snapshot.connectionError.message='rewritten';snapshot.deviceId='B';
 assert.equal(controller.snapshot.deviceId,'A');assert.notEqual(controller.snapshot.connectionError.message,'rewritten');controller.dispose();
});
test('simulated adapter releases its timer when cancellation is supported',async()=>{
 const adapter=new TimerDeviceAdapter(),controller=new AbortController(),pending=adapter.load('A',controller.signal);
 const rejected=assert.rejects(pending,/simulated abort/);assert.equal(adapter.pending,1);controller.abort();await rejected;
 assert.equal(adapter.pending,0);assert.equal(adapter.cancelled,1);
});
test('SSR smoke renders the React 18 teaching view without starting device timers',()=>{
 const html=renderToStaticMarkup(React.createElement(App));assert.match(html,/不是蓝牙/);assert.match(html,/模拟只读巡检/);
});

test('standalone browser source contains the exact domain and adapter bodies',async()=>{
 const core=await readFile(new URL('./core.ts',import.meta.url),'utf8');
 const adapter=(await readFile(new URL('./demo-adapter.ts',import.meta.url),'utf8')).split('\n').filter(line=>!line.startsWith('import ')).join('\n').trim();
 const app=await readFile(new URL('./App.tsx',import.meta.url),'utf8');
 assert.ok(app.includes(core));assert.ok(app.includes(adapter));
 const imports=app.split('\n').filter(line=>line.startsWith('import '));assert.equal(imports.length,1);assert.match(imports[0],/from 'react'/);
});
test('controller also rejects wrong-device results from a broken port implementation',async()=>{
 const port=new ControlledPort(),controller=new DeviceController(port);const bad=controller.connect('A');port.loads[0].resolve(device('B'));await bad;
 assert.equal(controller.snapshot.connectionError.code,'protocol');
 await ready(controller,port,'A');const pending=controller.inspect(),entry=port.commands[0];entry.resolve({deviceId:'A',commandId:'wrong',summary:'bad'});assert.equal(await pending,false);
 assert.equal(controller.snapshot.connection,'ready');assert.equal(controller.snapshot.commandError.code,'protocol');controller.dispose();
});
test('cancelling a command preserves a loaded device and suppresses its late result',async()=>{
 const port=new ControlledPort(),controller=new DeviceController(port);await ready(controller,port);const pending=controller.inspect(),entry=port.commands[0];controller.cancel();
 assert.equal(controller.snapshot.connection,'ready');assert.equal(controller.snapshot.command,'idle');assert.equal(entry.signal.aborted,true);
 entry.resolve({deviceId:'A',commandId:entry.commandId,summary:'too late'});await pending;
 assert.equal(controller.snapshot.result,null);assert.equal(controller.snapshot.command,'idle');controller.dispose();
});
