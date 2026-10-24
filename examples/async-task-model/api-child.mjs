import pg from 'pg';import {startServer} from './server.mjs';
const pool=new pg.Pool({...JSON.parse(process.env.ATLAS_DB_CONFIG),max:2});
const stopAt=async stage=>{process.send?.({stage});await new Promise(()=>{});};
const hooks=process.env.ATLAS_FAULT==='before-commit'?{beforeCommit:()=>stopAt('before-commit')}:process.env.ATLAS_FAULT==='after-commit'?{afterCommit:()=>stopAt('after-commit')}:{};
const server=await startServer(pool,process.env.ATLAS_TEACHING_TOKEN,hooks);process.send?.({stage:'ready',base:server.base});
let closing=false;
async function close(){if(closing)return;closing=true;await server.close();await pool.end();process.disconnect?.();}
process.once('SIGTERM',close);process.once('SIGINT',close);
