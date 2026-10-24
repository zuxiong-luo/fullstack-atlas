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
