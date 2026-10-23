import { execFile, execFileSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const execute = promisify(execFile);
export const bin = process.env.PG_BIN || '/Library/PostgreSQL/17/bin';
export const port = '55439';
export function clientArgs() { return ['-X', '-h', '127.0.0.1', '-p', port, '-U', 'atlas', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']; }
export async function sql(statement, name = 'atlas-lab') {
  const { stdout } = await execute(join(bin, 'psql'), [...clientArgs(), '-c', statement], { env: { ...process.env, PGAPPNAME: name, PGCONNECT_TIMEOUT: '2' } });
  return stdout.trim();
}
export function session(name) {
  const child = spawn(join(bin, 'psql'), clientArgs(), { env: { ...process.env, PGAPPNAME: name, PGCONNECT_TIMEOUT: '2' }, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', error = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { error += chunk; });
  const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve({ code, output, error })); });
  return {
    send(text) { child.stdin.write(text + '\n'); },
    async wait(marker) { for (let n = 0; n < 400; n++) { if (output.includes(marker)) return output; await new Promise(r => setTimeout(r, 5)); } throw new Error('session marker not reached: ' + marker + error); },
    async end(text = 'ROLLBACK;') { child.stdin.end(text + '\n\\q\n'); return done; },
  };
}
export async function waitFor(predicate) { for (let n = 0; n < 400; n++) { if (await predicate()) return; await new Promise(r => setTimeout(r, 5)); } throw new Error('condition not reached'); }
export async function temporaryCluster(run) {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-pg-lab-'));
  const data = join(directory, 'data'), socket = join(directory, 'socket');
  await mkdir(socket, { mode: 0o700 });
  let started = false;
  function start() { execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${socket}`, '-w', 'start'], { stdio: 'pipe' }); started = true; }
  function stop() { if (started) { execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'pipe' }); started = false; } }
  try {
    execFileSync(join(bin, 'initdb'), ['-D', data, '-U', 'atlas', '-A', 'trust', '--no-locale', '-E', 'UTF8'], { stdio: 'pipe' });
    start();
    await run({ directory, async restart() { stop(); start(); } });
  } finally { stop(); await rm(directory, { recursive: true, force: true }); }
}
