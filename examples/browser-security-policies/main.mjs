import {startLab} from './server.mjs';
const lab=await startLab({apiPort:4351,uiPort:4352});
console.log('Browser UI:',lab.uiOrigin,'API:',lab.apiOrigin,'CSP:',lab.uiOrigin+'/csp');
console.log('HTTP loopback fixture only; stop with Ctrl-C. No system trust settings are changed.');
let closing=false;async function stop(){if(closing)return;closing=true;await lab.close();}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
