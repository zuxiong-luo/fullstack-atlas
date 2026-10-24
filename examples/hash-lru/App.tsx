import React, {useState} from 'react';

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

const panel:React.CSSProperties={border:'1px solid #86a995',padding:16,borderRadius:12,margin:'12px 0',background:'#fff',color:'#173c2e'};
export default function App(){
  const [collision,setCollision]=useState(false),[map,setMap]=useState(()=>new ChainedMap()),[key,setKey]=useState('A'),[value,setValue]=useState('1'),[message,setMessage]=useState('每次点击执行一个操作'),[revision,refresh]=useState(0);
  const [capacity,setCapacity]=useState(2),[cache,setCache]=useState(()=>new LRU(2)),[cacheMessage,setCacheMessage]=useState('头部最近使用，尾部最久未使用');
  function hashAction(op:string){try{if(key.length>64)throw new Error('教学键最多64个UTF-16单元');const n=Number(value);if(op==='set'){if(!value.trim()||!Number.isFinite(n))throw new Error('值必须是有限数字');if(map.size>=32&&map.get(key)===undefined)throw new Error('教学哈希表最多32项');map.set(key,n);setMessage(`set(${key},${n}) 完成`);}else setMessage(`${op}(${key}) → ${String(op==='get'?map.get(key):map.delete(key))}`);map.assertInvariant();refresh(x=>x+1);}catch(e){setMessage((e as Error).message);}}
  function cacheAction(op:string){const n=Number(value);if(key.length>64||!value.trim()||!Number.isFinite(n)){setCacheMessage('键最多64单元，值必须是有限数字');return;}if(op==='put'){const evicted=cache.put(key,n);setCacheMessage(`put(${key},${n})；淘汰 ${evicted??'无'}`);}else setCacheMessage(`${op}(${key}) → ${String(op==='get'?cache.get(key):cache.peek(key))}`);cache.assertInvariant();refresh(x=>x+1);}
  return <main style={{padding:16,maxWidth:1000,margin:'auto',fontFamily:'system-ui'}} data-revision={revision}><h1>哈希碰撞与 LRU</h1><p>上面是自己实现的分离链接哈希表；下面的 LRU 使用 JS Map 定位节点。两者不是同一份索引。</p>
    <section style={panel}><label>键 <input value={key} onChange={e=>setKey(e.target.value)} style={{width:120}}/></label><label> 值 <input value={value} onChange={e=>setValue(e.target.value)} style={{width:100}}/></label></section>
    <section style={panel}><h2>桶、碰撞与扩容</h2><label><input type="checkbox" checked={collision} onChange={e=>{setCollision(e.target.checked);setMap(new ChainedMap(e.target.checked?()=>0:hashString));setMessage('切换哈希函数，已重置表');}}/>故意让所有键落入0号桶（切换会重置）</label><div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'12px 0'}}>{['set','get','delete'].map(op=><button key={op} onClick={()=>hashAction(op)}>{op}</button>)}<button onClick={()=>{setMap(new ChainedMap(collision?()=>0:hashString));setMessage('表已清空');}}>清空表</button></div><p role="status">{message}</p><p>size={map.size}；capacity={map.capacity}；负载={(map.size/map.capacity).toFixed(3)}；累计键比较={map.comparisons}；扩容迁移={map.rehashed}</p><ol start={0}>{map.snapshot().map((chain,i)=><li key={i} style={{overflowWrap:'anywhere',marginBottom:6}}>桶{i}：{chain.map(x=>`${JSON.stringify(x.key)}=${x.value}`).join(' → ')||'空'}</li>)}</ol></section>
    <section style={panel}><h2>LRU 访问顺序</h2><label>容量 <select value={capacity} onChange={e=>{const n=Number(e.target.value);setCapacity(n);setCache(new LRU(n));setCacheMessage('容量改变，缓存重置');}}>{[0,1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label><div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'12px 0'}}>{['put','get','peek'].map(op=><button key={op} onClick={()=>cacheAction(op)}>{op}</button>)}<button onClick={()=>{setCache(new LRU(capacity));setCacheMessage('缓存清空');}}>清空缓存</button></div><p role="status">{cacheMessage}</p><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{cache.keys().map((k,i)=><span key={k} style={{padding:10,border:'1px solid #285443',overflowWrap:'anywhere'}}>{i===0?'MRU ':''}{JSON.stringify(k)}={cache.peek(k)}{i===cache.size-1?' LRU':''}</span>)}{!cache.size&&'空缓存'}</div><p>依次 put(A,1)、put(B,2)、get(A)、put(C,3)，容量2应淘汰 B。peek 不刷新访问顺序。</p></section>
  </main>;
}
