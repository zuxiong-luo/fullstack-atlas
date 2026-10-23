import React, {useMemo, useState} from 'react';
// Fast search assumes finite, nondecreasing inputs. Validation belongs to the boundary.
export function validateSorted(values: number[], target: number) {
  if (!Number.isFinite(target) || values.some(v => !Number.isFinite(v))) throw new Error('只接受有限数值');
  if (values.some((v,i) => i > 0 && values[i-1] > v)) throw new Error('二分前提：数组必须非递减有序');
}
export function linearLowerBound(values: number[], target: number): number {
  const index = values.findIndex(value => value >= target);
  return index === -1 ? values.length : index;
}
export function lowerBound(values: number[], target: number): number {
  let lo=0, hi=values.length;
  while (lo<hi) {
    const mid=lo+Math.floor((hi-lo)/2);
    if (values[mid]<target) lo=mid+1;
    else hi=mid;
  }
  return lo;
}
export type Step={lo:number;hi:number;mid:number|null;note:string};
export function traceLowerBound(values:number[], target:number):Step[] {
  validateSorted(values,target);
  let lo=0,hi=values.length;
  const steps:Step[]=[];
  while(lo<hi) {
    const mid=lo+Math.floor((hi-lo)/2);
    steps.push({lo,hi,mid,note:values[mid]<target?`${values[mid]} < ${target}：下一步 lo=${mid+1}`:`${values[mid]} ≥ ${target}：下一步 hi=${mid}`});
    if(values[mid]<target) lo=mid+1; else hi=mid;
  }
  steps.push({lo,hi,mid:null,note:`区间为空，插入位置=${lo}`});
  return steps;
}
// Unicode code-point length, not UTF-16 code-unit or grapheme-cluster length.
export function longestUnique(text:string):number {
  const chars=Array.from(text),last=new Map<string,number>();
  let left=0,best=0;
  for(let right=0;right<chars.length;right++) {
    const prior=last.get(chars[right]);
    if(prior!==undefined)left=Math.max(left,prior+1);
    last.set(chars[right],right);
    best=Math.max(best,right-left+1);
  }
  return best;
}
export function bfs(graph:Map<string,string[]>,start:string) {
  if(!graph.has(start))throw new Error('起点不在图中');
  const queue=[start],distance=new Map([[start,0]]),parent=new Map<string,string|null>([[start,null]]);
  for(let head=0;head<queue.length;head++) {
    const node=queue[head];
    for(const next of graph.get(node)??[]) {
      if(!graph.has(next))throw new Error('邻接点不在图中');
      if(distance.has(next))continue;
      distance.set(next,distance.get(node)!+1); // Mark on enqueue, not on dequeue.
      parent.set(next,node); queue.push(next);
    }
  }
  return {distance,parent,order:queue};
}
export function minCoins(coins:number[],amount:number):number {
  if(!Number.isSafeInteger(amount)||amount<0||amount>10000)throw new Error('金额需为0到10000整数');
  if(coins.some(c=>!Number.isSafeInteger(c)||c<=0))throw new Error('面额需为正整数');
  const dp=Array<number>(amount+1).fill(Infinity);dp[0]=0;
  for(let sum=1;sum<=amount;sum++)for(const coin of coins) {
    if(coin<=sum)dp[sum]=Math.min(dp[sum],dp[sum-coin]+1);
  }
  return Number.isFinite(dp[amount])?dp[amount]:-1;
}
export default function App() {
  const [input,setInput]=useState('1,2,2,4'),[target,setTarget]=useState('2'),[index,setIndex]=useState(0);
  const result=useMemo(()=>{
    try {
      const values=input.trim()===''?[]:input.split(',').map(part=>{if(!part.trim())throw new Error('数值之间不要留空项');return Number(part);});
      if(values.length>30)throw new Error('步进演示最多30项');
      if(!target.trim())throw new Error('请输入目标值');
      const numeric=Number(target);return {values,steps:traceLowerBound(values,numeric),error:''};
    }catch(error){return {values:[] as number[],steps:[] as Step[],error:String(error)}}
  },[input,target]);
  const position=Math.min(index,Math.max(0,result.steps.length-1)),step=result.steps[position];
  return <main style={{padding:20,fontFamily:'system-ui',maxWidth:900,margin:'auto',lineHeight:1.7}}>
    <h2>lower_bound：区间一步一步缩小</h2>
    <p>目标：找到第一个 ≥ target 的位置；返回长度n表示放在末尾。下方展示的是本轮判断之前的 [lo,hi)。</p>
    <label>非递减数组 <input value={input} onChange={e=>{setInput(e.target.value);setIndex(0)}} style={{width:'min(100%,24rem)'}}/></label>{' '}
    <label>target <input type="number" value={target} onChange={e=>{setTarget(e.target.value);setIndex(0)}} style={{width:100}}/></label>
    {result.error?<p role="alert">{result.error}</p>:<>
      <p><button disabled={position===0} onClick={()=>setIndex(n=>n-1)}>上一步</button>{' '}<button disabled={position>=result.steps.length-1} onClick={()=>setIndex(n=>n+1)}>下一步</button>{' '}<button onClick={()=>setIndex(0)}>重置</button></p>
      <p role="status">步骤{position+1}/{result.steps.length}；lo={step.lo}，hi={step.hi}，mid={step.mid??'结束'}；{step.note}</p>
      <div style={{display:'flex',gap:8,overflowX:'auto',padding:8}}>{result.values.map((value,i)=><div key={i} style={{minWidth:65,padding:8,border:i===step.mid?'3px solid #b45b14':'1px solid #789183',background:i>=step.lo&&i<step.hi?'#dcece0':'#f0f0f0',color:'#173b2d'}}><strong>{value}</strong><br/>index {i}<br/>{i===step.mid?'mid':i<step.lo?'< target':i>=step.hi?'≥ target':'待判断'}</div>)}<div style={{minWidth:65,padding:8}}>末尾<br/>index {result.values.length}</div></div>
      <p>区间内只是待判断，不代表全都等于target；lo左边已知小于，hi及右边已知大于等于。末尾标记不是数组元素。</p>
    </>}
    <p>其他完整算法在本文件导出：longestUnique('abba')={longestUnique('abba')}；minCoins([1,3,4],6)={minCoins([1,3,4],6)}。交互步进只负责二分，不伪装成通用可视化器。</p>
  </main>;
}
