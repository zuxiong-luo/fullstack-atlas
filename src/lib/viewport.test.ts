import { describe, expect, it } from 'vitest';
import { installViewportGestures } from './viewport';

function touchEvent(type: string, fingers: number) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'touches', { value: { length: fingers } });
  return event;
}

describe('page zoom gestures', () => {
  it('cancels Safari zoom and multi-finger touch gestures', () => {
    const target = new EventTarget();
    const cleanup = installViewportGestures(target);
    for (const type of ['gesturestart', 'gesturechange']) {
      expect(target.dispatchEvent(new Event(type, { cancelable: true }))).toBe(false);
    }
    for (const type of ['touchstart', 'touchmove']) {
      expect(target.dispatchEvent(touchEvent(type, 2))).toBe(false);
      expect(target.dispatchEvent(touchEvent(type, 3))).toBe(false);
    }
    cleanup();
  });

  it('preserves single-finger scrolling, taps, selection and input events', () => {
    const target = new EventTarget();
    const cleanup = installViewportGestures(target);
    for (const type of ['touchstart', 'touchmove', 'touchend']) {
      expect(target.dispatchEvent(touchEvent(type, 1))).toBe(true);
    }
    for (const type of ['click', 'dblclick', 'selectstart', 'input', 'wheel', 'keydown']) {
      expect(target.dispatchEvent(new Event(type, { cancelable: true }))).toBe(true);
    }
    cleanup();
  });

  it('removes every listener when disposed', () => {
    const target = new EventTarget();
    const cleanup = installViewportGestures(target);
    cleanup();
    for (const type of ['gesturestart', 'gesturechange', 'touchstart', 'touchmove']) {
      expect(target.dispatchEvent(touchEvent(type, 2))).toBe(true);
    }
  });
});
