export const mesh=new Float32Array([
  -.24,-.3, 1,.25,.1, .24,-.3, .1,.85,.35,
  .24,.3, .1,.4,1, -.24,.3, .9,.7,.1,
]);
export const indices=new Uint16Array([0,1,2,0,2,3]);
export const offsets=new Float32Array([-.65,0, 0,0, .65,0]);
export function validateMesh(data:Float32Array,elements:Uint16Array,instances:number,instanceData:Float32Array){
  const strideBytes=20,vertexCount=data.byteLength/strideBytes;
  if(!Number.isInteger(vertexCount)||vertexCount===0)throw new RangeError('顶点记录必须完整');
  if(!Number.isInteger(instances)||instances<1||instances>3||instanceData.length<instances*2)throw new RangeError('实例记录不足');
  if(elements.length===0||elements.length%3!==0)throw new RangeError('三角形索引不完整');
  for(const index of elements)if(index>=vertexCount)throw new RangeError('索引超过顶点记录数');
  return {strideBytes,vertexCount,indexCount:elements.length,instanceCount:instances};
}
export function attributeByteEnd(vertexIndex:number,stride:number,offset:number,components:number){
  if(![vertexIndex,stride,offset,components].every(Number.isInteger)||vertexIndex<0||stride<=0||offset<0||components<1||components>4||offset+components*4>stride)throw new RangeError('属性布局无效');
  return vertexIndex*stride+offset+components*4;
}
export type Options={instances:number;invalid:boolean;animate:boolean};
export const defaults:Options={instances:3,invalid:false,animate:false};
