// Explicit maintenance command: freeze official React sources referenced by articles.
// Normal build/test stays network-free and uses the reviewed snapshots in public/.
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const bundled=await build({entryPoints:['src/data/articles.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {articles}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const prefix='https://github.com/facebook/react/blob/v18.3.1/';
const urls=articles.flatMap(a=>a.sections.flatMap(s=>(s.blocks||[]).filter(b=>b.type==='reference').map(b=>b.url))).filter(u=>u.startsWith(prefix));
const paths=[...new Set(urls.map(u=>u.slice(prefix.length).split('#')[0]))].sort();
const root='public/sources/react-v18.3.1';
const old=JSON.parse(await readFile(root+'/manifest.json','utf8'));
const files={};
async function download(url){
 let error;
 for(let attempt=0;attempt<3;attempt++)try{
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(response.status+' '+url);
  return await response.text();
 }catch(e){error=e;}
 throw error;
}
for(const path of [...paths,'LICENSE']){
 if(!/^[\w./-]+$/.test(path)||path.includes('..'))throw new Error('Invalid path '+path);
 const text=await download('https://raw.githubusercontent.com/facebook/react/v18.3.1/'+path),sha=createHash('sha256').update(text).digest('hex');
 if(old.files[path]&&old.files[path]!==sha)throw new Error('Pinned source changed; review required: '+path);
 const dest=root+'/'+path;await mkdir(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});await writeFile(dest,text);
 if(path!=='LICENSE')files[path]=sha;
}
await writeFile(root+'/manifest.json',JSON.stringify({tag:'v18.3.1',files},null,2)+'\n');
await writeFile('src/data/reactSourceFiles.json',JSON.stringify(paths,null,2)+'\n');
console.log(`Verified ${paths.length} files for ${urls.length} inline references.`);
