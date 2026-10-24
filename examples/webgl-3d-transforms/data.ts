export type Mat4=Float32Array;
export function multiply(a:Mat4,b:Mat4):Mat4 {
  const out=new Float32Array(16);
  for(let col=0;col<4;col++)for(let row=0;row<4;row++)
    for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];
  return out;
}
export function translation(x:number,y:number,z:number):Mat4 {
  return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
}
export function rotationY(radians:number):Mat4 {
  const c=Math.cos(radians),s=Math.sin(radians);
  return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);
}
export function perspective(fovy:number,aspect:number,near:number,far:number):Mat4 {
  if(![fovy,aspect,near,far].every(Number.isFinite)||fovy<=0||fovy>=Math.PI||aspect<=0||near<=0||far<=near)throw new RangeError('透视参数无效');
  const f=1/Math.tan(fovy/2),nf=1/(near-far);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
}
export function orthographic(left:number,right:number,bottom:number,top:number,near:number,far:number):Mat4 {
  if(![left,right,bottom,top,near,far].every(Number.isFinite)||left>=right||bottom>=top||near<=0||near>=far)throw new RangeError('正交参数无效');
  return new Float32Array([2/(right-left),0,0,0,0,2/(top-bottom),0,0,0,0,-2/(far-near),0,-(right+left)/(right-left),-(top+bottom)/(top-bottom),-(far+near)/(far-near),1]);
}
export function clipPoint(matrix:Mat4,point:readonly[number,number,number]) {
  const vector=[...point,1];return [0,1,2,3].map(row=>vector.reduce((sum,value,k)=>sum+matrix[k*4+row]*value,0));
}
export function toNdc(clip:readonly number[]){
  if(clip.length!==4||!clip.every(Number.isFinite)||Math.abs(clip[3])<1e-8)throw new RangeError('不能进行透视除法');
  return clip.slice(0,3).map(v=>v/clip[3]);
}
export const vertices=new Float32Array([
  -.9,-.7,.25, 1,.18,.12, .9,-.7,.25, 1,.18,.12, 0,.9,.25, 1,.18,.12,
  -.8,.7,-.25, .12,.4,1, .8,.7,-.25, .12,.4,1, 0,-.9,-.25, .12,.4,1,
]);
export type Options={angle:number;camera:number;projection:'perspective'|'orthographic';depth:boolean;animate:boolean};
export const defaults:Options={angle:0,camera:3,projection:'perspective',depth:true,animate:false};
