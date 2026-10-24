import React, {useState} from 'react';

export function numbers(a:readonly number[],positive=false){
  if(a.length>1_000_000)throw new RangeError('at most one million values');
  for(let i=0;i<a.length;i++)if(!Object.hasOwn(a,i)||!Number.isSafeInteger(a[i])||Math.abs(a[i])>1_000_000_000||(positive&&a[i]<=0))throw new RangeError('dense bounded integers required');
}
export type WindowEvent={action:string;left:number;right:number;sum?:number;deque?:number[];best?:number;output?:number[]};
export type Observe=(event:WindowEvent)=>void;
export function minPositiveWindow(a:readonly number[],target:number,observe?:Observe){
  numbers(a,true);if(!Number.isSafeInteger(target)||target<=0)throw new RangeError('positive safe target required');
  let left=0,sum=0,best=Infinity,start=-1,end=-1,moves=0;
  for(let right=0;right<a.length;right++){
    sum+=a[right];moves++;observe?.({action:'expand',left,right,sum,best});
    while(sum>=target){
      if(right-left+1<best){best=right-left+1;start=left;end=right+1;}
      sum-=a[left++];moves++;observe?.({action:'shrink',left,right,sum,best});
    }
  }
  return {length:best===Infinity?0:best,start,end,moves};
}
export function windowMax(a:readonly number[],k:number,observe?:Observe){
  numbers(a);if(!Number.isInteger(k)||k<1||k>a.length)throw new RangeError('1 <= k <= length required');
  const ring=new Array<number>(k),output:number[]=[];let head=0,size=0,pushes=0,removals=0;
  const at=(i:number)=>ring[(head+i)%k];
  const snapshot=()=>Array.from({length:size},(_,i)=>at(i));
  for(let right=0;right<a.length;right++){
    const left=right-k+1;
    while(size&&at(0)<left){head=(head+1)%k;size--;removals++;}
    while(size&&a[at(size-1)]<=a[right]){size--;removals++;}
    ring[(head+size)%k]=right;size++;pushes++;
    if(left>=0)output.push(a[at(0)]);
    observe?.({action:left>=0?'emit':'fill',left:Math.max(0,left),right,deque:snapshot(),output:[...output]});
  }
  return {output,pushes,removals};
}
export type StackEvent={index:number;action:string;stack:number[];next:number[]};
export function nextGreater(a:readonly number[],observe?:(event:StackEvent)=>void){
  numbers(a);const stack:number[]=[],next=new Array<number>(a.length).fill(-1);let pushes=0,pops=0;
  for(let i=0;i<a.length;i++){
    while(stack.length&&a[stack[stack.length-1]]<a[i]){next[stack.pop()!]=i;pops++;}
    stack.push(i);pushes++;observe?.({index:i,action:'resolve then push',stack:[...stack],next:[...next]});
  }
  return {next,pushes,pops};
}

export default function App(){
 const [raw,setRaw]=useState('1,3,-1,-3,5,3,6,7'),[param,setParam]=useState('3'),[mode,setMode]=useState('max'),[steps,setSteps]=useState<unknown[]>([]),[step,setStep]=useState(0),[result,setResult]=useState<unknown>(null),[error,setError]=useState('');
 function prepare(){try{const a=raw.trim()?raw.split(',').map(x=>{if(!x.trim())throw new Error('不允许空项');return Number(x);}):[];if(a.length>32)throw new Error('视图最多32项');const trace:unknown[]=[];let answer;if(mode==='max')answer=windowMax(a,Number(param),e=>trace.push(e));else if(mode==='min')answer=minPositiveWindow(a,Number(param),e=>trace.push(e));else answer=nextGreater(a,e=>trace.push(e));setSteps(trace);setResult(answer);setStep(0);setError('');}catch(e){setError((e as Error).message);setSteps([]);setResult(null);}}
 const current=steps.length?steps[Math.min(step,steps.length-1)]:null;
 return <main style={{padding:16,maxWidth:960,margin:'auto',fontFamily:'system-ui',color:'#173c2e'}}><h1>窗口与单调结构：观察删除依据</h1><p>先建立轨迹，再逐步观察。max为固定宽度最大值，min只接受正整数，next给出右侧首个严格更大项的下标。</p><label>模式 <select value={mode} onChange={e=>{setMode(e.target.value);setSteps([]);setResult(null);}}><option value="max">固定窗口最大值</option><option value="min">正数最短达标窗口</option><option value="next">下一个严格更大</option></select></label><p><label>数组 <input style={{width:'min(100%,420px)'}} value={raw} onChange={e=>setRaw(e.target.value)}/></label></p>{mode!=='next'&&<p><label>{mode==='max'?'宽度 k':'目标 target'} <input value={param} onChange={e=>setParam(e.target.value)} style={{width:100}}/></label></p>}<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={prepare}>建立 / 重置轨迹</button><button onClick={()=>{setRaw('2,3,1,2,4,3');setParam('7');setMode('min');setSteps([]);setResult(null);}}>载入正数示例</button><button disabled={!steps.length||step>=steps.length-1} onClick={()=>setStep(x=>x+1)}>下一步</button><button disabled={!steps.length||step===0} onClick={()=>setStep(x=>x-1)}>上一步</button></div><p role="status">{error||`步骤 ${steps.length?step+1:0}/${steps.length}；先看下标，再看值。`}</p><h2>当前边界与候选</h2><pre style={{overflowX:'auto',background:'#edf5ef',padding:12}}>{JSON.stringify(current,(_,v)=>v===Infinity?'尚无解':v,2)}</pre><h2>最终结果与基础操作计数</h2><pre style={{overflowX:'auto'}}>{JSON.stringify(result,null,2)}</pre><p>轨迹保存数组快照，额外成本不属于无观察回调的算法。改变输入后请重新建立轨迹；先前轨迹是上一次参数快照。</p></main>;
}
