const fs=require('node:fs');
const path=require('node:path');
const {profile}=require('./profile.cjs');
module.exports=({config})=>{
  const release=profile(JSON.parse(fs.readFileSync(path.join(__dirname,'build-profile.json'),'utf8')));
  return {...config,version:release.versionName,android:{...config.android,versionCode:release.versionCode},
    extra:{releaseId:release.releaseId,channel:release.channel}};
};
