import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createRows } from './rows.mjs';
let produced = 0, consumed = 0, maxAhead = 0;
const source = createRows({
  count: 30, delayMs: 0, highWaterMark: 1024,
  onRow: () => { produced += 1; maxAhead = Math.max(maxAhead, produced - consumed); },
});
const destination = new Writable({
  highWaterMark: 1,
  write(chunk, encoding, callback) {
    setTimeout(() => { if (chunk.toString() !== 'id,payload\n') consumed += 1; callback(); }, 3);
  },
});
await pipeline(source, destination);
console.log(JSON.stringify({ produced, consumed, maxAhead }));
