export function noteId(value) {
  if (typeof value !== 'string' || !['n1', 'n2'].includes(value)) throw new RangeError('unknown teaching note');
  return value;
}

export function createSession(load, publish) {
  let generation = 0, active = false, controller;
  function pause(notify = true) {
    active = false;
    generation += 1;
    controller?.abort();
    controller = undefined;
    if (notify) publish({status: 'paused'});
  }
  function start(value) {
    const id = noteId(value);
    pause(false);
    active = true;
    controller = new AbortController();
    const owned = controller, current = generation;
    publish({status: 'loading', id});
    // A capability may ignore AbortSignal: the generation check still owns publication.
    const completion = Promise.resolve().then(() => load(id, owned.signal)).then(
      note => {
        if (!active || current !== generation) return 'discarded';
        publish({status: 'ready', id, note});
        return 'published';
      },
      error => {
        if (!active || current !== generation) return 'discarded';
        publish({status: 'error', id, code: error?.name === 'AbortError' ? 'cancelled' : 'load-failed'});
        return 'failed';
      },
    );
    return completion;
  }
  return {start, pause, dispose: () => pause(false)};
}

export function observeAppState(source, publish) {
  const subscription = source.addEventListener('change', publish);
  // Subscribe before rereading: a render-time null snapshot may already be active.
  publish(source.currentState);
  return () => subscription.remove();
}
