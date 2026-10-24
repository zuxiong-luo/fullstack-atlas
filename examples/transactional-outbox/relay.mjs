import {session} from './postgres.mjs';
import {redis} from './redis.mjs';
export async function relayOnce({crashAfterPublish=false}={}) {
  const connection=session('outbox-relay');
  let ended=false;
  try {
    connection.send("BEGIN; SELECT json_build_object('id',event_id,'amount',amount) FROM outbox WHERE published_at IS NULL ORDER BY sequence FOR UPDATE SKIP LOCKED LIMIT 1;\n\\echo SELECTED");
    const output=await connection.wait('SELECTED');
    const line=output.split('\n').find(x=>x.startsWith('{'));
    if(!line){await connection.end();ended=true;return null;}
    const event=JSON.parse(line);
    if(!/^[a-z0-9-]{1,60}$/.test(event.id)||!Number.isSafeInteger(event.amount)||event.amount<=0)throw new Error('BAD_EVENT');
    const streamId=await redis('XADD','events','*','event',event.id,'amount',event.amount);
    if(crashAfterPublish)process.kill(process.pid,'SIGKILL');
    const result=await connection.end(`UPDATE outbox SET published_at=clock_timestamp() WHERE event_id='${event.id}'; COMMIT;`);
    ended=true;if(result.code!==0)throw new Error(result.error);
    return {event,streamId};
  } finally {if(!ended)await connection.end();}
}
if(process.argv.includes('--once'))await relayOnce({crashAfterPublish:process.argv.includes('--crash-after-publish')});
