import 'server-only';
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import type {User} from './auth';
import {Failure} from './errors';
type Note={id:string;owner:User;title:string};
type Receipt={owner:User;key:string;fingerprint:string;note:Note};
type State={notes:Note[];receipts:Receipt[]};
const file=process.env.DEMO_DATA_FILE??'data/notes.json';
const shared=globalThis as typeof globalThis & {atlasNextWritesQueue?:Promise<void>};
async function readState():Promise<State>{
 let raw:string;try{raw=await readFile(file,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {notes:[],receipts:[]};throw error;}
 const state=JSON.parse(raw);if(!Array.isArray(state.notes)||!Array.isArray(state.receipts))throw new Error('invalid state');return state;
}
async function locked<T>(work:()=>Promise<T>):Promise<T>{
 const previous=shared.atlasNextWritesQueue??Promise.resolve();let release=()=>{};
 shared.atlasNextWritesQueue=new Promise<void>(resolve=>{release=resolve;});
 await previous;try{return await work();}finally{release();}
}
export async function listNotes(owner:User){return (await readState()).notes.filter(note=>note.owner===owner);}
export async function createNote(owner:User,input:{title:string;key:string}):Promise<Note>{
 return locked(async()=>{
  const state=await readState();
  const fingerprint=createHash('sha256').update(JSON.stringify({title:input.title})).digest('hex');
  const old=state.receipts.find(item=>item.owner===owner&&item.key===input.key);
  if(old){if(old.fingerprint!==fingerprint)throw new Failure(409,'KEY_REUSED');return old.note;}
  const note={id:randomUUID(),owner,title:input.title};
  state.notes.push(note);state.receipts.push({owner,key:input.key,fingerprint,note});
  await mkdir(dirname(file),{recursive:true});const temporary=file+'.'+randomUUID()+'.tmp';
  try{await writeFile(temporary,JSON.stringify(state));await rename(temporary,file);}
  finally{await rm(temporary,{force:true});}
  return note;
 });
}
