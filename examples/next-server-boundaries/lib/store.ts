import 'server-only';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export type UserId='alice'|'bob';
type Store={catalog:{title:string;revision:number};users:Record<UserId,{displayName:string;note:string;internalToken:string}>};
const file=resolve(process.env.DEMO_DATA_FILE||'data/state.json');
const initial:Store={catalog:{title:'公开课程目录',revision:1},users:{
 alice:{displayName:'Alice',note:'Alice的私人笔记',internalToken:'server-alice-token'},
 bob:{displayName:'Bob',note:'Bob的私人笔记',internalToken:'server-bob-token'},
}};
async function load():Promise<Store>{
 await mkdir(dirname(file),{recursive:true});
 try{await writeFile(file,JSON.stringify(initial),{flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
 return JSON.parse(await readFile(file,'utf8')) as Store;
}
// 同一 Node 进程内串行修改，避免两个请求同时读旧版本后相互覆盖。
const shared=globalThis as typeof globalThis & {__atlasDemoWrites?:Promise<unknown>};
function change(edit:(data:Store)=>void):Promise<void>{
 const run=(shared.__atlasDemoWrites||Promise.resolve()).then(async()=>{
  const data=await load();edit(data);const temp=file+'.'+randomUUID()+'.tmp';
  await writeFile(temp,JSON.stringify(data));await rename(temp,file);
 });
 shared.__atlasDemoWrites=run.catch(()=>{});return run;
}
export async function readAccount(id:UserId){
 const user=(await load()).users[id];
 // internalToken 不进入页面、RSC props 或 API。
 return {id,displayName:user.displayName,note:user.note};
}
export async function readCatalog(){return {...(await load()).catalog,readId:randomUUID()};}
export function writeNote(id:UserId,note:string){return change(data=>{data.users[id].note=note;});}
export function writeCatalog(title:string){return change(data=>{data.catalog={title,revision:data.catalog.revision+1};});}
