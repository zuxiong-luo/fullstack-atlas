export const textureWidth=3,textureHeight=5;
export function checkerPixels(){
  const result=new Uint8Array(textureWidth*textureHeight*4);
  for(let y=0;y<textureHeight;y++)for(let x=0;x<textureWidth;x++){
    const i=(y*textureWidth+x)*4,bright=(x+y)%2===0;
    result.set(bright?[255,230,90,210]:[40,150,220,100],i);
  }return result;
}
export function mipDimensions(width:number,height:number){
  if(![width,height].every(v=>Number.isInteger(v)&&v>0&&v<=16384))throw new RangeError('尺寸无效');
  const levels:Array<[number,number]>=[];
  for(;;){levels.push([width,height]);if(width===1&&height===1)return levels;width=Math.max(1,Math.floor(width/2));height=Math.max(1,Math.floor(height/2));}
}
export function unpackBytes(width:number,height:number,components:number,alignment:number){
  if(![width,height,components].every(v=>Number.isInteger(v)&&v>0)||components>4||![1,2,4,8].includes(alignment))throw new RangeError('上传布局无效');
  const row=width*components,stride=Math.ceil(row/alignment)*alignment;
  return {row,stride,required:stride*(height-1)+row};
}
export function overOpaque(src:readonly[number,number,number,number],dst:readonly[number,number,number]){
  return dst.map((v,i)=>src[i]*src[3]+v*(1-src[3]));
}
export const quad=new Float32Array([
  -1,-1,0,0, 1,-1,1,0, 1,1,1,1,
  -1,-1,0,0, 1,1,1,1, -1,1,0,1,
]);
export type Options={filter:'nearest'|'linear'|'mipmap';repeat:boolean;uvScale:number;blend:boolean;reverse:boolean;opacity:number;animate:boolean};
export const defaults:Options={filter:'nearest',repeat:true,uvScale:3,blend:true,reverse:false,opacity:.75,animate:false};
