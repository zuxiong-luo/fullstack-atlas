const raw = process.env.EXPO_PUBLIC_LAB_REPORT_URL;
export const labBase = /^http:\/\/(10\.0\.2\.2|127\.0\.0\.1):[0-9]{1,5}$/.test(raw ?? '') ? raw : null;
let pending = 0, tail = Promise.resolve();
export function report(event, fields = {}) {
  const record = {event, ...fields};
  console.info('ATLAS_DELIVERY_LAB', JSON.stringify(record));
  if (!labBase || pending >= 32) return;
  pending += 1;
  tail = tail.then(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      await fetch(labBase + '/events', {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(record), signal: controller.signal});
    } catch { /* Reports are optional lab observations, never an upload of user content. */ }
    finally {clearTimeout(timer); pending -= 1;}
  });
}
