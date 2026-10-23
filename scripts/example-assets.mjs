import {mkdir,readdir,copyFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,extname} from 'node:path';
// Curated source formats only. Never publish local environments, caches or secrets.
const excluded=new Set(['node_modules','.venv','venv','__pycache__','.pytest_cache','.git','dist','.mypy_cache','.ruff_cache']);
const extensions=new Set(['.ts','.tsx','.jsx','.py','.json','.md','.txt','.toml','.lock','.html','.mjs','.js','.cjs','.css']);
await rm('public/examples',{recursive:true,force:true});
await rm('public/downloads',{recursive:true,force:true});
async function copy(from,to){await mkdir(to,{recursive:true});for(const entry of await readdir(from,{withFileTypes:true})){if((entry.name.startsWith('.')&&entry.name!=='.nvmrc')||excluded.has(entry.name))continue;const src=join(from,entry.name),dst=join(to,entry.name);if(entry.isDirectory())await copy(src,dst);else if(entry.isFile()&&(extensions.has(extname(entry.name))||entry.name==='.nvmrc'||entry.name==='LICENSE'||entry.name==='LICENSE.react'))await copyFile(src,dst)}}
await copy('examples','public/downloads');

for(const name of ['react-state-effects','react-identity-events','react-hooks-interactions','react-state-management','react-concurrency','react-performance','react-modern-engineering','react-fiber-reconciliation','react-foundations','agent-workshop','react-fiber-scheduling','react-fiber-structure','react-work-loop-commit','react-hooks-queue','react-lane-selection','react-double-buffer','react-root-scheduling','react-bailout-memo','react-hook-memoization'])execFileSync('zip',['-qr',`${name}.zip`,name],{cwd:'public/downloads'});
