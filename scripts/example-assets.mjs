import {mkdir,readdir,copyFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,extname} from 'node:path';
// Curated source formats only. Never publish local environments, caches or secrets.
const excluded=new Set(['.next','.dart_tool','.test','.turbo','.gradle','build','node_modules','.venv','venv','__pycache__','.pytest_cache','.git','dist','.mypy_cache','.ruff_cache']);
const extensions=new Set(['.ts','.tsx','.jsx','.py','.json','.jsonl','.md','.txt','.toml','.lock','.html','.mjs','.js','.cjs','.css','.yaml','.yml','.sh','.sql','.dart','.glsl','.vert','.frag','.dockerignore']);
await rm('public/examples',{recursive:true,force:true});
await rm('public/downloads',{recursive:true,force:true});
async function copy(from,to){await mkdir(to,{recursive:true});for(const entry of await readdir(from,{withFileTypes:true})){if((entry.name.startsWith('.')&&!['.nvmrc','.env.example','.dockerignore'].includes(entry.name))||excluded.has(entry.name))continue;const src=join(from,entry.name),dst=join(to,entry.name);if(entry.isDirectory()){if(from==='examples/next-server-boundaries'&&entry.name==='data')continue;await copy(src,dst);}else if(entry.isFile()&&(extensions.has(extname(entry.name))||entry.name==='.nvmrc'||entry.name==='LICENSE'||entry.name==='LICENSE.react'||entry.name==='Dockerfile'||entry.name==='.env.example'||entry.name==='.dockerignore'))await copyFile(src,dst)}}
await copy('examples','public/downloads');

for(const entry of await readdir('public/downloads',{withFileTypes:true})){
 if(entry.isDirectory()&&/^[a-z0-9][a-z0-9-]*$/.test(entry.name))execFileSync('zip',['-qr',`${entry.name}.zip`,entry.name],{cwd:'public/downloads'});
}
