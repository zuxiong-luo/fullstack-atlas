import {loadConfig} from './runtime/config.mjs';
try{loadConfig();}catch(error){console.error(JSON.stringify({event:'boot.rejected',code:error.message}));process.exit(1);}
process.env.PORT||='4336';process.env.HOSTNAME='127.0.0.1';process.env.NEXT_TELEMETRY_DISABLED='1';
await import('./server.js');
