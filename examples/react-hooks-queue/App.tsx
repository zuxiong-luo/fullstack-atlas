import React, {useState, useTransition, useLayoutEffect} from 'react';
// 教学模型：显式指定 lane，无 Scheduler、Fiber、eager state 或异常恢复。
export type Update={label:string;lane:0|1|2;apply:(n:number)=>number};
export type Ring={update:Update;next:Ring};
export function append(tail:Ring|null,update:Update):Ring {
  const node={update} as Ring;node.next=tail?tail.next:node;
  if(tail)tail.next=node;return node;
}
export function entries(tail:Ring|null):Update[]{
  if(!tail)return [];const result:Update[]=[];let node=tail.next;
  do{result.push(node.update);node=node.next;}while(node!==tail.next);return result;
}
export function rebase(baseState:number,queue:Update[],renderLanes:number){
  let state=baseState,newBaseState=baseState,skipped=false;
  const retained:Update[]=[],trace:string[]=[];
  for(const update of queue){
    if((renderLanes&update.lane)!==update.lane){
      if(!skipped)newBaseState=state;
      skipped=true;retained.push({...update});trace.push(`跳过 ${update.label}；保留原 lane=${update.lane}`);
    }else{
      if(skipped)retained.push({...update,lane:0});
      const before=state;state=update.apply(state);
      trace.push(`${before} → ${update.label} → ${state}${skipped?'；复制为 lane=0 以便重放':''}`);
    }
  }
  return {state,baseState:skipped?newBaseState:state,queue:retained,trace};
}
const initial:Update[]=[{label:'+10',lane:2,apply:n=>n+10},{label:'×2',lane:1,apply:n=>n*2}];
function Model(){
  const [step,setStep]=useState(0);let ring:Ring|null=null;for(const update of initial)ring=append(ring,update);
  const urgent=rebase(1,entries(ring),1),eventual=rebase(urgent.baseState,urgent.queue,2);
  const frame=step===0?{state:1,baseState:1,queue:initial,trace:['初始：低优先级 +10 先入队，紧急 ×2 后入队。']}:step===1?urgent:eventual;
  return <section><h3>教学模型：手动选择本轮处理的 Lane</h3><p>这里不是 React 内部状态。lane 1=紧急，2=延后，0=重放时不可跳过。</p><button onClick={()=>setStep(0)}>重置模型</button> <button disabled={step===2} onClick={()=>setStep(s=>s+1)}>下一轮</button><p>第 {step} 轮；显示值 {frame.state}；基础值 {frame.baseState}</p><p>保留队列：{frame.queue.map(u=>`${u.label} [lane ${u.lane}]`).join(' → ')||'空'}</p><ol>{frame.trace.map((line,i)=><li key={i}>{line}</li>)}</ol></section>;
}
function Actual(){
  const [n,setN]=useState(1);const [pending,startTransition]=useTransition();
  useLayoutEffect(()=>{console.log('[真实 React 提交观察]',{n,pending});},[n,pending]);
  return <section><h3>真实 React 18.3.1：观察结果和提交</h3><p role="status">当前值 {n}；pending={String(pending)}</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
    <button onClick={()=>setN(1)}>重置为 1</button>
    <button onClick={()=>{setN(n+1);setN(n+1);setN(n+1);}}>值更新 +1 三次</button>
    <button onClick={()=>{setN(x=>x+1);setN(x=>x+1);setN(x=>x+1);}}>函数更新 +1 三次</button>
    <button disabled={pending} onClick={()=>{startTransition(()=>setN(x=>x+10));setN(x=>x*2);}}>延后 +10，再紧急 ×2</button>
    <button onClick={()=>setN(x=>x)}>相同值更新</button>
  </div><p>每次比较先重置。值更新得到 2，函数更新得到 4；跨优先级更新最终得到 22。中间的 2 不一定被浏览器绘制；控制台记录布局 Effect 的观察点，不是 render 次数。</p></section>;
}
export default function App(){return <main style={{fontFamily:'system-ui',maxWidth:850,margin:'auto',padding:20,lineHeight:1.7}}><h2>为什么跳过 +10 后，最终仍然是 22？</h2><Actual/><hr/><Model/><p>模型把调度选择变成按钮，方便逐步推导；真正 React 的队列和调度请对照文章固定版本源码。</p></main>;}
