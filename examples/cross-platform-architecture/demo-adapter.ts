import {PortFailure,decodeDevice,decodeResult} from './core.js';
import type {DevicePort} from './core.js';

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
