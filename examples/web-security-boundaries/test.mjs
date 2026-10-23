import {test} from 'node:test';
import assert from 'node:assert/strict';
import {APP_ORIGIN,Rejected,htmlText,authorizeWrite,outboundUrl,fetchDocument} from './security.mjs';
const session={user:'alice',csrf:'valid-random-token'},doc={owner:'alice'},request={method:'POST',origin:APP_ORIGIN,csrf:session.csrf};
test('text output encodes all HTML-sensitive characters without discarding content',()=>{
 assert.equal(htmlText('<img onerror="x"> & \'quoted\''),'&lt;img onerror=&quot;x&quot;&gt; &amp; &#39;quoted&#39;');
});
test('normal owner write passes all independent gates',()=>assert.doesNotThrow(()=>authorizeWrite(request,session,doc)));
test('missing session fails before resource access',()=>assert.throws(()=>authorizeWrite(request,null,doc),/unauthenticated/));
test('CSRF: origin and token independently fail',()=>{
 assert.throws(()=>authorizeWrite({...request,origin:'http://attacker.invalid'},session,doc),/origin_mismatch/);
 assert.throws(()=>authorizeWrite({...request,csrf:'invalid'},session,doc),/csrf_mismatch/);
 assert.throws(()=>authorizeWrite({...request,method:'GET'},session,doc),/method_not_allowed/);
});
test('object authorization rejects another owner even with valid session/CSRF',()=>{
 assert.throws(()=>authorizeWrite(request,session,{owner:'bob'}),/not_found_or_forbidden/);
 assert.throws(()=>authorizeWrite(request,session,undefined),/not_found_or_forbidden/);
});
test('URL-like user input is never treated as a fetch destination',()=>{
 for(const id of ['http://127.0.0.1/','http://[::1]/','https://docs.example.invalid@127.0.0.1/','file:///etc/hosts','guide/../admin'])assert.throws(()=>outboundUrl(id),/unknown_document/);
 assert.equal(outboundUrl('guide'),'https://docs.example.invalid/guide.txt');
});
test('known ID passes fixed target and explicit no-redirect policy to local stub',async()=>{
 let calls=0;const value=await fetchDocument('guide',async(url,options)=>{calls++;assert.equal(url,'https://docs.example.invalid/guide.txt');assert.equal(options.redirect,'error');assert.ok(options.signal);return{status:200,body:(async function*(){yield Buffer.from('hello');})()};});
 assert.equal(calls,1);assert.equal(value,'hello');
});
test('blocked input never calls transport',async()=>{
 let calls=0;await assert.rejects(fetchDocument('http://127.0.0.1/',()=>calls++),/unknown_document/);assert.equal(calls,0);
});
test('redirect status rejected instead of following to another destination',async()=>{
 await assert.rejects(fetchDocument('guide',async()=>({status:302,location:'http://127.0.0.1/'})),/upstream_status/);
});
test('oversized streamed response closes generator before accepting data',async()=>{
 let cleaned=false;await assert.rejects(fetchDocument('guide',async()=>({status:200,body:(async function*(){try{yield Buffer.alloc(1025);}finally{cleaned=true;}})()})),/response_too_large/);assert.equal(cleaned,true);
});
test('cooperative transport observes the request timeout signal',async()=>{
 const waiting=fetchDocument('guide',async(_url,{signal})=>{
  await new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});
 });
 // Keep the event loop alive: AbortSignal.timeout deliberately does not do that itself.
 const keeper=setTimeout(()=>{},1500);
 try{await assert.rejects(waiting,error=>error.name==='TimeoutError');}finally{clearTimeout(keeper);}
});
