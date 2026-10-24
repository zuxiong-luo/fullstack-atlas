import { setImmediate as nextTurn } from 'node:timers/promises';
export async function sumInChunks(count, { signal, chunkSize = 1000 } = {}) {
  if (!Number.isSafeInteger(count) || count < 0 || count > 1000000 ||
      !Number.isSafeInteger(chunkSize) || chunkSize < 1 || chunkSize > 10000) {
    throw new RangeError('bounded count and chunkSize required');
  }
  let sum = 0;
  for (let start = 0; start < count; start += chunkSize) {
    signal?.throwIfAborted();
    const end = Math.min(start + chunkSize, count);
    for (let i = start; i < end; i += 1) sum += i;
    await nextTurn(undefined, { signal });
  }
  signal?.throwIfAborted();
  return sum;
}
