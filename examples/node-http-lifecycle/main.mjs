import { createApp } from './server.mjs';
const app = createApp();
app.server.listen(4313, '127.0.0.1', () => console.log('http://127.0.0.1:4313 POST /notes'));
let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`draining:${signal}`);
  try { await app.close(500); console.log(JSON.stringify(app.snapshot)); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
process.on('SIGTERM', () => void stop('SIGTERM'));
process.on('SIGINT', () => void stop('SIGINT'));
