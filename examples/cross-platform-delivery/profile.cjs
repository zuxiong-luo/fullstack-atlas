const KEYS=['channel','releaseId','schema','versionCode','versionName'];
function profile(value) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).sort().join(',')!==KEYS.join(',')) throw new Error('PROFILE_KEYS');
  if (!['lab-v1','lab-v2'].includes(value.releaseId) || value.channel!=='local-lab' || value.schema!==1) throw new Error('PROFILE_SCOPE');
  const expected=value.releaseId==='lab-v1'?{code:1,name:'1.0.0'}:{code:2,name:'1.1.0'};
  if (value.versionCode!==expected.code || value.versionName!==expected.name) throw new Error('PROFILE_VERSION');
  return Object.freeze({...value});
}
module.exports={profile};
