import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function start(port, env = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'atlas-next-'));
  const base = `http://127.0.0.1:${port}`;
  let logs = '';
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd:process.cwd(),env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',DEMO_LAB:'1',DEMO_APP_ORIGIN:base,...env},stdio:['ignore','pipe','pipe'],
  });
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  child.on('error', error => { logs += error.stack; });
  async function stop() {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([new Promise(resolve => child.once('exit',resolve)),pause(4000)]);
      if (child.exitCode === null) {
        child.kill('SIGKILL');
        await Promise.race([new Promise(resolve => child.once('exit',resolve)),pause(1000)]);
      }
    }
    await rm(dir,{recursive:true,force:true});
  }
  const deadline = Date.now()+45000;
  while (Date.now()<deadline) {
    try { if ((await fetch(base,{signal:AbortSignal.timeout(2000)})).ok) return {base,dir,stop,get logs(){return logs;}}; } catch {}
    if (child.exitCode!==null) {await stop();throw new Error(logs);}
    await pause(150);
  }
  await stop();throw new Error('server not ready: '+logs);
}
export async function flight(base,path) {
  let target = new URL(path,base);
  for(let i=0;i<3;i+=1) {
    const res=await fetch(target,{redirect:'manual',headers:{RSC:'1'},signal:AbortSignal.timeout(5000)});
    if(res.status!==307) return {res,text:await res.text()};
    target=new URL(res.headers.get('location'),base);
    if(target.origin!==base)throw new Error('unexpected external redirect');
  }
  throw new Error('RSC redirect loop');
}
