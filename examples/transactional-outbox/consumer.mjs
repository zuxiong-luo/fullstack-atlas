import {sql} from './postgres.mjs';
import {redis,firstMessage} from './redis.mjs';
export async function consume(message,{crashAfterCommit=false}={}) {
  const [streamId,fields]=message;
  const event=Object.fromEntries(Array.from({length:fields.length/2},(_,i)=>[fields[i*2],fields[i*2+1]]));
  if(!/^[a-z0-9-]{1,60}$/.test(event.event)||!/^\d{1,6}$/.test(event.amount))throw new Error('BAD_EVENT');
  // Trusted bounded fixture values; production driver must bind parameters.
  const result=await sql(`SELECT consume_event('${event.event}',${Number(event.amount)});`,'outbox-consumer');
  if(crashAfterCommit)process.kill(process.pid,'SIGKILL');
  await redis('XACK','events','wallet-workers',streamId);
  return result;
}
if(process.argv.includes('--once')) {
  const message=firstMessage(await redis('XREADGROUP','GROUP','wallet-workers','consumer-a','COUNT',1,'STREAMS','events','>'));
  if(!message)throw new Error('NO_MESSAGE');
  await consume(message,{crashAfterCommit:process.argv.includes('--crash-after-commit')});
}
