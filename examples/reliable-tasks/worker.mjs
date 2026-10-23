import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sql } from './harness.mjs';
const owner = 'worker-process';
const claimed = await sql("SELECT * FROM claim_job('worker-process',1000);");
if (!claimed) process.exit(0);
const [id, token] = claimed.split('|');
if (![id, token].every(value => /^\d+$/.test(value))) throw new Error('invalid database identity');
// An immutable attempt-specific artifact. This write is outside the DB transaction.
const key = `${id}-${token}.txt`;
await writeFile(join(process.env.ARTIFACT_DIR, key), `generated:${id}:${token}`, { flag: 'wx' });
if (process.argv.includes('--crash-after-file')) process.exit(23);
const result = await sql(`SELECT complete_job(${id},'${owner}',${token},'${key}');`);
console.log(result);
