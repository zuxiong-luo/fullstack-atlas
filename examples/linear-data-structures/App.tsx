import React, {useState} from 'react';

export type Cost={copies:number;shifts:number;hops:number};
function indexCheck(i:number,n:number,insert=false){if(!Number.isInteger(i)||i<0||i>n-(insert?0:1))throw new RangeError('index out of range');}
export class Vector<T>{
  private data:(T|undefined)[]=new Array(2);
  size=0;
  cost:Cost={copies:0,shifts:0,hops:0};
  get capacity(){return this.data.length;}
  get(i:number):T{indexCheck(i,this.size);return this.data[i] as T;}
  insert(i:number,value:T){
    indexCheck(i,this.size,true);
    if(this.size===this.capacity){
      const next:(T|undefined)[]=new Array(this.capacity*2);
      for(let k=0;k<this.size;k++){next[k]=this.data[k];this.cost.copies++;}
      this.data=next;
    }
    for(let k=this.size;k>i;k--){this.data[k]=this.data[k-1];this.cost.shifts++;}
    this.data[i]=value;this.size++;
  }
  remove(i:number):T{
    indexCheck(i,this.size);const value=this.data[i] as T;
    for(let k=i;k<this.size-1;k++){this.data[k]=this.data[k+1];this.cost.shifts++;}
    this.data[--this.size]=undefined;return value;
  }
  values():T[]{return this.data.slice(0,this.size) as T[];}
  slots(){return Array.from({length:this.capacity},(_,i)=>i<this.size?this.data[i]:null);}
  assertInvariant(){if(this.size<0||this.size>this.capacity)throw new Error('vector bounds');}
}
type Link<T>={value:T;next:Link<T>|null};
export class SinglyList<T>{
  private head:Link<T>|null=null;
  private tail:Link<T>|null=null;
  size=0;
  cost:Cost={copies:0,shifts:0,hops:0};
  private nodeAt(i:number):Link<T>{
    indexCheck(i,this.size);let node=this.head!;
    for(let k=0;k<i;k++){node=node.next!;this.cost.hops++;}
    return node;
  }
  get(i:number):T{return this.nodeAt(i).value;}
  insert(i:number,value:T){
    indexCheck(i,this.size,true);const node:Link<T>={value,next:null};
    if(i===0){node.next=this.head;this.head=node;if(this.size===0)this.tail=node;}
    else if(i===this.size){this.tail!.next=node;this.tail=node;}
    else{const before=this.nodeAt(i-1);node.next=before.next;before.next=node;}
    this.size++;
  }
  remove(i:number):T{
    indexCheck(i,this.size);let removed:Link<T>;
    if(i===0){removed=this.head!;this.head=removed.next;}
    else{const before=this.nodeAt(i-1);removed=before.next!;before.next=removed.next;if(removed===this.tail)this.tail=before;}
    this.size--;if(this.size===0)this.tail=null;
    removed.next=null;return removed.value;
  }
  values():T[]{const out:T[]=[];for(let p=this.head;p;p=p.next)out.push(p.value);return out;}
  assertInvariant(){
    let n=0,last:Link<T>|null=null;for(let p=this.head;p;p=p.next){last=p;if(++n>this.size)throw new Error('cycle or count');}
    if(n!==this.size||last!==this.tail||(this.size===0&&this.head!==null))throw new Error('list endpoints');
  }
}
export class Stack<T>{
  private data=new Vector<T>();
  get size(){return this.data.size;}
  push(value:T){this.data.insert(this.size,value);}
  pop():T|undefined{return this.size===0?undefined:this.data.remove(this.size-1);}
  values(){return this.data.values();}
}
export class RingQueue<T>{
  private data:(T|undefined)[]=new Array(4);
  head=0;
  size=0;
  copies=0;
  get capacity(){return this.data.length;}
  enqueue(value:T){
    if(this.size===this.capacity){
      const next:(T|undefined)[]=new Array(this.capacity*2);
      for(let i=0;i<this.size;i++){next[i]=this.data[(this.head+i)%this.capacity];this.copies++;}
      this.data=next;this.head=0;
    }
    this.data[(this.head+this.size)%this.capacity]=value;this.size++;
  }
  dequeue():T|undefined{
    if(this.size===0)return undefined;
    const value=this.data[this.head];this.data[this.head]=undefined;
    this.head=(this.head+1)%this.capacity;this.size--;
    if(this.size===0)this.head=0;return value;
  }
  values():T[]{return Array.from({length:this.size},(_,i)=>this.data[(this.head+i)%this.capacity] as T);}
  slots(){return Array.from({length:this.capacity},(_,i)=>this.data[i]??null);}
  assertInvariant(){if(this.size<0||this.size>this.capacity||this.head<0||this.head>=this.capacity)throw new Error('queue bounds');}
}
export function bracketsBalanced(text:string):boolean{
  const stack=new Stack<string>(),pairs:Record<string,string>={')':'(',']':'[','}':'{'};
  for(const ch of text){
    if('([{'.includes(ch))stack.push(ch);
    else if(Object.hasOwn(pairs,ch)&&stack.pop()!==pairs[ch])return false;
  }
  return stack.size===0;
}

const panel:React.CSSProperties={border:'1px solid #86a995',padding:16,borderRadius:12,margin:'12px 0',background:'#fff',color:'#173c2e'};
export default function App(){
  const [mode,setMode]=useState('vector'),[vector,setVector]=useState(()=>new Vector<number>()),[list,setList]=useState(()=>new SinglyList<number>()),[queue,setQueue]=useState(()=>new RingQueue<number>()),[stack,setStack]=useState(()=>new Stack<number>());
  const [value,setValue]=useState('10'),[index,setIndex]=useState('0'),[message,setMessage]=useState('从空结构开始；每个按钮是一步。'),[revision,refresh]=useState(0),[step,setStep]=useState(0);
  function reset(next=mode){setMode(next);setVector(new Vector());setList(new SinglyList());setQueue(new RingQueue());setStack(new Stack());setStep(0);setMessage('已重置为空结构');refresh(x=>x+1);}
  function perform(op:string,v=Number(value),i=Number(index)){
    try{
      if(!Number.isFinite(v)||!value.trim())throw new Error('请输入有限数值');
      let result:unknown='完成';
      const size=mode==='vector'?vector.size:mode==='list'?list.size:mode==='queue'?queue.size:stack.size;
      if(size>=256&&op==='add')throw new Error('教学视图最多256项，请先移除或重置');
      if(mode==='vector'||mode==='list'){const model=mode==='vector'?vector:list;if(op==='add')model.insert(i,v);else if(op==='remove')result=model.remove(i);else result=model.get(i);model.assertInvariant();}
      else if(mode==='queue'){if(op==='add')queue.enqueue(v);else result=queue.dequeue();queue.assertInvariant();}
      else{if(op==='add')stack.push(v);else result=stack.pop();}
      setMessage(`${op}(${mode==='vector'||mode==='list'?i+', ':''}${op==='add'?v:''}) → ${String(result)}`);refresh(x=>x+1);
    }catch(e){setMessage((e as Error).message);}
  }
  const script=[['add',10],['add',20],['add',30],['add',40],['remove',0],['remove',0],['add',50],['add',60],['add',70]] as const;
  const values=mode==='vector'?vector.values():mode==='list'?list.values():mode==='queue'?queue.values():stack.values();
  const snapshot=mode==='vector'?{size:vector.size,capacity:vector.capacity,cost:vector.cost,slots:vector.slots()}:mode==='list'?{size:list.size,cost:list.cost,head:values[0]??null,tail:values.at(-1)??null}:mode==='queue'?{size:queue.size,capacity:queue.capacity,head:queue.head,copies:queue.copies,slots:queue.slots()}:{size:stack.size,top:values.at(-1)??null};
  return <main style={{padding:16,maxWidth:1000,margin:'auto',fontFamily:'system-ui'}} data-revision={revision}>
    <h1>线性结构：一步一步看操作代价</h1><p>拷贝、搬移和 next 跳转计数只描述本教学实现，不是 JS 引擎性能。栈/队列为空时返回 undefined。</p>
    <label>结构 <select value={mode} onChange={e=>reset(e.target.value)}><option value="vector">动态数组</option><option value="list">单链表</option><option value="stack">栈（后进先出）</option><option value="queue">循环队列（先进先出）</option></select></label>
    <section style={panel}><label>数值 <input value={value} onChange={e=>setValue(e.target.value)} style={{width:100}}/></label>{(mode==='vector'||mode==='list')&&<label> 下标 <input value={index} onChange={e=>setIndex(e.target.value)} style={{width:80}}/></label>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button onClick={()=>perform('add')}>{mode==='queue'?'入队':mode==='stack'?'压栈':'按下标插入'}</button><button onClick={()=>perform('remove')}>{mode==='queue'?'出队':mode==='stack'?'出栈':'按下标删除'}</button>{(mode==='vector'||mode==='list')&&<button onClick={()=>perform('get')}>按下标读取</button>}<button onClick={()=>reset()}>重置</button></div>
    </section>
    {mode==='queue'&&<section style={panel}><p>队列预设：入10/20/30/40，出两项，再入50/60/70。请先重置，再按下一步；第9步触发扩容。</p><button disabled={step>=script.length} onClick={()=>{const [op,n]=script[step];perform(op,n);setStep(step+1);}}>队列脚本下一步（{step}/{script.length}）</button></section>}
    <p role="status" aria-live="polite">{message}</p><section style={panel}><h2>逻辑顺序</h2><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{values.map((v,i)=><span key={i} style={{padding:8,border:'1px solid #285443'}}>{i}: {v}{mode==='list'?' →':''}</span>)}{!values.length&&'空'}</div><p>{mode==='queue'?'左侧为下一项出队':mode==='stack'?'右侧为栈顶':'下标从0开始'}</p><h2>当前参数与累计代价</h2><pre style={{overflowX:'auto'}}>{JSON.stringify(snapshot,null,2)}</pre></section>
  </main>;
}
