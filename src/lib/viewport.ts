/** Supplement touch-action for Safari's legacy page-zoom gestures. */
export function installViewportGestures(target: EventTarget): () => void {
  const preventGesture = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  const preventPinch = (event: Event) => {
    const touches = (event as TouchEvent).touches;
    if (touches?.length > 1) preventGesture(event);
  };
  const options: AddEventListenerOptions = { passive: false, capture: true };
  const listeners: Array<[string, EventListener]> = [
    ['gesturestart', preventGesture],
    ['gesturechange', preventGesture],
    ['touchstart', preventPinch],
    ['touchmove', preventPinch],
  ];
  for (const [name, listener] of listeners) target.addEventListener(name, listener, options);
  return () => {
    for (const [name, listener] of listeners) target.removeEventListener(name, listener, options);
  };
}
