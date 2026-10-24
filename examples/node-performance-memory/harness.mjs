import {fork} from 'node:child_process';
export async function spawnServer(){
 const child=fork(new URL('./server.mjs',import.meta.url),['--child'],{stdio:['ignore','ignore','pipe','ipc']});let errors='';child.stderr.on('data',x=>errors+=x);
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('BOOT_TIMEOUT '+errors)),5000);child.once('message',m=>{clearTimeout(timer);resolve(m.base);});child.once('error',error=>{clearTimeout(timer);reject(error);});});
 return {base,async close(){if(child.exitCode!==null)return;const done=new Promise(resolve=>child.once('exit',resolve));child.send('close');const timer=setTimeout(()=>child.kill('SIGKILL'),2000);try{await done;}finally{clearTimeout(timer);}}};
}
