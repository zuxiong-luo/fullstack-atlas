import test from 'node:test';
import assert from 'node:assert/strict';
import { startLab,get } from './lab.mjs';
test('loopback teaching CA: actual TLS 1.3 authentication failures',async t=>{
  const lab=await startLab();t.after(()=>lab.close());
  await t.test('trusted CA and SAN name succeed with TLS 1.3',async()=>{
    const result=await get(lab);
    assert.equal(result.authorized,true);
    assert.equal(result.protocol,'TLSv1.3');
    assert.equal(result.status,200);
    assert.equal(result.ephemeral.name,'X25519');
    assert.deepEqual(result.body,{ok:true,protocol:'TLSv1.3'});
    assert.match(result.san,/DNS:localhost/);
    assert.match(result.san,/IP Address:127\.0\.0\.1/);
    console.log(JSON.stringify(result));
  });
  await t.test('omitting teaching CA fails trust, not hostname policy',async()=>{
    await assert.rejects(get({port:lab.port}),error=>{
      assert.ok(['UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','SELF_SIGNED_CERT_IN_CHAIN'].includes(error.code));
      console.log('untrusted CA:',error.code);return true;
    });
  });
  await t.test('trusted issuer does not authorize a different hostname',async()=>{
    await assert.rejects(get({...lab,servername:'wrong.invalid'}),error=>{
      assert.equal(error.code,'ERR_TLS_CERT_ALTNAME_INVALID');
      console.log('wrong name:',error.code);return true;
    });
  });
  await t.test('expired leaf is rejected even with trusted CA',async()=>{
    const expired=await startLab({expired:true});
    try { await assert.rejects(get(expired),error=>error.code==='CERT_HAS_EXPIRED'); }
    finally {await expired.close();}
  });
  await t.test('no common protocol fails rather than silently downgrade',async()=>{
    await assert.rejects(get({...lab,maxVersion:'TLSv1.2'}),error=>{
      assert.match(error.code,/TLSV1_ALERT_PROTOCOL_VERSION|TLSV1_ALERT_INTERNAL_ERROR|EPROTO/);
      console.log('protocol mismatch:',error.code);return true;
    });
  });
});
