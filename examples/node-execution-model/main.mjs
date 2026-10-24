import { readFile } from 'node:fs/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';

// An async function runs synchronously until it reaches a suspension point.
export async function cpuInAsync(trace) {
  trace.push('cpu:start');
  let total = 0;
  for (let i = 0; i < 10000; i += 1) total += i;
  trace.push(`cpu:end:${total}`);
  return total;
}

export async function experiment() {
  const trace = [];
  const work = cpuInAsync(trace);
  trace.push('caller:promise');
  await work;
  trace.push('caller:awaited');
  const content = await readFile(new URL('./fixture.txt', import.meta.url), 'utf8');
  trace.push(`file:${content.trim()}`);
  await nextTurn();
  trace.push('turn:resumed');
  return trace;
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  console.log((await experiment()).join('\n'));
}
