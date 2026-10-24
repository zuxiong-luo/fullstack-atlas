export type WeightedGraph=readonly (readonly (readonly [number,number])[])[];
export function validateWeighted(g:WeightedGraph){
 if(g.length>10000)throw new RangeError('at most 10000 vertices');let count=0;
 for(let v=0;v<g.length;v++){if(!Object.hasOwn(g,v)||!Array.isArray(g[v]))throw new RangeError('dense adjacency lists required');for(let i=0;i<g[v].length;i++){const e=g[v][i];if(!Object.hasOwn(g[v],i)||!Array.isArray(e)||e.length!==2||!Number.isInteger(e[0])||e[0]<0||e[0]>=g.length||!Number.isSafeInteger(e[1])||e[1]<0||e[1]>1_000_000_000)throw new RangeError('endpoint or nonnegative integer weight invalid');if(++count>1_000_000)throw new RangeError('at most one million edges');}}
}
type Entry={vertex:number;distance:number;sequence:number};
class Frontier{
 private data:Entry[]=[];private sequence=0;
 get size(){return this.data.length;}
 snapshot(){return this.data.map(x=>({...x}));}
 private before(a:Entry,b:Entry){return a.distance<b.distance||(a.distance===b.distance&&a.sequence<b.sequence);}
 push(vertex:number,distance:number){const e={vertex,distance,sequence:this.sequence++};this.data.push(e);let i=this.size-1;while(i){const p=Math.floor((i-1)/2);if(!this.before(this.data[i],this.data[p]))break;[this.data[i],this.data[p]]=[this.data[p],this.data[i]];i=p;}}
 pop(){if(!this.size)return undefined;const first=this.data[0],last=this.data.pop()!;if(this.size){this.data[0]=last;let i=0;for(;;){let smallest=i;const l=2*i+1,rr=l+1;if(l<this.size&&this.before(this.data[l],this.data[smallest]))smallest=l;if(rr<this.size&&this.before(this.data[rr],this.data[smallest]))smallest=rr;if(smallest===i)break;[this.data[i],this.data[smallest]]=[this.data[smallest],this.data[i]];i=smallest;}}return first;}
}
export type PathEvent={action:string;vertex:number;distance:number[];settled:boolean[];frontier:{vertex:number;distance:number}[]};
export function dijkstra(g:WeightedGraph,start:number,observe?:(e:PathEvent)=>void){
 validateWeighted(g);if(!Number.isInteger(start)||start<0||start>=g.length)throw new RangeError('invalid source');
 const distance=new Array<number>(g.length).fill(Infinity),parent=new Array<number>(g.length).fill(-1),settled=new Array<boolean>(g.length).fill(false),q=new Frontier();let pushes=1,stale=0,relaxations=0;
 distance[start]=0;q.push(start,0);
 const notify=(action:string,v:number)=>{if(observe)observe({action,vertex:v,distance:[...distance],settled:[...settled],frontier:q.snapshot()});};
 while(q.size){const e=q.pop()!;
  if(e.distance!==distance[e.vertex]||settled[e.vertex]){stale++;notify('discard stale',e.vertex);continue;}
  const v=e.vertex;settled[v]=true;notify('settle',v);
  for(const [w,weight] of g[v]){relaxations++;const candidate=distance[v]+weight;if(candidate<distance[w]){distance[w]=candidate;parent[w]=v;q.push(w,candidate);pushes++;notify('relax '+v+'→'+w,w);}}
 }
 return {distance,parent,settled,stats:{pushes,stale,relaxations}};
}
export function shortestPath(parent:readonly number[],distance:readonly number[],target:number){
 if(parent.length!==distance.length||!Number.isInteger(target)||target<0||target>=parent.length)throw new RangeError('invalid result/target');if(distance[target]===Infinity)return null;
 const out:number[]=[],seen=new Set<number>();for(let v=target;v!==-1;v=parent[v]){if(!Number.isInteger(v)||v<0||v>=parent.length||seen.has(v))throw new RangeError('invalid parent chain');seen.add(v);out.push(v);}return out.reverse();
}
export function unitWeightBfs(g:WeightedGraph,start:number){
 validateWeighted(g);for(const list of g)for(const [,weight]of list)if(weight!==1)throw new RangeError('BFS distance requires unit weights');if(!Number.isInteger(start)||start<0||start>=g.length)throw new RangeError('invalid source');
 const distance=new Array<number>(g.length).fill(Infinity),queue=[start];distance[start]=0;for(let h=0;h<queue.length;h++){const v=queue[h];for(const [w]of g[v])if(distance[w]===Infinity){distance[w]=distance[v]+1;queue.push(w);}}return distance;
}
