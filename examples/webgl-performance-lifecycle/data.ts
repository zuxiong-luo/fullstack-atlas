export type Options={count:number;batch:boolean;animate:boolean};
export const defaults:Options={count:1000,batch:true,animate:true};
export function offsetsFor(count:number){
 if(!Number.isInteger(count)||count<1||count>5000)throw new RangeError('instance count 1..5000');
 const side=Math.ceil(Math.sqrt(count)),spacing=1.8/side,offsets=new Float32Array(count*2);
 for(let i=0;i<count;i++){offsets[i*2]=-.9+spacing*(i%side+.5);offsets[i*2+1]=-.9+spacing*(Math.floor(i/side)+.5);}return {offsets,size:spacing*.65};
}
export class Samples{
 private values:number[]=[];
 constructor(private capacity=60){if(!Number.isInteger(capacity)||capacity<1||capacity>1000)throw new RangeError('sample capacity 1..1000');}
 push(value:number){if(!Number.isFinite(value)||value<0)throw new RangeError('finite nonnegative measurement required');this.values.push(value);if(this.values.length>this.capacity)this.values.shift();}
 clear(){this.values=[];}
 summary(){if(!this.values.length)return {count:0,p50:null,p95:null};const s=[...this.values].sort((a,b)=>a-b),at=(p:number)=>s[Math.max(0,Math.ceil(p*s.length)-1)];return {count:s.length,p50:at(.5),p95:at(.95)};}
}
