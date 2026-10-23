import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';
export const CLIENT_ID = 'atlas-local-client';
export const REDIRECT_URI = 'http://127.0.0.1:4311/callback';
export function random() { return randomBytes(32).toString('base64url'); }
export function challenge(verifier) {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}
export class ProtocolError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function requireValue(condition, code) {
  if (!condition) throw new ProtocolError(code);
}
function equal(a, b) {
  return typeof a === 'string' && typeof b === 'string' &&
    Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export class Issuer {
  constructor(now = Date.now) { this.now = now; this.codes = new Map(); this.tokens = new Map(); }
  authorize(params) {
    requireValue(params.client_id === CLIENT_ID, 'invalid_client');
    requireValue(params.redirect_uri === REDIRECT_URI, 'invalid_redirect_uri');
    requireValue(params.response_type === 'code', 'unsupported_response_type');
    requireValue(params.code_challenge_method === 'S256', 'invalid_challenge_method');
    requireValue(/^[A-Za-z0-9_-]{43}$/.test(params.code_challenge ?? ''), 'invalid_challenge');
    requireValue(typeof params.state === 'string' && /^[A-Za-z0-9_-]{43}$/.test(params.state), 'invalid_state');
    requireValue(this.codes.size < 1000, 'issuer_capacity');
    const code = random();
    this.codes.set(code, {clientId: CLIENT_ID, redirect: REDIRECT_URI,
      challenge: params.code_challenge, subject: 'demo-user-1', expires: this.now() + 60_000});
    const callback = new URL(REDIRECT_URI);
    callback.searchParams.set('code', code); callback.searchParams.set('state', params.state);
    return callback.href;
  }
  exchange(params) {
    requireValue(params.grant_type === 'authorization_code', 'unsupported_grant_type');
    const item = this.codes.get(params.code);
    requireValue(item && item.expires > this.now(), 'invalid_grant');
    requireValue(params.client_id === item.clientId && params.redirect_uri === item.redirect, 'invalid_grant');
    requireValue(typeof params.code_verifier === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(params.code_verifier), 'invalid_verifier');
    requireValue(equal(challenge(params.code_verifier), item.challenge), 'invalid_grant');
    requireValue(this.tokens.size < 1000, 'issuer_capacity');
    this.codes.delete(params.code); // A successful exchange consumes the code once.
    const token = random();
    this.tokens.set(token, {subject: item.subject, expires: this.now() + 300_000});
    return {access_token: token, token_type: 'Bearer', expires_in: 300};
  }
  profile(token) {
    const item = this.tokens.get(token);
    requireValue(item && item.expires > this.now(), 'invalid_token');
    return {sub: item.subject, name: 'Local Demo User'};
  }
}
export class Client {
  constructor(now = Date.now) { this.now = now; this.sessions = new Map(); }
  begin() {
    requireValue(this.sessions.size < 1000, 'client_capacity');
    const sid = random(), verifier = random(), state = random();
    this.sessions.set(sid, {transaction: {verifier, state, expires: this.now() + 120_000}});
    return {sid, params: {client_id: CLIENT_ID, redirect_uri: REDIRECT_URI,
      response_type: 'code', state, code_challenge: challenge(verifier), code_challenge_method: 'S256'}};
  }
  async callback(sid, params, exchange, profile) {
    const session = this.sessions.get(sid), tx = session?.transaction;
    requireValue(tx && tx.expires > this.now(), 'missing_transaction');
    requireValue(equal(params.state, tx.state), 'state_mismatch');
    // Consume the browser transaction on a matching callback, including denial.
    delete session.transaction;
    if (params.error) throw new ProtocolError('authorization_denied');
    requireValue(typeof params.code === 'string' && params.code.length === 43, 'missing_code');
    const tokens = await exchange({grant_type: 'authorization_code', client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI, code: params.code, code_verifier: tx.verifier});
    requireValue(tokens?.token_type === 'Bearer' && typeof tokens.access_token === 'string', 'invalid_token_response');
    const user = await profile(tokens.access_token);
    requireValue(user && typeof user.sub === 'string' && user.sub.length > 0, 'invalid_profile');
    const nextSid = random();
    this.sessions.delete(sid); // Rotate session ID after establishing the local demo session.
    this.sessions.set(nextSid, {user, accessToken: tokens.access_token, expires: this.now() + 300_000});
    return {sid: nextSid, user};
  }
  me(sid) {
    const session = this.sessions.get(sid);
    return session?.user && session.expires > this.now() ? session.user : null;
  }
  logout(sid) { this.sessions.delete(sid); }
}
