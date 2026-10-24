import {redis,apply,firstMessage} from './redis.mjs';
const [mode='safe',fault='none']=process.argv.slice(2);
const message=firstMessage(await redis('XREADGROUP','GROUP','workers','worker-a','COUNT',1,'STREAMS','events','>'));
if(!message)throw new Error('NO_MESSAGE');
if(fault==='after-read')process.exit(23);
if(fault==='after-ack'){await redis('XACK','events','workers',message[0]);process.exit(23);}
if(mode==='naive')await redis('INCRBY','naive-balance',10);else await apply(message);
if(fault==='after-effect')process.exit(23);
await redis('XACK','events','workers',message[0]);
