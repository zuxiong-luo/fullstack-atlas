export function numbers(a:readonly number[],positive=false){
  if(a.length>1_000_000)throw new RangeError('at most one million values');
  for(let i=0;i<a.length;i++)if(!Object.hasOwn(a,i)||!Number.isSafeInteger(a[i])||Math.abs(a[i])>1_000_000_000||(positive&&a[i]<=0))throw new RangeError('dense bounded integers required');
}
export type WindowEvent={action:string;left:number;right:number;sum?:number;deque?:number[];best?:number;output?:number[]};
export type Observe=(event:WindowEvent)=>void;
export function minPositiveWindow(a:readonly number[],target:number,observe?:Observe){
  numbers(a,true);if(!Number.isSafeInteger(target)||target<=0)throw new RangeError('positive safe target required');
  let left=0,sum=0,best=Infinity,start=-1,end=-1,moves=0;
  for(let right=0;right<a.length;right++){
    sum+=a[right];moves++;observe?.({action:'expand',left,right,sum,best});
    while(sum>=target){
      if(right-left+1<best){best=right-left+1;start=left;end=right+1;}
      sum-=a[left++];moves++;observe?.({action:'shrink',left,right,sum,best});
    }
  }
  return {length:best===Infinity?0:best,start,end,moves};
}
export function windowMax(a:readonly number[],k:number,observe?:Observe){
  numbers(a);if(!Number.isInteger(k)||k<1||k>a.length)throw new RangeError('1 <= k <= length required');
  const ring=new Array<number>(k),output:number[]=[];let head=0,size=0,pushes=0,removals=0;
  const at=(i:number)=>ring[(head+i)%k];
  const snapshot=()=>Array.from({length:size},(_,i)=>at(i));
  for(let right=0;right<a.length;right++){
    const left=right-k+1;
    while(size&&at(0)<left){head=(head+1)%k;size--;removals++;}
    while(size&&a[at(size-1)]<=a[right]){size--;removals++;}
    ring[(head+size)%k]=right;size++;pushes++;
    if(left>=0)output.push(a[at(0)]);
    observe?.({action:left>=0?'emit':'fill',left:Math.max(0,left),right,deque:snapshot(),output:[...output]});
  }
  return {output,pushes,removals};
}
export type StackEvent={index:number;action:string;stack:number[];next:number[]};
export function nextGreater(a:readonly number[],observe?:(event:StackEvent)=>void){
  numbers(a);const stack:number[]=[],next=new Array<number>(a.length).fill(-1);let pushes=0,pops=0;
  for(let i=0;i<a.length;i++){
    while(stack.length&&a[stack[stack.length-1]]<a[i]){next[stack.pop()!]=i;pops++;}
    stack.push(i);pushes++;observe?.({index:i,action:'resolve then push',stack:[...stack],next:[...next]});
  }
  return {next,pushes,pops};
}
