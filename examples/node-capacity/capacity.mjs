// No waiting queue: a caller either receives a lease or is rejected immediately.
export function createCapacity(maxActive) {
  if (!Number.isSafeInteger(maxActive) || maxActive < 1) {
    throw new RangeError('maxActive must be a positive integer');
  }
  let active = 0;
  return {
    get active() { return active; },
    tryAcquire() {
      if (active >= maxActive) return null;
      active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active -= 1;
      };
    },
  };
}
