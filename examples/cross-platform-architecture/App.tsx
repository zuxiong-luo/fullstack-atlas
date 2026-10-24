import React, {useEffect,useRef,useState} from 'react';

export type ErrorCode='permission'|'unsupported'|'offline'|'timeout'|'protocol'|'unexpected';
export class PortFailure extends Error {
  constructor(public code:ErrorCode){super(code);}
}
export type Device={id:string;label:string;canInspect:boolean};
export type TaskResult={deviceId:string;commandId:string;summary:string};
export interface DevicePort {
  load(id:string,signal:AbortSignal):Promise<Device>;
  inspect(id:string,commandId:string,signal:AbortSignal):Promise<TaskResult>;
}
export function decodeDevice(raw:unknown,id:string):Device {
  if(!raw||typeof raw!=='object')throw new PortFailure('protocol');
  const value=raw as Record<string,unknown>;
  if(value.id!==id||typeof value.label!=='string'||!value.label||value.label.length>40||typeof value.canInspect!=='boolean')throw new PortFailure('protocol');
  return {id,label:value.label,canInspect:value.canInspect};
}
export function decodeResult(raw:unknown,id:string,commandId:string):TaskResult {
  if(!raw||typeof raw!=='object')throw new PortFailure('protocol');
  const value=raw as Record<string,unknown>;
  if(value.deviceId!==id||value.commandId!==commandId||typeof value.summary!=='string'||!value.summary||value.summary.length>120)throw new PortFailure('protocol');
  return {deviceId:id,commandId,summary:value.summary};
}
export const errorMessages:Record<ErrorCode,string>={
  permission:'没有设备权限，请在宿主设置中检查授权',unsupported:'当前宿主没有实现该能力',
  offline:'设备不可达，请确认连接',timeout:'设备适配器报告超时，请查询当前状态',
  protocol:'设备返回格式或请求归属不符合约定',unexpected:'操作失败，请查看受控诊断日志',
};
export function uiError(error:unknown):{code:ErrorCode;message:string}{
  const code=error instanceof PortFailure&&Object.hasOwn(errorMessages,error.code)?error.code:'unexpected';
  return {code,message:errorMessages[code]};
}
export type ViewState={
  deviceId:string|null;connection:'idle'|'loading'|'ready'|'error';label:string|null;canInspect:boolean;
  command:'idle'|'running'|'success'|'error';result:string|null;
  connectionError:ReturnType<typeof uiError>|null;commandError:ReturnType<typeof uiError>|null;
};
export function initialState():ViewState{return {deviceId:null,connection:'idle',label:null,canInspect:false,command:'idle',result:null,connectionError:null,commandError:null};}
export class DeviceController {
  private epoch=0;
  private active:AbortController|null=null;
  private closed=false;
  private state=initialState();
  constructor(private port:DevicePort,private publish:(state:ViewState)=>void=()=>{}){}
  get snapshot():ViewState{return {...this.state,connectionError:this.state.connectionError?{...this.state.connectionError}:null,commandError:this.state.commandError?{...this.state.commandError}:null};}
  private emit(change:Partial<ViewState>){this.state={...this.state,...change};this.publish(this.snapshot);}
  private invalidate(){this.epoch+=1;const old=this.active;this.active=null;old?.abort();return this.epoch;}
  private owns(epoch:number,id:string,signal:AbortSignal){return !this.closed&&epoch===this.epoch&&id===this.state.deviceId&&!signal.aborted;}
  async connect(id:string):Promise<void>{
    if(this.closed)return;
    if(!/^[a-zA-Z0-9_-]{1,32}$/.test(id))throw new RangeError('invalid device id');
    const epoch=this.invalidate(),controller=new AbortController();this.active=controller;
    this.emit({...initialState(),deviceId:id,connection:'loading'});
    try{
      const device=await this.port.load(id,controller.signal);
      if(!this.owns(epoch,id,controller.signal))return;
      if(device.id!==id)throw new PortFailure('protocol');
      this.emit({connection:'ready',label:device.label,canInspect:device.canInspect});
    }catch(error){if(this.owns(epoch,id,controller.signal))this.emit({connection:'error',connectionError:uiError(error)});}
    finally{if(this.active===controller)this.active=null;}
  }
  async inspect():Promise<boolean>{
    if(this.closed||this.state.connection!=='ready'||!this.state.canInspect||this.state.command==='running')return false;
    const id=this.state.deviceId!,epoch=this.invalidate(),controller=new AbortController();this.active=controller;
    const commandId=`${id}:${epoch}`; // Page-session correlation only, not a durable idempotency key.
    this.emit({command:'running',result:null,commandError:null});
    try{
      const result=await this.port.inspect(id,commandId,controller.signal);
      if(!this.owns(epoch,id,controller.signal))return false;
      if(result.deviceId!==id||result.commandId!==commandId)throw new PortFailure('protocol');
      this.emit({command:'success',result:result.summary});return true;
    }catch(error){if(this.owns(epoch,id,controller.signal))this.emit({command:'error',commandError:uiError(error)});return false;}
    finally{if(this.active===controller)this.active=null;}
  }
  cancel(){
    if(this.closed)return;
    this.invalidate();const ready=this.state.connection==='ready';
    this.emit({connection:ready?'ready':'idle',label:ready?this.state.label:null,canInspect:ready&&this.state.canInspect,command:'idle',result:null,connectionError:null,commandError:null});
  }
  dispose(){if(this.closed)return;this.invalidate();this.closed=true;this.publish=()=>{};}
}

// Explicitly simulated: these timers never connect to hardware or native permissions.
export class TimerDeviceAdapter implements DevicePort {
  respectCancellation=true;
  pending=0;
  cancelled=0;
  private wait(ms:number,signal:AbortSignal){
    const respect=this.respectCancellation;this.pending+=1;
    return new Promise<void>((resolve,reject)=>{
      let settled=false;
      const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);this.pending-=1;if(error)reject(error);else resolve();};
      const abort=()=>{this.cancelled+=1;finish(new Error('simulated abort'));};
      const timer=setTimeout(()=>finish(),ms);
      if(respect){if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});}
    });
  }
  async load(id:string,signal:AbortSignal){
    await this.wait(id==='A'?800:120,signal);
    if(id==='denied')throw new PortFailure('permission');
    return decodeDevice({id,label:'模拟设备 '+id,canInspect:id!=='readonly'},id);
  }
  async inspect(id:string,commandId:string,signal:AbortSignal){
    await this.wait(500,signal);
    return decodeResult({deviceId:id,commandId,summary:'模拟巡检完成：'+id},id,commandId);
  }
}

export default function App(){
  const [state,setState]=useState(initialState);
  const [respect,setRespect]=useState(true);
  const controller=useRef<DeviceController|null>(null),adapter=useRef<TimerDeviceAdapter|null>(null);
  useEffect(()=>{
    const source=new TimerDeviceAdapter(),owner=new DeviceController(source,setState);
    adapter.current=source;controller.current=owner;void owner.connect('A');
    return()=>{controller.current=null;adapter.current=null;owner.dispose();};
  },[]);
  return <main style={{fontFamily:'system-ui',padding:20,lineHeight:1.6,maxWidth:720}}>
    <h1>设备任务 · 架构实验</h1><p>全部数据来自本地计时器，不是蓝牙、RN 或 Flutter 真机。</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{['A','B','readonly','denied'].map(id=><button key={id} onClick={()=>void controller.current?.connect(id)}>选择 {id}</button>)}</div>
    <label><input type="checkbox" checked={respect} onChange={event=>{const value=event.target.checked;setRespect(value);if(adapter.current)adapter.current.respectCancellation=value;}}/>新操作遵守取消（取消勾选可观察晚到结果）</label>
    <p>选中：{state.deviceId??'无'} · 连接：{state.connection} · 命令：{state.command}</p>
    <p>{state.label??'尚未取得当前设备数据'}</p>
    <button disabled={state.connection!=='ready'||!state.canInspect||state.command==='running'} onClick={()=>void controller.current?.inspect()}>模拟只读巡检</button>{' '}
    <button onClick={()=>controller.current?.cancel()}>取消当前操作</button>
    <p role="status">{state.connectionError?.message??state.commandError?.message??state.result??'等待操作'}</p>
    <p>实验：先取消勾选，选择 A 后迅速选择 B。B 先完成，A 晚到也不得覆盖 B。</p>
  </main>;
}
