import { execFile, execFileSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const execute = promisify(execFile);
const children = new Set();
export const bin = process.env.PG_BIN || '/Library/PostgreSQL/17/bin';
export const port = '55441';
const args = ['-X','-h','127.0.0.1','-p',port,'-U','atlas','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At'];
const environment = name => ({...process.env, PGAPPNAME:name, PGCONNECT_TIMEOUT:'2', LC_ALL:'C'});
export async function query(statement, name='atlas-data') {
  return execute(join(bin,'psql'),[...args,'-c',statement],{env:environment(name),timeout:15000,maxBuffer:8*1024*1024});
}
export async function sql(statement,name) { return (await query(statement,name)).stdout.trim(); }
export async function until(predicate,label='condition',timeout=7000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline) { if(await predicate()) return; await new Promise(resolve=>setTimeout(resolve,10)); }
  throw new Error('Not observed before deadline: '+label);
}
export function session(name) {
  const child=spawn(join(bin,'psql'),args,{env:environment(name),stdio:['pipe','pipe','pipe']});
  children.add(child);
  let output='',error='',closed=false;
  child.stdout.on('data',chunk=>{output+=chunk;});
  child.stderr.on('data',chunk=>{error+=chunk;});
  child.stdin.on('error',()=>{});
  const done=new Promise((resolve,reject)=>{
    child.once('error',reject);
    child.once('close',code=>{closed=true;children.delete(child);resolve({code,output,error});});
  });
  return {
    send(statement) { if(closed) throw new Error(name+' closed: '+error); child.stdin.write(statement+'\n'); },
    async wait(marker) { await until(()=>{if(closed&&!output.includes(marker))throw new Error(name+': '+error);return output.includes(marker);},name+' '+marker); return output; },
    end(statement='ROLLBACK;') { if(!closed)child.stdin.end(statement+'\n\\q\n'); return done; },
    result:done,
  };
}
export async function withCluster(run) {
  const directory=await mkdtemp(join(tmpdir(),'atlas-pg17-data-'));
  const data=join(directory,'data'),socket=join(directory,'socket');
  await mkdir(socket,{mode:0o700});
  let started=false;
  try {
    execFileSync(join(bin,'initdb'),['-D',data,'-U','atlas','-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
    execFileSync(join(bin,'pg_ctl'),['-D',data,'-l',join(directory,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${socket}`,'-w','start'],{stdio:'pipe'});
    started=true;
    const version=await sql('SHOW server_version_num;');
    if(Number(version)<170000||Number(version)>=180000)throw new Error('Requires PostgreSQL 17, got '+version);
    await run();
  } finally {
    for(const child of children)child.kill('SIGTERM');
    if(started)execFileSync(join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'pipe'});
    await rm(directory,{recursive:true,force:true});
  }
}
