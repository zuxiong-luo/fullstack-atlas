import { spawn, exec, execFile, fork } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';
import {firstMessage,childExit} from './child-events.mjs';
const execute=promisify(exec), executeFile=promisify(execFile);
export async function processModes({peerMode='ok'}={}) {
  if(!['ok','exit','silence'].includes(peerMode))throw new RangeError('INVALID_PEER_MODE');
  // The text is fixed teaching data. Never interpolate external input into a shell command.
  const input='hello; printf SHELL_MARK';
  const child=spawn(process.execPath,['-e','process.stdout.write(process.argv[1])',input],{shell:false,stdio:['ignore','pipe','pipe']});
  let literal='';child.stdout.setEncoding('utf8');child.stdout.on('data',part=>literal+=part);
  const [code]=await once(child,'close');if(code!==0)throw new Error('SPAWN_FAILED');
  const {stdout:fileOutput}=await executeFile(process.execPath,['-e','process.stdout.write(process.argv[1])',input],{timeout:2000});
  let shellOutput=null;
  if(process.platform!=='win32') shellOutput=(await execute('printf hello; printf SHELL_MARK',{timeout:2000})).stdout;
  let bufferError=null;
  try { await executeFile(process.execPath,['-e','process.stdout.write("x".repeat(4096))'],{maxBuffer:64,timeout:2000}); }
  catch(error){bufferError=error.code;}
  const peer=fork(new URL('./process-modes.mjs',import.meta.url),['--peer',peerMode],{stdio:['ignore','ignore','pipe','ipc']});
  try {const message=firstMessage(peer,{timeoutMs:peerMode==='silence'?300:3000});peer.send({count:7});const reply=await message;await childExit(peer,{signal:null});return {input,literal,fileOutput,shellOutput,bufferError,reply,parentPid:process.pid};}
  finally {await childExit(peer);}
}
if(process.argv.includes('--peer')) process.once('message',message=>{
 const mode=process.argv.at(-1);if(mode==='exit'){process.exitCode=7;process.disconnect();return;}if(mode==='silence'){setInterval(()=>{},1000);return;}
 process.send({count:message.count+1,pid:process.pid},()=>process.disconnect());
});
else if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url) console.log(JSON.stringify(await processModes()));
