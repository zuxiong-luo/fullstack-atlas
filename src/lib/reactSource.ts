import files from '../data/reactSourceFiles.json';
const prefix='https://github.com/facebook/react/blob/v18.3.1/';
export function sourceLocation(url:string){
 if(!url.startsWith(prefix))return null;
 const [path,anchor]=url.slice(prefix.length).split('#');
 if(!files.includes(path))return null;
 const match=/^L(\d+)(?:-L(\d+))?$/.exec(anchor||'');
 if(anchor&&!match)return null;
 const start=match?Number(match[1]):1;
 const end=match?.[2]?Number(match[2]):start+39;
 if(start<1||end<start)return null;
 return {path,start,end,context:!match?.[2],asset:'sources/react-v18.3.1/'+path};
}
export function sourceSlice(text:string,start:number,end:number){
 const lines=text.replace(/\r\n/g,'\n').split('\n');
 if(start>lines.length)throw new Error('源码行号超出文件范围');
 return {code:lines.slice(start-1,end).join('\n'),end:Math.min(end,lines.length)};
}
