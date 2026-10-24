import {mkdir,readdir,copyFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,extname} from 'node:path';
// Curated source formats only. Never publish local environments, caches or secrets.
const excluded=new Set(['.next','.dart_tool','.test','.turbo','.gradle','build','node_modules','.venv','venv','__pycache__','.pytest_cache','.git','dist','.mypy_cache','.ruff_cache']);
const extensions=new Set(['.ts','.tsx','.jsx','.py','.json','.jsonl','.md','.txt','.toml','.lock','.html','.mjs','.js','.cjs','.css','.yaml','.yml','.sh','.sql','.dart','.glsl','.vert','.frag','.dockerignore']);
const runtimeDataRoots=new Set(['examples/next-server-boundaries','examples/next-data-cache','examples/next-server-writes']);
const explicitFiles=new Set(['.nvmrc','.python-version','.env.example','.dockerignore','LICENSE','LICENSE.react','Dockerfile']);
await rm('public/examples',{recursive:true,force:true});
await rm('public/downloads',{recursive:true,force:true});
async function copy(from,to){
 await mkdir(to,{recursive:true});
 for(const entry of await readdir(from,{withFileTypes:true})){
  if((entry.name.startsWith('.')&&!explicitFiles.has(entry.name))||excluded.has(entry.name))continue;
  const src=join(from,entry.name),dst=join(to,entry.name);
  if(entry.isDirectory()){
   if(runtimeDataRoots.has(from)&&entry.name==='data')continue;
   await copy(src,dst);
  }else if(entry.isFile()&&(extensions.has(extname(entry.name))||explicitFiles.has(entry.name)))await copyFile(src,dst);
 }
}
await copy('examples','public/downloads');

for(const entry of await readdir('public/downloads',{withFileTypes:true})){
 if(entry.isDirectory()&&/^[a-z0-9][a-z0-9-]*$/.test(entry.name))execFileSync('zip',['-qr',`${entry.name}.zip`,entry.name],{cwd:'public/downloads'});
}
