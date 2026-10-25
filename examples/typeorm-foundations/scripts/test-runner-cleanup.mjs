// Lifecycle unit test only: does not validate or emulate PostgreSQL SQL.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,existsSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';
for(const mode of ['start-failed-stop-ok','start-failed-stop-failed','start-failed-status-unknown']){
 test(mode,()=>{
  const root=mkdtempSync(join(tmpdir(),'typeorm-runner-unit-')),record=join(root,'record');let pgdata;
  try{
   const executable=`#!${process.execPath}\n`+String.raw`
const fs=require('node:fs');const path=require('node:path');const args=process.argv.slice(2);const name=path.basename(process.argv[1]);const d=args[args.indexOf('-D')+1];
if(name==='initdb'){fs.writeFileSync(process.env.RUNNER_RECORD,d);process.exit(0);}
if(name==='pg_ctl'){
 if(args.includes('start')){fs.writeFileSync(path.join(d,'postmaster.pid'),'mock-no-process');fs.writeFileSync(path.join(d,'mock-running'),'1');process.exit(1);}
 if(args.includes('status')){if(process.env.RUNNER_MODE==='start-failed-status-unknown')process.exit(4);process.exit(fs.existsSync(path.join(d,'mock-running'))?0:3);}
 if(args.includes('stop')){if(process.env.RUNNER_MODE==='start-failed-stop-failed')process.exit(1);fs.unlinkSync(path.join(d,'mock-running'));fs.unlinkSync(path.join(d,'postmaster.pid'));process.exit(0);}
}
process.exit(0);`;
   for(const name of ['initdb','pg_ctl','createdb']){writeFileSync(join(root,name),executable);chmodSync(join(root,name),0o700);}
   const env={...process.env,PG_BIN:root,RUNNER_RECORD:record,RUNNER_MODE:mode};delete env.DATABASE_URL;
   const child=spawnSync(process.execPath,[resolve('scripts/run-tests.mjs')],{env,encoding:'utf8',timeout:10000});
   assert.notEqual(child.status,0);pgdata=readFileSync(record,'utf8');
   assert.equal(existsSync(pgdata),mode!=='start-failed-stop-ok');
   if(mode!=='start-failed-stop-ok')assert.match(child.stderr,/retained private PGDATA/);
  }finally{if(pgdata)rmSync(pgdata,{recursive:true,force:true});rmSync(root,{recursive:true,force:true});}
 });
}
