import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('./',import.meta.url),read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const pkg=await read('package.json'),lock=await read('package-lock.json'),app=(await read('app.json')).expo;
assert.equal(process.versions.node,'24.14.1');assert.equal(app.android.package,'com.atlaslab.rnengineering');
assert.equal(app.scheme,'atlasrnlab');assert.equal(app.android.versionCode,1);
for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})) {
  assert.ok(/^\d+\.\d+\.\d+$/.test(version),'exact dependency '+name);
  assert.equal(lock.packages['node_modules/'+name].version,version);
}
const bundled=JSON.parse(await readFile(new URL('node_modules/expo/bundledNativeModules.json',root),'utf8'));
for(const name of Object.keys(pkg.dependencies)) {
  if(name==='expo')continue;
  assert.ok([pkg.dependencies[name],'~'+pkg.dependencies[name]].includes(bundled[name]),'Expo bundled compatibility: '+name);
}
console.log(JSON.stringify({node:process.versions.node,expo:pkg.dependencies.expo,rn:pkg.dependencies['react-native'],react:pkg.dependencies.react,template:pkg.devDependencies['expo-template-bare-minimum'],exactLock:true,bundledNativeModules:true}));
