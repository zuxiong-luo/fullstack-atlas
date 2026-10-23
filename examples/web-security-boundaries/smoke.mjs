import assert from 'node:assert/strict';
const session=await fetch('http://127.0.0.1:4312/demo-session?user=alice');const {csrf}=await session.json(),cookie=session.headers.get('set-cookie').split(';')[0];
const write=(id,headers={})=>fetch('http://127.0.0.1:4312/write',{method:'POST',headers:{cookie,'content-type':'application/json',origin:'http://127.0.0.1:4312','x-csrf-token':csrf,...headers},body:JSON.stringify({id,text:'local controlled update'})});
assert.equal((await write('a')).status,200);assert.equal((await write('b')).status,403);assert.equal((await write('a',{origin:'http://attacker.invalid'})).status,403);
const safe=await fetch('http://127.0.0.1:4312/safe-preview'),html=await safe.text();assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(safe.headers.get('content-security-policy'));
console.log('Web HTTP smoke passed: own200, other403, crossOrigin403, safe HTML encoded.');
