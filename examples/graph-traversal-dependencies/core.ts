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
