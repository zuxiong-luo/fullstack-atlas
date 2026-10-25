import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {join} from 'node:path';
export async function verifyArtifact(directory,releaseId) {
  assert.ok(['lab-v1','lab-v2'].includes(releaseId),'finite release identity');
  const records=JSON.parse(await readFile(join(directory,'build-report.json'),'utf8')).artifacts;
  const record=records.find(row=>row.releaseId===releaseId);assert.ok(record,'release record required');
  for(const extension of ['apk','map']){
    const bytes=await readFile(join(directory,releaseId+'.'+extension));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),record[extension+'_sha256'],'artifact checksum '+extension);
  }
  return record;
}
