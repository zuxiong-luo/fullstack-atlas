export type Options={scale:number;mode:number;angle:number;incomplete:boolean;animate:boolean};
export const defaults:Options={scale:.5,mode:0,angle:0,incomplete:false,animate:false};
export function targetSize(width:number,height:number,scale:number,maxSize:number){
 if(![width,height,scale,maxSize].every(Number.isFinite)||width<1||height<1||scale<.25||scale>1||maxSize<1)throw new RangeError('离屏尺寸参数无效');
 return [Math.max(1,Math.min(Math.floor(maxSize),2048,Math.round(width*scale))),Math.max(1,Math.min(Math.floor(maxSize),2048,Math.round(height*scale)))] as const;
}
export function targetBytes(width:number,height:number){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>2048||height>2048)throw new RangeError('尺寸需为1..2048整数');return width*height*(4+2);}
export function gray(rgb:readonly number[]){if(rgb.length!==3||!rgb.every(Number.isFinite))throw new RangeError('RGB需要三个有限值');return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
export const triangle=new Float32Array([-.85,-.75,1,.15,.05,.85,-.75,.05,.85,.15,0,.9,.1,.2,1]);
