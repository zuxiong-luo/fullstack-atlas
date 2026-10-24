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
