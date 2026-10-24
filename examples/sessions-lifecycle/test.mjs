import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac,randomBytes } from 'node:crypto';
import { startApp } from './server.mjs';
import { send,cookiePair } from './client.mjs';
import { createTokens } from './jwt.mjs';
const body={user:'alice',password:'classroom-only-42'};
const loggedIn=app=>send(app,'/login',{method:'POST',body});
test('actual HTTPS opaque session lifecycle',async t=>{
  let time=1000000;
  const app=await startApp({now:()=>time,idleMs:10000,absoluteMs:25000});t.after(()=>app.close());
  await t.test('login rotates attacker-selected ID; flags and server authorization work',async()=>{
    const chosen='A'.repeat(43);
    const login=await send(app,'/login',{method:'POST',body,cookie:'__Host-atlas_sid='+chosen});
    assert.equal(login.status,200);assert.notEqual(cookiePair(login),'__Host-atlas_sid='+chosen);
    for(const flag of ['Path=/','Secure','HttpOnly','SameSite=Lax','Max-Age=25'])assert.ok(login.cookie.includes(flag));
    assert.ok(!login.cookie.includes('Domain='));assert.equal(login.cache,'no-store');
    assert.equal((await send(app,'/me',{cookie:cookiePair(login)})).body.user,'alice');
    assert.equal((await send(app,'/me',{cookie:'__Host-atlas_sid='+chosen})).status,401);
    assert.equal((await send(app,'/notes/1',{cookie:cookiePair(login)})).status,200);
    assert.equal((await send(app,'/notes/2',{cookie:cookiePair(login)})).status,404);
  });
  await t.test('forged/old IDs rejected, explicit refresh changes ID and CSRF',async()=>{
    const first=await loggedIn(app),cookie=cookiePair(first);
    assert.equal((await send(app,'/refresh',{method:'POST',cookie})).status,403);
    assert.equal((await send(app,'/refresh',{method:'POST',cookie,csrf:first.body.csrfToken,origin:'https://evil.invalid'})).status,403);
    const second=await send(app,'/refresh',{method:'POST',cookie,csrf:first.body.csrfToken});
    assert.equal(second.status,200);assert.notEqual(cookiePair(second),cookie);
    assert.notEqual(second.body.csrfToken,first.body.csrfToken);
    assert.equal((await send(app,'/me',{cookie})).status,401);
    assert.equal((await send(app,'/logout',{method:'POST',cookie:cookiePair(second),csrf:first.body.csrfToken})).status,403);
    assert.equal((await send(app,'/me',{cookie:'__Host-atlas_sid='+randomBytes(32).toString('base64url')})).status,401);
  });
  await t.test('only one concurrent refresh can consume the old ID',async()=>{
    const first=await loggedIn(app);
    const options={method:'POST',cookie:cookiePair(first),csrf:first.body.csrfToken};
    const results=await Promise.all([send(app,'/refresh',options),send(app,'/refresh',options)]);
    assert.deepEqual(results.map(x=>x.status).sort(),[200,401]);
  });
  await t.test('idle expiry and absolute cap checked by server, using injected clock only',async()=>{
    time=2000000;const idle=await loggedIn(app);time+=10000;
    assert.equal((await send(app,'/me',{cookie:cookiePair(idle)})).status,401);
    time=3000000;let current=await loggedIn(app);
    for(const elapsed of [9000,18000]) {
      time=3000000+elapsed;
      current=await send(app,'/refresh',{method:'POST',cookie:cookiePair(current),csrf:current.body.csrfToken});
      assert.equal(current.status,200);
    }
    time=3025000;
    assert.equal((await send(app,'/me',{cookie:cookiePair(current)})).status,401);
  });
  await t.test('accepted activity extends idle deadline without extending absolute cap',async()=>{
    time=5000000;const first=await loggedIn(app),cookie=cookiePair(first);
    time=5009000;assert.equal((await send(app,'/me',{cookie})).status,200);
    time=5018000;assert.equal((await send(app,'/me',{cookie})).status,200);
    time=5025000;assert.equal((await send(app,'/me',{cookie})).status,401);
  });
  await t.test('logout deletes server state and expires browser cookie',async()=>{
    const first=await loggedIn(app),cookie=cookiePair(first);
    const result=await send(app,'/logout',{method:'POST',cookie,csrf:first.body.csrfToken});
    assert.equal(result.status,200);assert.match(result.cookie,/Max-Age=0/);
    assert.equal((await send(app,'/me',{cookie})).status,401);
  });
  await t.test('oversized login input rejected before password work',async()=>{
    assert.equal((await send(app,'/login',{method:'POST',body:{...body,user:'x'.repeat(1100)}})).status,413);
  });
  await t.test('bad password and absent Origin do not establish a session',async()=>{
    assert.equal((await send(app,'/login',{method:'POST',body:{...body,password:'wrong'}})).status,401);
    assert.equal((await send(app,'/login',{method:'POST',body,origin:null})).status,403);
  });
  await t.test('real HTTPS JWT issue/use/revoke and expiry',async()=>{
    const login=await send(app,'/jwt/login',{method:'POST',body});
    const token=login.body.accessToken;assert.equal(login.status,200);
    assert.equal((await send(app,'/jwt/me',{bearer:token})).body.user,'alice');
    assert.equal((await send(app,'/jwt/logout',{method:'POST',bearer:token})).status,200);
    assert.equal((await send(app,'/jwt/me',{bearer:token})).status,401);
    const fresh=(await send(app,'/jwt/login',{method:'POST',body})).body.accessToken;
    time+=30000;assert.equal((await send(app,'/jwt/me',{bearer:fresh})).status,401);
  });
});
test('JWT verification policy is more than JSON decoding',()=>{
  let time=1000000;const key=randomBytes(32),tokens=createTokens({key,now:()=>time});
  const token=tokens.issue('alice');assert.equal(tokens.verify(token).sub,'alice');
  const [h,p,s]=token.split('.');
  const payload=JSON.parse(Buffer.from(p,'base64url'));
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const reSign=(header,claims)=>{const input=encode(header)+'.'+encode(claims);return input+'.'+createHmac('sha256',key).update(input).digest('base64url');};
  assert.throws(()=>tokens.verify(h+'.'+encode({...payload,sub:'bob'})+'.'+s));
  assert.throws(()=>tokens.verify(reSign({alg:'none',typ:'JWT'},payload)));
  for(const wrong of [{aud:'other-api'},{iss:'other-issuer'},{exp:payload.iat},{iat:payload.iat+60,exp:payload.iat+90}]) {
    assert.throws(()=>tokens.verify(reSign({alg:'HS256',typ:'JWT'},{...payload,...wrong})));
  }
  assert.throws(()=>createTokens({key:randomBytes(32),now:()=>time}).verify(token));
  tokens.revoke(token);assert.throws(()=>tokens.verify(token));
  const later=tokens.issue('alice');time+=30000;assert.throws(()=>tokens.verify(later));
});
