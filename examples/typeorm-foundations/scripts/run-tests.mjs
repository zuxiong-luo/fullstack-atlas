import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const bin=process.env.PG_BIN ?? '/Library/PostgreSQL/17/bin';
const run=(name,args,env=process.env)=>{const r=spawnSync(join(bin,name),args,{env,stdio:'inherit',timeout:30000});if(r.status!==0)throw new Error(`${name} failed: ${r.status}`)};
const external=process.env.DATABASE_URL;
let dir; let started=false; let result;
try {
 if(!external){
  dir=mkdtempSync(join(tmpdir(),'typeorm-lab-'));const port=process.env.PG_PORT??'55483';
  run('initdb',['-D',dir,'-A','trust','--no-locale','-E','UTF8']);
  run('pg_ctl',['-D',dir,'-l',join(dir,'server.log'),'-o',`-p ${port} -h 127.0.0.1 -k ${dir}`,'start']);started=true;
  run('createdb',['-h','127.0.0.1','-p',port,'typeorm_content']);
  process.env.DATABASE_URL=`postgres://127.0.0.1:${port}/typeorm_content`;
 }
 result=spawnSync(process.execPath,['--test','dist/lab.test.js'],{env:process.env,stdio:'inherit',timeout:90000});
 if(result.error)console.error(result.error);
} finally {
 if(dir){
  // The directory is exclusively ours. start may have timed out after spawning
  // PostgreSQL, so consult this PGDATA rather than trusting the started flag.
  let safeToRemove=!started&&!existsSync(join(dir,'postmaster.pid'));
  if(started||existsSync(join(dir,'postmaster.pid'))){
   const status=spawnSync(join(bin,'pg_ctl'),['-D',dir,'status'],{encoding:'utf8',timeout:5000});
   if(status.status===0){
    const stop=spawnSync(join(bin,'pg_ctl'),['-D',dir,'-m','fast','stop'],{stdio:'inherit',timeout:30000});
    const after=spawnSync(join(bin,'pg_ctl'),['-D',dir,'status'],{encoding:'utf8',timeout:5000});
    safeToRemove=stop.status===0&&after.status===3;
   }else safeToRemove=status.status===3;
  }
  if(safeToRemove)rmSync(dir,{recursive:true,force:true});
  else{console.error(`Cleanup incomplete; retained private PGDATA: ${dir}`);result={status:1};}
 }

}
process.exitCode=result?.status??1;
