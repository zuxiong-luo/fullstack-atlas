import http from 'node:http';
import {Issuer, Client, ProtocolError} from './protocol.mjs';
const issuer = new Issuer(), client = new Client();
function respond(res, status, data, headers = {}) {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers});
  res.end(JSON.stringify(data));
}
function cookie(sid) { return `atlas_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=300`; }
function session(req) { return /(?:^|;\s*)atlas_sid=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1]; }
async function body(req) {
  let value = '';
  for await (const chunk of req) {
    value += chunk;
    if (Buffer.byteLength(value) > 8192) throw new ProtocolError('body_too_large');
  }
  return Object.fromEntries(new URLSearchParams(value));
}
async function localCall(path, params) {
  const res = await fetch(`http://127.0.0.1:4310${path}`, params);
  const data = await res.json();
  if (!res.ok) throw new ProtocolError(data.error ?? 'issuer_error');
  return data;
}
const issuerServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4310');
    if (req.method === 'GET' && url.pathname === '/authorize') {
      // Teaching shortcut: a fixed demo subject is already authenticated and consents.
      res.writeHead(302, {Location: issuer.authorize(Object.fromEntries(url.searchParams)), 'Cache-Control': 'no-store'}); res.end();
    } else if (req.method === 'POST' && url.pathname === '/token') {
      respond(res, 200, issuer.exchange(await body(req)));
    } else if (req.method === 'GET' && url.pathname === '/profile') {
      respond(res, 200, issuer.profile(/^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1]));
    } else respond(res, 404, {error: 'not_found'});
  } catch (error) { respond(res, 400, {error: error instanceof ProtocolError ? error.code : 'internal'}); }
});
const clientServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4311');
    if (req.method === 'GET' && url.pathname === '/login') {
      const start = client.begin();
      res.writeHead(302, {'Set-Cookie': cookie(start.sid), Location: `http://127.0.0.1:4310/authorize?${new URLSearchParams(start.params)}`, 'Cache-Control': 'no-store'}); res.end();
    } else if (req.method === 'GET' && url.pathname === '/callback') {
      const result = await client.callback(session(req), Object.fromEntries(url.searchParams),
        params => localCall('/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(params), signal: AbortSignal.timeout(2000)}),
        token => localCall('/profile', {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(2000)}));
      respond(res, 200, {demo: true, user: result.user}, {'Set-Cookie': cookie(result.sid)});
    } else if (req.method === 'GET' && url.pathname === '/me') {
      const user = client.me(session(req)); respond(res, user ? 200 : 401, user ? {user} : {error: 'not_logged_in'});
    } else if (req.method === 'POST' && url.pathname === '/logout') {
      if (req.headers.origin !== 'http://127.0.0.1:4311') throw new ProtocolError('origin_mismatch');
      client.logout(session(req)); respond(res, 200, {ok: true}, {'Set-Cookie': 'atlas_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});
    } else respond(res, 404, {error: 'not_found', help: 'GET /login starts a LOCAL SIMULATION with a fixed user; no real authentication.'});
  } catch (error) { respond(res, 400, {error: error instanceof ProtocolError ? error.code : 'upstream_or_internal'}); }
});
issuerServer.listen(4310, '127.0.0.1');
clientServer.listen(4311, '127.0.0.1', () => console.log('LOCAL SIMULATION: http://127.0.0.1:4311/login ; Ctrl-C stops both.'));
function close() { issuerServer.close(); clientServer.close(); }
process.on('SIGTERM', close); process.on('SIGINT', close);
