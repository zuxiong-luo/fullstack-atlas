import React, {useState} from 'react';

export type Graph=readonly (readonly number[])[];
export function validateGraph(g:Graph){
 for(let v=0;v<g.length;v++){if(!Object.hasOwn(g,v)||!Array.isArray(g[v]))throw new RangeError('dense adjacency lists required');for(let i=0;i<g[v].length;i++){const w=g[v][i];if(!Object.hasOwn(g[v],i)||!Number.isInteger(w)||w<0||w>=g.length)throw new RangeError('edge endpoint outside graph');}}
}
export type GraphEvent={action:string;vertex:number;frontier:number[];state:number[]};
export type ObserveGraph=(e:GraphEvent)=>void;
export function bfs(g:Graph,start:number,observe?:ObserveGraph){
 validateGraph(g);if(!Number.isInteger(start)||start<0||start>=g.length)throw new RangeError('invalid start');
 const distance=new Array<number>(g.length).fill(-1),parent=new Array<number>(g.length).fill(-1),queue=[start],order:number[]=[];distance[start]=0;
 for(let head=0;head<queue.length;head++){const v=queue[head];order.push(v);for(const w of g[v])if(distance[w]===-1){distance[w]=distance[v]+1;parent[w]=v;queue.push(w);}observe?.({action:'expand',vertex:v,frontier:queue.slice(head+1),state:[...distance]});}
 return {order,distance,parent};
}
export function dfs(g:Graph,observe?:ObserveGraph){
 validateGraph(g);const color=new Array<number>(g.length).fill(0),parent=new Array<number>(g.length).fill(-1),pre:number[]=[],post:number[]=[];let cycle:number[]|null=null;
 for(let root=0;root<g.length;root++)if(!color[root]){
  color[root]=1;pre.push(root);const stack=[{v:root,next:0}];
  while(stack.length){const frame=stack[stack.length-1];
   if(frame.next===g[frame.v].length){color[frame.v]=2;post.push(frame.v);stack.pop();observe?.({action:'finish',vertex:frame.v,frontier:stack.map(f=>f.v),state:[...color]});continue;}
   const w=g[frame.v][frame.next++];
   if(color[w]===0){parent[w]=frame.v;color[w]=1;pre.push(w);stack.push({v:w,next:0});observe?.({action:'discover',vertex:w,frontier:stack.map(f=>f.v),state:[...color]});}
   else if(color[w]===1&&cycle===null){const chain=[frame.v];while(chain[chain.length-1]!==w)chain.push(parent[chain[chain.length-1]]);cycle=chain.reverse();cycle.push(w);observe?.({action:'back edge',vertex:w,frontier:[...cycle],state:[...color]});}
  }
 }
 return {pre,post,parent,cycle};
}
export function topological(g:Graph,observe?:ObserveGraph){
 validateGraph(g);const indegree=new Array<number>(g.length).fill(0);for(const edges of g)for(const w of edges)indegree[w]++;
 const queue:number[]=[];for(let v=0;v<g.length;v++)if(!indegree[v])queue.push(v);const order:number[]=[];
 for(let head=0;head<queue.length;head++){const v=queue[head];order.push(v);for(const w of g[v])if(--indegree[w]===0)queue.push(w);observe?.({action:'remove ready',vertex:v,frontier:queue.slice(head+1),state:[...indegree]});}
 const blocked:number[]=[];for(let v=0;v<g.length;v++)if(indegree[v]>0)blocked.push(v);
 return {order,blocked,acyclic:order.length===g.length};
}
export function reconstruct(parent:readonly number[],target:number){
 if(!Number.isInteger(target)||target<0||target>=parent.length)throw new RangeError('invalid target');const path:number[]=[],seen=new Set<number>();
 for(let v=target;v!==-1;v=parent[v]){if(!Number.isInteger(v)||v<0||v>=parent.length||seen.has(v))throw new RangeError('invalid parent chain');seen.add(v);path.push(v);}return path.reverse();
}

export default function App(){
 const [raw,setRaw]=useState('[[1,2],[3],[3],[4],[]]'),[mode,setMode]=useState('bfs'),[source,setSource]=useState('0'),[steps,setSteps]=useState<GraphEvent[]>([]),[step,setStep]=useState(0),[result,setResult]=useState<unknown>(null),[error,setError]=useState('');
 function prepare(){try{const g=JSON.parse(raw);if(!Array.isArray(g)||g.length>16||g.some(x=>!Array.isArray(x)||x.length>32))throw new Error('邻接表最多16顶点，每行32边');const events:GraphEvent[]=[];const answer=mode==='bfs'?bfs(g,Number(source),e=>events.push(e)):mode==='dfs'?dfs(g,e=>events.push(e)):topological(g,e=>events.push(e));setSteps(events);setStep(0);setResult(answer);setError('');}catch(e){setError((e as Error).message);setSteps([]);setResult(null);}}
 return <main style={{padding:16,maxWidth:960,margin:'auto',fontFamily:'system-ui',color:'#173c2e'}}><h1>图遍历与依赖：当前状态决定下一步</h1><p>邻接表 g[v] 记录 v→w。依赖图中边表示前置→后续。重复边按多重边计数，顶点由0开始。</p><textarea rows={4} style={{width:'100%'}} value={raw} onChange={e=>setRaw(e.target.value)}/><p><label>算法 <select value={mode} onChange={e=>{setMode(e.target.value);setSteps([]);setResult(null);}}><option value="bfs">BFS（单源边数距离）</option><option value="dfs">DFS（三色与环）</option><option value="topo">Kahn（依赖就绪）</option></select></label>{mode==='bfs'&&<label> 起点 <input value={source} onChange={e=>setSource(e.target.value)} style={{width:70}}/></label>}</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={prepare}>建立 / 重置轨迹</button><button onClick={()=>{setRaw('[[1],[2],[1,3],[]]');setMode('topo');setSteps([]);setResult(null);}}>载入环和下游阻塞</button><button disabled={!steps.length||step===0} onClick={()=>setStep(s=>s-1)}>上一步</button><button disabled={!steps.length||step>=steps.length-1} onClick={()=>setStep(s=>s+1)}>下一步</button></div><p role="status">{error||`步骤 ${steps.length?step+1:0}/${steps.length}`}</p><h2>当前前沿与状态</h2><pre style={{overflowX:'auto',background:'#edf5ef',padding:12}}>{JSON.stringify(steps[step]??null,null,2)}</pre><p>state：BFS为边数距离（-1未发现）；DFS为0白/1灰/2黑；Kahn为剩余入度。frontier表示算法当时真正待处理的结构。</p><h2>最终结果</h2><pre style={{overflowX:'auto'}}>{JSON.stringify(result,null,2)}</pre><p>Kahn的blocked含环上的顶点，也可能含依赖环的后续顶点；不要把所有blocked称为环成员。若BFS distance[target]=-1，不应拿parent=-1重建成已找到路径。</p></main>;
}
