import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
assert.equal(process.versions.node,'24.14.1');const pkg=await read('package.json'),lock=await read('package-lock.json'),app=(await read('app.json')).expo;
assert.equal(app.android.package,'com.atlaslab.delivery');assert.equal(app.scheme,'atlasdeliverylab');
for(const [name,version]of Object.entries({...pkg.dependencies,...pkg.devDependencies})){
 assert.ok(/^\d+\.\d+\.\d+$/.test(version));assert.equal(lock.packages['node_modules/'+name].version,version);
}
const release=require('./profile.cjs').profile(await read('build-profile.json'));
const built=require('./app.config.cjs')({config:app});assert.equal(built.android.versionCode,release.versionCode);assert.equal(built.version,release.versionName);
console.log(JSON.stringify({node:process.versions.node,expo:pkg.dependencies.expo,rn:pkg.dependencies['react-native'],exactLock:true,release}));
