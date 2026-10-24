import { execFile,spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const execute=promisify(execFile);
export const port=56382;
export async function redis(...args) {
  const {stdout}=await execute(process.env.REDIS_CLI||'redis-cli',['--json','-h','127.0.0.1','-p',String(port),...args.map(String)],{timeout:5000,maxBuffer:1024*1024});
  if(args[0]==='INFO')return stdout; // redis-cli 7 emits INFO as plain text even with --json.
  try {return JSON.parse(stdout);}catch {throw new Error('Redis command failed: '+stdout.trim());}
}
export async function withRedis(run) {
  const directory=await mkdtemp(join(tmpdir(),'atlas-cache-'));
  let child;
  async function start() {
    let logs='';
    child=spawn(process.env.REDIS_SERVER||'redis-server',['--bind','127.0.0.1','--port',String(port),'--protected-mode','yes','--dir',directory,'--save','','--appendonly','yes','--appendfsync','always'],{stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',x=>{logs+=x;});child.stderr.on('data',x=>{logs+=x;});
    let failed;child.once('error',error=>{failed=error;});
    const deadline=Date.now()+5000;
    while(!logs.includes('Ready to accept connections')) {
      if(failed)throw failed;
      if(child.exitCode!==null||Date.now()>=deadline)throw new Error('Private Redis did not start: '+logs);
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    const info=await redis('INFO','server');
    if(!info.includes('redis_version:7.0.4'))throw new Error('Lab verified with Redis 7.0.4; got '+info.split('\r\n').find(x=>x.startsWith('redis_version:')));
  }
  async function stop() {
    if(child&&child.exitCode===null) {
      const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited;
    }
  }
  try {await start();await run({stop,start,restart:async()=>{await stop();await start();}});}
  finally {await stop();await rm(directory,{recursive:true,force:true});}
}
