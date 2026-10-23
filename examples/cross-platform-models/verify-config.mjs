import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => JSON.parse(readFileSync(name, 'utf8'));
const expected=read('COMPATIBILITY.json'), pkg=read('package.json'), lock=read('package-lock.json');
for(const name of ['expo','react','react-native']) {
  assert.equal(pkg.dependencies[name],expected[name]);
  assert.equal(lock.packages['node_modules/'+name].version,expected[name]);
}
assert.equal(pkg.engines.node,expected.node);
assert.equal(readFileSync('.nvmrc','utf8').trim(),expected.node);
assert.ok(read('app.json').expo.android.permissions.includes('android.permission.BLUETOOTH_CONNECT'));
assert.ok(!('newArchEnabled' in read('app.json').expo));
console.log('Pinned official SDK combination and static app/lock configuration agree; native build not validated.');
