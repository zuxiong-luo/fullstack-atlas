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

export function normalMatrix(model:Mat4):Float32Array{
 if(model.length!==16)throw new RangeError('模型矩阵必须16项');
 const a=model[0],b=model[4],c=model[8],d=model[1],e=model[5],f=model[9],g=model[2],h=model[6],i=model[10];
 const A=e*i-f*h,B=f*g-d*i,C=d*h-e*g,det=a*A+b*B+c*C;
 if(!Array.from(model).every(Number.isFinite)||Math.abs(det)<1e-8)throw new RangeError('法线矩阵需要非奇异模型变换');
 // Cofactor matrix / det is transpose(inverse(M)); column-major upload.
 return new Float32Array([A,c*h-b*i,b*f-c*e,B,a*i-c*g,c*d-a*f,C,b*g-a*h,a*e-b*d].map(x=>x/det));
}
export function transform3(m:Float32Array,p:readonly number[]){return [0,1,2].map(row=>m[row]*p[0]+m[3+row]*p[1]+m[6+row]*p[2]);}
export function unit(v:readonly number[]){const n=Math.hypot(...v);if(!Number.isFinite(n)||n<1e-8)throw new RangeError('方向向量不可为零');return v.map(x=>x/n);}
export function diffuse(normal:readonly number[],light:readonly number[]){const n=unit(normal),l=unit(light);return Math.max(0,n.reduce((s,x,i)=>s+x*l[i],0));}
export function sphereMesh(rows=16,columns=24){
 if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<3||rows>64||columns<3||columns>64)throw new RangeError('球面分段3..64');const data:number[]=[],indices:number[]=[];
 for(let y=0;y<=rows;y++){const phi=y/rows*Math.PI;for(let x=0;x<=columns;x++){const theta=x/columns*Math.PI*2,p=[Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)];data.push(...p,...p);}}
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const a=y*(columns+1)+x,b=a+columns+1;if(y!==0)indices.push(a,b,a+1);if(y!==rows-1)indices.push(a+1,b,b+1);}
 return {vertices:new Float32Array(data),indices:new Uint16Array(indices)};
}
export type Options={angle:number;scaleX:number;light:number;shine:number;wrongNormal:boolean;normalColor:boolean;gamma:boolean;animate:boolean};
export const defaults:Options={angle:25,scaleX:1.6,light:35,shine:32,wrongNormal:false,normalColor:false,gamma:true,animate:false};
export function lightingModel(options:Options,time=0){
 if(![options.angle,options.scaleX,options.light,options.shine,time].every(Number.isFinite)||options.scaleX<=0||options.scaleX>2||options.shine<1||options.shine>128)throw new RangeError('光照参数或缩放无效');
 const s=new Float32Array([options.scaleX,0,0,0,0,.7,0,0,0,0,1,0,0,0,0,1]);return multiply(rotationY((options.angle+(options.animate?time*.015:0))*Math.PI/180),s);
}
