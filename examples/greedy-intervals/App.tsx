import React, {useState} from 'react';

export type Interval={id:string;start:number;end:number};
export function validateIntervals(input:readonly Interval[]){
 if(input.length>10000)throw new RangeError('at most 10000 intervals');const ids=new Set<string>();
 for(let i=0;i<input.length;i++){const x=input[i];if(!Object.hasOwn(input,i)||!x||typeof x.id!=='string'||!x.id||ids.has(x.id)||!Number.isSafeInteger(x.start)||!Number.isSafeInteger(x.end)||Math.abs(x.start)>1_000_000_000||Math.abs(x.end)>1_000_000_000||x.start>=x.end)throw new RangeError('unique IDs and bounded start < end required');ids.add(x.id);}
}
const byId=(a:Interval,b:Interval)=>a.id<b.id?-1:a.id>b.id?1:0;
export type IntervalEvent={id:string;action:string;end:number;selected:string[]};
export function maximumCompatible(input:readonly Interval[],observe?:(e:IntervalEvent)=>void){
 validateIntervals(input);const sorted=[...input].sort((a,b)=>a.end-b.end||a.start-b.start||byId(a,b)),selected:Interval[]=[];let end=-Infinity;
 for(const x of sorted){const take=x.start>=end;if(take){selected.push({...x});end=x.end;}observe?.({id:x.id,action:take?'take':'skip overlap',end,selected:selected.map(v=>v.id)});}
 return selected;
}
export function mergeCoverage(input:readonly Interval[]){
 validateIntervals(input);const sorted=[...input].sort((a,b)=>a.start-b.start||a.end-b.end||byId(a,b)),out:{start:number;end:number}[]=[];
 for(const x of sorted){const last=out[out.length-1];if(last&&x.start<=last.end)last.end=Math.max(last.end,x.end);else out.push({start:x.start,end:x.end});}return out;
}
type Room={end:number;room:number};
class Rooms{
 data:Room[]=[];
 peek(){return this.data[0];}
 push(value:Room){this.data.push(value);let i=this.data.length-1;while(i){const p=Math.floor((i-1)/2);if(this.data[p].end<=this.data[i].end)break;[this.data[p],this.data[i]]=[this.data[i],this.data[p]];i=p;}}
 pop(){const first=this.data[0],last=this.data.pop()!;if(this.data.length){this.data[0]=last;let i=0;for(;;){let best=i,l=2*i+1,r=l+1;if(l<this.data.length&&this.data[l].end<this.data[best].end)best=l;if(r<this.data.length&&this.data[r].end<this.data[best].end)best=r;if(best===i)break;[this.data[i],this.data[best]]=[this.data[best],this.data[i]];i=best;}}return first;}
}
export type RoomEvent={id:string;room:number;rooms:{end:number;room:number}[]};
export function minimumRooms(input:readonly Interval[],observe?:(e:RoomEvent)=>void){
 validateIntervals(input);const sorted=[...input].sort((a,b)=>a.start-b.start||a.end-b.end||byId(a,b)),heap=new Rooms(),assignment:{id:string;room:number}[]=[];let count=0;
 for(const x of sorted){const available=heap.peek();const room=available&&available.end<=x.start?heap.pop().room:count++;heap.push({room,end:x.end});assignment.push({id:x.id,room});observe?.({id:x.id,room,rooms:heap.data.map(r=>({...r}))});}
 return {count,assignment};
}

export default function App(){
 const [raw,setRaw]=useState('[{"id":"A","start":0,"end":10},{"id":"B","start":1,"end":2},{"id":"C","start":2,"end":3},{"id":"D","start":3,"end":4}]'),[steps,setSteps]=useState<(IntervalEvent|RoomEvent)[]>([]),[step,setStep]=useState(0),[result,setResult]=useState<unknown>(null),[items,setItems]=useState<Interval[]>([]),[error,setError]=useState(''),[mode,setMode]=useState('select');
 function run(){try{const input=JSON.parse(raw);if(!Array.isArray(input)||input.length>16)throw new Error('视图最多16区间');const trace:(IntervalEvent|RoomEvent)[]=[];const answer=mode==='select'?maximumCompatible(input,e=>trace.push(e)):minimumRooms(input,e=>trace.push(e));setResult({answer,coverage:mergeCoverage(input)});setItems(input.map(x=>({...x})));setSteps(trace);setStep(0);setError('');}catch(e){setError((e as Error).message);setResult(null);setItems([]);setSteps([]);}}
 const lo=Math.min(0,...items.map(x=>x.start)),hi=Math.max(1,...items.map(x=>x.end)),x=(n:number)=>100+(n-lo)/(hi-lo)*620;
 return <main style={{padding:16,maxWidth:960,margin:'auto',fontFamily:'system-ui',color:'#173c2e'}}><h1>区间问题：目标不同，贪心规则也不同</h1><p>区间为[start,end)，接触端点不冲突。选择最多兼容项、安排最少房间、合并覆盖不是同一个问题。</p><textarea rows={5} style={{width:'100%'}} value={raw} onChange={e=>setRaw(e.target.value)}/><p><select value={mode} onChange={e=>setMode(e.target.value)}><option value="select">选择最多兼容项</option><option value="rooms">全部任务用最少房间</option></select> <button onClick={run}>建立 / 重置轨迹</button><button disabled={!steps.length||step===0} onClick={()=>setStep(s=>s-1)}>上一步</button><button disabled={!steps.length||step>=steps.length-1} onClick={()=>setStep(s=>s+1)}>下一步</button></p><p role="status">{error||`步骤 ${steps.length?step+1:0}/${steps.length}`}</p><div style={{overflowX:'auto'}}><svg viewBox={`0 0 760 ${50+items.length*40}`} style={{width:'100%',minWidth:460}} role="img" aria-label="所有输入区间的起止时间"><text x="100" y="20">{lo}</text><text x="700" y="20">{hi}</text>{items.map((v,i)=><g key={v.id}><text x="8" y={55+i*40}>{v.id}</text><line x1={x(v.start)} x2={x(v.end)} y1={50+i*40} y2={50+i*40} stroke={steps[step]?.id===v.id?'#a76008':'#285443'} strokeWidth="9"/><text x={x(v.start)} y={70+i*40} fontSize="12">[{v.start},{v.end})</text></g>)}</svg></div><pre style={{overflowX:'auto',background:'#edf5ef',padding:12}}>{JSON.stringify(steps[step]??null,null,2)}</pre><h2>最终结果</h2><pre style={{overflowX:'auto'}}>{JSON.stringify(result,null,2)}</pre><p>默认最多选B/C/D三项；全部任务需要2个房间；覆盖合并为[0,10)。这些结果没有相互矛盾。</p></main>;
}
