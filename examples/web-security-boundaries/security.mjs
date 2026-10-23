import {timingSafeEqual} from 'node:crypto';
export class Rejected extends Error { constructor(code) {super(code); this.code=code;} }
function requireValue(value, code) {if(!value) throw new Rejected(code);}
export const APP_ORIGIN = 'http://127.0.0.1:4312';
export function htmlText(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function equal(a,b) {
  return typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a),Buffer.from(b));
}
export function authorizeWrite({method, origin, csrf}, session, document) {
  requireValue(session, 'unauthenticated');
  requireValue(method==='POST', 'method_not_allowed');
  requireValue(origin===APP_ORIGIN, 'origin_mismatch');
  requireValue(equal(csrf,session.csrf), 'csrf_mismatch');
  // The resource owner comes from stored data, never from request.owner or role.
  requireValue(document && document.owner===session.user, 'not_found_or_forbidden');
}
// This lab intentionally has no arbitrary URL fetcher. Only a configured document ID maps to a URL.
const DOCUMENTS = new Map([['guide','https://docs.example.invalid/guide.txt']]);
export function outboundUrl(id) {
  requireValue(typeof id==='string' && DOCUMENTS.has(id), 'unknown_document');
  const url=new URL(DOCUMENTS.get(id));
  requireValue(url.protocol==='https:' && url.hostname==='docs.example.invalid' &&
    !url.username && !url.password && (!url.port || url.port==='443'), 'invalid_target');
  return url.href;
}
export async function fetchDocument(id, transport, maxBytes=1024) {
  const url=outboundUrl(id);
  // Real fetch adapter must retain redirect:error and the timeout, not auto-follow.
  const response=await transport(url,{redirect:'error',signal:AbortSignal.timeout(1000)});
  requireValue(response.status===200,'upstream_status');
  requireValue(response.body && Symbol.asyncIterator in response.body,'invalid_body');
  const chunks=[]; let bytes=0;
  for await (const raw of response.body) {
    const chunk=Buffer.from(raw);bytes+=chunk.length;
    if(bytes>maxBytes) {
      // Exiting for-await calls the iterator return method; the adapter must implement stream cleanup.
      throw new Rejected('response_too_large');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
