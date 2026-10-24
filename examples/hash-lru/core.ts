export type Entry={key:string;value:number};
// Deterministic UTF-16 teaching hash, not a cryptographic or attack-resistant hash.
export function hashString(key:string):number{
  let hash=2166136261;
  for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619)>>>0;
  return hash;
}
export class ChainedMap{
  private buckets:Entry[][]=Array.from({length:4},()=>[]);
  size=0;
  comparisons=0;
  rehashed=0;
  constructor(private hash:(key:string)=>number=hashString){}
  get capacity(){return this.buckets.length;}
  private bucket(key:string){return this.buckets[(this.hash(key)>>>0)%this.capacity];}
  get(key:string):number|undefined{
    for(const item of this.bucket(key)){this.comparisons++;if(item.key===key)return item.value;}
    return undefined;
  }
  set(key:string,value:number){
    const bucket=this.bucket(key);
    for(const item of bucket){this.comparisons++;if(item.key===key){item.value=value;return;}}
    if((this.size+1)/this.capacity>0.75){
      const old=this.buckets;this.buckets=Array.from({length:this.capacity*2},()=>[]);
      for(const chain of old)for(const item of chain){this.bucket(item.key).push(item);this.rehashed++;}
    }
    this.bucket(key).push({key,value});this.size++;
  }
  delete(key:string):boolean{
    const bucket=this.bucket(key);
    for(let i=0;i<bucket.length;i++){this.comparisons++;if(bucket[i].key===key){bucket.splice(i,1);this.size--;return true;}}
    return false;
  }
  snapshot():Entry[][]{return this.buckets.map(chain=>chain.map(item=>({...item})));}
  assertInvariant(){
    let n=0;const seen=new Set<string>();
    this.buckets.forEach((chain,index)=>{for(const item of chain){
      if(seen.has(item.key)||(this.hash(item.key)>>>0)%this.capacity!==index)throw new Error('bucket invariant');
      seen.add(item.key);n++;
    }});
    if(n!==this.size)throw new Error('size invariant');
  }
}
type CacheNode={key:string;value:number;prev:CacheNode|null;next:CacheNode|null};
export class LRU{
  private nodes=new Map<string,CacheNode>();
  private head:CacheNode|null=null;
  private tail:CacheNode|null=null;
  constructor(readonly capacity:number){if(!Number.isSafeInteger(capacity)||capacity<0)throw new RangeError('capacity must be a nonnegative safe integer');}
  get size(){return this.nodes.size;}
  private detach(node:CacheNode){
    if(node.prev)node.prev.next=node.next;else this.head=node.next;
    if(node.next)node.next.prev=node.prev;else this.tail=node.prev;
    node.prev=null;node.next=null;
  }
  private front(node:CacheNode){
    node.prev=null;node.next=this.head;
    if(this.head)this.head.prev=node;else this.tail=node;
    this.head=node;
  }
  get(key:string):number|undefined{
    const node=this.nodes.get(key);if(!node)return undefined;
    this.detach(node);this.front(node);return node.value;
  }
  peek(key:string):number|undefined{return this.nodes.get(key)?.value;}
  put(key:string,value:number):string|undefined{
    if(this.capacity===0)return undefined;
    const existing=this.nodes.get(key);
    if(existing){existing.value=value;this.detach(existing);this.front(existing);return undefined;}
    const node:CacheNode={key,value,prev:null,next:null};this.nodes.set(key,node);this.front(node);
    if(this.size>this.capacity){const victim=this.tail!;this.detach(victim);this.nodes.delete(victim.key);return victim.key;}
    return undefined;
  }
  keys():string[]{const keys:string[]=[];for(let p=this.head;p;p=p.next)keys.push(p.key);return keys;}
  assertInvariant(){
    let count=0,previous:CacheNode|null=null;
    for(let p=this.head;p;p=p.next){if(p.prev!==previous||this.nodes.get(p.key)!==p||++count>this.size)throw new Error('links invariant');previous=p;}
    if(count!==this.size||previous!==this.tail||this.size>this.capacity||this.head?.prev||this.tail?.next)throw new Error('cache invariant');
  }
}
