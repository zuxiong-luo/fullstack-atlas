export type MergeStep<T>={lo:number;mid:number;hi:number;values:T[];comparisons:number;writes:number};
export function mergeSort<T>(input:readonly T[],compare:(a:T,b:T)=>number,onMerge?:(step:MergeStep<T>)=>void):T[]{
  const values=[...input],aux=new Array<T>(values.length);
  let comparisons=0,writes=0;
  function sort(lo:number,hi:number){
    if(hi-lo<2)return;
    const mid=lo+Math.floor((hi-lo)/2);sort(lo,mid);sort(mid,hi);
    for(let k=lo;k<hi;k++)aux[k]=values[k];
    let left=lo,right=mid;
    for(let k=lo;k<hi;k++){
      if(left===mid)values[k]=aux[right++];
      else if(right===hi)values[k]=aux[left++];
      else{comparisons++;values[k]=compare(aux[left],aux[right])<=0?aux[left++]:aux[right++];}
      writes++;
    }
    onMerge?.({lo,mid,hi,values:[...values],comparisons,writes});
  }
  sort(0,values.length);return values;
}
export type BoundStep={lo:number;hi:number;mid:number;value:number;move:'lo'|'hi';nextLo:number;nextHi:number};
// Precondition: ascending finite numbers; checked at the UI boundary, not inside each query.
export function bound(values:readonly number[],target:number,upper=false,onStep?:(step:BoundStep)=>void):number{
  let lo=0,hi=values.length;
  while(lo<hi){
    const mid=lo+Math.floor((hi-lo)/2),value=values[mid];
    const goRight=upper?value<=target:value<target;
    const nextLo=goRight?mid+1:lo,nextHi=goRight?hi:mid;
    onStep?.({lo,hi,mid,value,move:goRight?'lo':'hi',nextLo,nextHi});
    lo=nextLo;hi=nextHi;
  }
  return lo;
}
export function equalRange(values:readonly number[],target:number):[number,number]{return [bound(values,target),bound(values,target,true)];}
export function parseFiniteList(text:string):number[]{
  if(!text.trim())return [];
  const tokens=text.split(',');if(tokens.length>32)throw new RangeError('最多32项');
  return tokens.map(token=>{if(!token.trim())throw new Error('逗号之间不能为空');const n=Number(token.trim());if(!Number.isFinite(n))throw new Error('必须是有限数字');return n;});
}
export function assertSorted(values:readonly number[]):void{
  for(let i=0;i<values.length;i++)if(!Number.isFinite(values[i])||(i>0&&values[i-1]>values[i]))throw new Error('二分输入必须按升序排列');
}
