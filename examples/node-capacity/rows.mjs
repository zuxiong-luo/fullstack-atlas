import { Readable } from 'node:stream';
import { setTimeout as pause, setImmediate as yieldTurn } from 'node:timers/promises';

export function createRows({ count, delayMs = 1, failAt = 0, signal, onRow = () => {}, highWaterMark = 16 * 1024 }) {
  async function* generate() {
    yield Buffer.from('id,payload\n');
    for (let id = 1; id <= count; id += 1) {
      signal?.throwIfAborted();
      if (id === failAt) throw new Error('INJECTED_SOURCE_FAILURE');
      // Simulated cancellable I/O, not a real database cursor.
      if (delayMs > 0) await pause(delayMs, undefined, { signal });
      else await yieldTurn(undefined, { signal });
      signal?.throwIfAborted();
      onRow(id);
      yield Buffer.from(`${id},${'x'.repeat(1024)}\n`);
    }
  }
  return Readable.from(generate(), { objectMode: false, highWaterMark });
}
