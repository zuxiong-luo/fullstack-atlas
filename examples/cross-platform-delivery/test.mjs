import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{profile}=require('./profile.cjs');
const v1={releaseId:'lab-v1',versionCode:1,versionName:'1.0.0',schema:1,channel:'local-lab'};
test('one explicit public lab profile has matching native versions',()=>{const result=profile(v1);assert.equal(result.versionCode,1);assert.ok(Object.isFrozen(result));assert.notEqual(result,v1);});
test('upgrade profile advances package version while retaining supported local schema',()=>{const result=profile({...v1,releaseId:'lab-v2',versionCode:2,versionName:'1.1.0'});assert.equal(result.schema,1);});
test('mismatched version metadata is rejected before building',()=>{for(const change of [{versionCode:2},{versionCode:'1'},{versionName:'2.0.0'}])assert.throws(()=>profile({...v1,...change}),/PROFILE_VERSION/);});
test('unknown configuration and secret-like fields are rejected',()=>{assert.throws(()=>profile({...v1,token:'not permitted'}),/PROFILE_KEYS/);for(const value of [null,[],{}])assert.throws(()=>profile(value),/PROFILE_KEYS/);});
test('channels, schemas and release names are finite teaching contracts',()=>{for(const change of [{channel:'production'},{schema:2},{releaseId:'arbitrary'}])assert.throws(()=>profile({...v1,...change}),/PROFILE_SCOPE/);});

import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';import {verifyArtifact} from './verify-artifact.mjs';
test('artifact identity checks both retained bytes and exact release record',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'atlas-delivery-hash-'));
 try{
  const apk=Buffer.from('finite fake bytes for CPU hash-contract test'),map=Buffer.from('finite map bytes');
  await writeFile(join(dir,'lab-v1.apk'),apk);await writeFile(join(dir,'lab-v1.map'),map);
  const sha=value=>createHash('sha256').update(value).digest('hex');
  await writeFile(join(dir,'build-report.json'),JSON.stringify({artifacts:[{releaseId:'lab-v1',apk_sha256:sha(apk),map_sha256:sha(map)}]}));
  assert.equal((await verifyArtifact(dir,'lab-v1')).releaseId,'lab-v1');
  await assert.rejects(verifyArtifact(dir,'lab-v2'),/release record/);
  await writeFile(join(dir,'lab-v1.map'),'tampered');await assert.rejects(verifyArtifact(dir,'lab-v1'),/artifact checksum map/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
