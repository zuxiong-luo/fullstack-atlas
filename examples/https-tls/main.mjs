import { startLab,get } from './lab.mjs';
const lab=await startLab();
try { console.log(JSON.stringify(await get(lab),null,2)); }
finally { await lab.close(); }
