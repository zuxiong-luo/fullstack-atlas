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
