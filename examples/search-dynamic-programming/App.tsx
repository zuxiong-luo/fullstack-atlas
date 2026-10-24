import React, {useState} from 'react';

export type Item={id:string;weight:number;value:number};
export function validateItems(items:readonly Item[],capacity:number){
 if(!Number.isInteger(capacity)||capacity<0||capacity>2000||items.length>200)throw new RangeError('capacity 0..2000, at most 200 items');const ids=new Set<string>();
 for(let i=0;i<items.length;i++){const x=items[i];if(!Object.hasOwn(items,i)||!x||typeof x.id!=='string'||!x.id||ids.has(x.id)||!Number.isInteger(x.weight)||x.weight<1||x.weight>2000||!Number.isSafeInteger(x.value)||x.value<0||x.value>1_000_000)throw new RangeError('unique IDs, positive weights and bounded values required');ids.add(x.id);}
}
export type SearchEvent={i:number;remaining:number;value:number;action:string;path?:string[]};
export function backtrackKnapsack(items:readonly Item[],capacity:number,observe?:(e:SearchEvent)=>void){
 validateItems(items,capacity);if(items.length>20)throw new RangeError('backtracking demo at most 20 items');const path:string[]=[],best:{value:number;ids:string[]}={value:0,ids:[]};let calls=0;
 function visit(i:number,remaining:number,value:number){if(++calls>250000)throw new RangeError('search call budget exceeded');if(i===items.length){if(value>best.value){best.value=value;best.ids=[...path];}observe?.({i,remaining,value,action:'leaf',path:[...path]});return;}
  visit(i+1,remaining,value);const item=items[i];if(item.weight<=remaining){path.push(item.id);try{visit(i+1,remaining-item.weight,value+item.value);}finally{path.pop();}}
 }
 visit(0,capacity,0);return {...best,calls};
}
export function topDownKnapsack(items:readonly Item[],capacity:number,memoized=true,observe?:(e:SearchEvent)=>void){
 validateItems(items,capacity);if(items.length>100)throw new RangeError('top-down depth budget 100 items');if(!memoized&&items.length>20)throw new RangeError('plain recursion demo at most 20 items');const memo=new Map<string,number>();let calls=0,hits=0,computed=0;
 function value(i:number,c:number):number{if(++calls>250000)throw new RangeError('search call budget exceeded');if(i===items.length)return 0;const key=i+':'+c;if(memoized&&memo.has(key)){hits++;const answer=memo.get(key)!;observe?.({i,remaining:c,value:answer,action:'memo hit'});return answer;}
  const item=items[i],skip=value(i+1,c),take=item.weight<=c?item.value+value(i+1,c-item.weight):-Infinity,answer=Math.max(skip,take);computed++;if(memoized)memo.set(key,answer);observe?.({i,remaining:c,value:answer,action:'computed'});return answer;
 }
 return {value:value(0,capacity),calls,hits,computed,states:memo.size};
}
export function tableKnapsack(items:readonly Item[],capacity:number){
 validateItems(items,capacity);const table=Array.from({length:items.length+1},()=>new Array<number>(capacity+1).fill(0));
 for(let i=1;i<=items.length;i++){const item=items[i-1];for(let c=0;c<=capacity;c++){table[i][c]=table[i-1][c];if(item.weight<=c)table[i][c]=Math.max(table[i][c],item.value+table[i-1][c-item.weight]);}}
 const ids:string[]=[];let c=capacity;for(let i=items.length;i>0;i--)if(table[i][c]!==table[i-1][c]){const item=items[i-1];ids.push(item.id);c-=item.weight;}
 return {value:table[items.length][capacity],ids:ids.reverse(),table};
}
export function compactKnapsack(items:readonly Item[],capacity:number){
 validateItems(items,capacity);const best=new Array<number>(capacity+1).fill(0);for(const item of items)for(let c=capacity;c>=item.weight;c--)best[c]=Math.max(best[c],item.value+best[c-item.weight]);return best[capacity];
}

export default function App(){
 const [raw,setRaw]=useState('[{"id":"A","weight":2,"value":3},{"id":"B","weight":3,"value":4},{"id":"C","weight":4,"value":5},{"id":"D","weight":2,"value":3}]'),[cap,setCap]=useState('6'),[mode,setMode]=useState('memo'),[steps,setSteps]=useState<SearchEvent[]>([]),[step,setStep]=useState(0),[result,setResult]=useState<unknown>(null),[table,setTable]=useState<number[][]>([]),[error,setError]=useState('');
 function run(){try{const items=JSON.parse(raw),capacity=Number(cap);if(!Array.isArray(items)||items.length>12||capacity>30)throw new Error('视图最多12件，容量最多30');const trace:SearchEvent[]=[];const answer=mode==='backtrack'?backtrackKnapsack(items,capacity,e=>trace.push(e)):topDownKnapsack(items,capacity,mode==='memo',e=>trace.push(e));const dp=tableKnapsack(items,capacity);setResult({search:answer,bottomUp:{value:dp.value,ids:dp.ids},compact:compactKnapsack(items,capacity)});setTable(dp.table);setSteps(trace);setStep(0);setError('');}catch(e){setError((e as Error).message);setResult(null);setSteps([]);setTable([]);}}
 return <main style={{padding:16,maxWidth:960,margin:'auto',fontFamily:'system-ui',color:'#173c2e'}}><h1>从选择树到状态表：0/1背包</h1><p>每件物品只能选一次，容量是整数上界；目标为最大总价值，不要求正好装满。</p><textarea rows={5} style={{width:'100%'}} value={raw} onChange={e=>setRaw(e.target.value)}/><p>容量 <input value={cap} onChange={e=>setCap(e.target.value)} style={{width:70}}/> <select value={mode} onChange={e=>setMode(e.target.value)}><option value="memo">记忆化递归</option><option value="plain">无缓存递归</option><option value="backtrack">路径回溯</option></select></p><button onClick={run}>建立 / 重置轨迹</button><button onClick={()=>{setRaw(JSON.stringify(Array.from({length:6},(_,i)=>({id:String(i),weight:1,value:1}))));setCap('3');setMode('memo');setSteps([]);setResult(null);setTable([]);}}>载入重复子问题预设</button><button disabled={!steps.length||step===0} onClick={()=>setStep(x=>x-1)}>上一步</button><button disabled={!steps.length||step>=steps.length-1} onClick={()=>setStep(x=>x+1)}>下一步</button><p role="status">{error||`事件 ${steps.length?step+1:0}/${steps.length}`}</p><pre style={{overflowX:'auto',background:'#edf5ef',padding:12}}>{JSON.stringify(steps[step]??null,null,2)}</pre><h2>相同问题的独立实现结果</h2><pre style={{overflowX:'auto'}}>{JSON.stringify(result,null,2)}</pre><h2>表：行i为前i件，列c为容量上界</h2><div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse'}}><tbody>{table.map((row,i)=><tr key={i}><th style={{padding:5}}>i={i}</th>{row.map((v,c)=><td key={c} title={`capacity ${c}`} style={{padding:5,border:'1px solid #86a995'}}>{v}</td>)}</tr>)}</tbody></table></div><p>默认容量6最大价值8；不同最优组合允许不同IDs。默认小例未必有memo hit；载入重复子问题预设，再建立轨迹看computed与memo hit；回溯看叶子路径快照。整个历史仅用于有界演示，不是免费监控。</p></main>;
}
