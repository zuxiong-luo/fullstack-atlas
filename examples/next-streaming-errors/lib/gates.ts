import 'server-only';
type Gate={mode:'ok'|'fail-once';reads:number;failureUsed:boolean;released:boolean;timedOut:boolean;promise:Promise<void>;release:()=>void;timer:ReturnType<typeof setTimeout>};
const shared=globalThis as typeof globalThis&{__atlasStreamGates?:Map<string,Gate>};
const gates=shared.__atlasStreamGates??=new Map<string,Gate>();
export const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-z0-9-]{1,40}$/.test(id);
export function initialize(id:string,mode:Gate['mode'],timeoutMs=30000){
  if(!validId(id)||!['ok','fail-once'].includes(mode)||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)throw new Error('BAD_INPUT');
  const old=gates.get(id);if(old&&!old.released)throw new Error('GATE_BUSY');
  if(!old&&gates.size>=32)throw new Error('LAB_CAPACITY');
  if(old)clearTimeout(old.timer);
  let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});
  const gate:Gate={mode,reads:0,failureUsed:false,released:false,timedOut:false,promise,release(){if(gate.released)return;gate.released=true;clearTimeout(gate.timer);resolve();},timer:undefined as unknown as ReturnType<typeof setTimeout>};
  gate.timer=setTimeout(()=>{gate.timedOut=true;gate.release();},timeoutMs);gate.timer.unref();gates.set(id,gate);
}
export function release(id:string){const gate=gates.get(id);if(!gate)throw new Error('NOT_FOUND');gate.release();}
export function state(id:string){const gate=gates.get(id);return gate?{reads:gate.reads,released:gate.released,timedOut:gate.timedOut,failureUsed:gate.failureUsed}:null;}
export async function readReport(id:string){
  const gate=gates.get(id);if(!gate)throw new Error('NOT_FOUND');
  gate.reads++;await gate.promise;
  if(gate.timedOut)throw new Error('INTERNAL_GATE_TIMEOUT');
  if(gate.mode==='fail-once'&&!gate.failureUsed){gate.failureUsed=true;throw new Error('INTERNAL_ONCE_FAILURE_DO_NOT_SEND');}
  return {id,title:'REPORT_READY',reads:gate.reads};
}
