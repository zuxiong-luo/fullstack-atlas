import 'server-only';
import { readFile,writeFile,mkdir,rename,rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
export const dataFile=process.env.DEMO_DATA_FILE??'data/catalog.json';
export async function readCatalog(){
  let text:string;
  try{text=await readFile(dataFile,'utf8');}catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    await writeCatalog({title:'课程目录 v1',revision:1});text=await readFile(dataFile,'utf8');
  }
  const value=JSON.parse(text);
  if(typeof value.title!=='string'||!Number.isSafeInteger(value.revision))throw new Error('invalid catalog');
  return {title:value.title as string,revision:value.revision as number,readId:randomUUID()};
}
export async function writeCatalog(value:{title:string;revision:number}){
  await mkdir(dirname(dataFile),{recursive:true});
  const temporary=dataFile+'.'+randomUUID()+'.tmp';
  try{await writeFile(temporary,JSON.stringify(value));await rename(temporary,dataFile);}
  finally{await rm(temporary,{force:true});}
}
