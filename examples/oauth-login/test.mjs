import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client, Issuer, ProtocolError, challenge, random} from './protocol.mjs';
function setup() {
  let time = 1_000;
  const client = new Client(() => time), issuer = new Issuer(() => time), start = client.begin();
  const callback = Object.fromEntries(new URL(issuer.authorize(start.params)).searchParams);
  return {client, issuer, start, callback, advance(ms) { time += ms; }};
}
const exchange = (s, p) => s.issuer.exchange(p);
function tokenRequest(s) { return {...s.start.params, grant_type:'authorization_code', code:s.callback.code, code_verifier:s.client.sessions.get(s.start.sid).transaction.verifier}; }
test('RFC7636 S256 test vector', () => assert.equal(challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'));
test('normal callback exchanges code, rotates local session and keeps token server side', async () => {
  const s=setup(); const result=await s.client.callback(s.start.sid,s.callback,p=>exchange(s,p),t=>s.issuer.profile(t));
  assert.equal(result.user.sub,'demo-user-1'); assert.notEqual(result.sid,s.start.sid);
  assert.equal(s.client.me(s.start.sid),null); assert.equal(s.client.me(result.sid).name,'Local Demo User');
  assert.equal(result.access_token,undefined); s.client.logout(result.sid); assert.equal(s.client.me(result.sid),null);
});
test('state mismatch rejects before contacting token endpoint', async () => {
  const s=setup(); let calls=0;
  await assert.rejects(s.client.callback(s.start.sid,{...s.callback,state:random()},()=>calls++,()=>{}),/state_mismatch/); assert.equal(calls,0);
});
test('missing browser session cannot complete callback',async()=>{
 const s=setup();await assert.rejects(s.client.callback(random(),s.callback,()=>{},()=>{}),/missing_transaction/);
});
test('issuer rejects changed redirect and unsupported plain PKCE',()=>{
 const s=setup();assert.throws(()=>s.issuer.authorize({...s.start.params,redirect_uri:'http://127.0.0.1:4311/other'}),/invalid_redirect_uri/);
 assert.throws(()=>s.issuer.authorize({...s.start.params,code_challenge_method:'plain'}),/invalid_challenge_method/);
});
test('wrong verifier and redirect fail; valid code works only once',()=>{
 const s=setup(), request=tokenRequest(s);
 assert.throws(()=>s.issuer.exchange({...request,code_verifier:random()}),/invalid_grant/);
 assert.throws(()=>s.issuer.exchange({...request,redirect_uri:request.redirect_uri+'/other'}),/invalid_grant/);
 assert.equal(s.issuer.exchange(request).token_type,'Bearer');assert.throws(()=>s.issuer.exchange(request),/invalid_grant/);
});
test('expired code and transaction are rejected',async()=>{
 const s=setup(), request=tokenRequest(s);s.advance(61_000);assert.throws(()=>s.issuer.exchange(request),/invalid_grant/);
 s.advance(60_000);await assert.rejects(s.client.callback(s.start.sid,s.callback,()=>{},()=>{}),/missing_transaction/);
});
test('provider denial consumes matching transaction; replay rejected',async()=>{
 const s=setup();await assert.rejects(s.client.callback(s.start.sid,{state:s.callback.state,error:'access_denied'},()=>{},()=>{}),/authorization_denied/);
 await assert.rejects(s.client.callback(s.start.sid,s.callback,()=>{},()=>{}),/missing_transaction/);
});
test('missing code and malformed token do not establish session',async()=>{
 const s=setup();await assert.rejects(s.client.callback(s.start.sid,{state:s.callback.state},()=>{},()=>{}),/missing_code/);
 const x=setup();await assert.rejects(x.client.callback(x.start.sid,x.callback,()=>({token_type:'wrong'}),()=>{}),/invalid_token_response/);
 assert.equal(x.client.me(x.start.sid),null);
});
test('malformed unicode state is classified, not a buffer-length exception',async()=>{
 const s=setup();await assert.rejects(s.client.callback(s.start.sid,{...s.callback,state:'中'.repeat(43)},()=>{},()=>{}),e=>e instanceof ProtocolError && e.code==='state_mismatch');
});
