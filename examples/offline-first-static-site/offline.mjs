import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await walk(p));else out.push(p)}return out}
const files=(await walk('dist')).filter(p=>!p.endsWith('/sw.js')&&!p.endsWith('/offline-manifest.json')).sort();
const hash=createHash('sha256');let bytes=0;for(const f of files){const b=await readFile(f);bytes+=b.length;hash.update(f);hash.update(b)}
const manifest={version:hash.digest('hex').slice(0,16),bytes,files:files.map(p=>'./'+p.slice(5))};
await writeFile('dist/offline-manifest.json',JSON.stringify(manifest));
await writeFile('dist/sw.js',await readFile('scripts/sw.js','utf8'));
