import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
export async function withCluster(run){
 const bin=process.env.PG_BIN||'/Library/PostgreSQL/17/bin',root=await mkdtemp(join(tmpdir(),'apg46-'));
 const data=join(root,'data'),socket=join(root,'socket'),port=55446;await mkdir(socket,{mode:0o700});let started=false;
 try{
  execFileSync(join(bin,'initdb'),['-D',data,'-U','atlas','-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
  // No TCP listener; the private 0700 directory owns the socket and contains all fictional data.
  execFileSync(join(bin,'pg_ctl'),['-D',data,'-l',join(root,'server.log'),'-o',`-h '' -p ${port} -k ${socket}`,'-w','start'],{stdio:'pipe'});started=true;
  const config={host:socket,port,user:'atlas',database:'postgres',connectionTimeoutMillis:2000,statement_timeout:3000};
  await run(config);
 }catch(error){const log=await readFile(join(root,'server.log'),'utf8').catch(()=>'');if(log)error.message+='\n'+log;throw error;}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'pipe'});await rm(root,{recursive:true,force:true});}
}
