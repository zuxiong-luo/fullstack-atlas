export function applyEvent(view, event) {
  if (!Number.isSafeInteger(event.id) || event.id <= view.lastId) return view;
  if (event.id !== view.lastId + 1) throw new Error("EVENT_GAP");
  const status = ["completed", "cancelled", "failed"].includes(event.type)
    ? event.type
    : view.status;
  return {
    ...view,
    lastId: event.id,
    status,
    text: view.text + (event.type === "delta" ? event.data.text : ""),
  };
}
