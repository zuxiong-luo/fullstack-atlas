import {build} from 'esbuild';
import {readFile,readdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

// Inspect the actual article catalog and built delivery artifacts, not an expected article count.
const bundled=await build({entryPoints:['src/data/articles.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {articles}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const manifest=JSON.parse(await readFile('dist/offline-manifest.json','utf8'));
const resources=manifest.resources ?? manifest.files;
assert.ok(Array.isArray(resources),'offline manifest resources');
const urls=new Set(resources.map(r=>typeof r==='string'?r:r.url));
const normalize=relative=>relative.replace(/^\.\//,'').replace(/^\//,'');
const checkManifest=relative=>assert.ok([...urls].some(url=>normalize(url)===normalize(relative)),relative+' missing from offline manifest');
// unzip treats entry names as patterns; escape literal route brackets, ? and *.
const zipEntry = (file, entry) => execFileSync('unzip', ['-p', file, entry.replace(/[\[\]*?]/g, '\\$&')]);
const archives=new Map();
let downloads=0,figures=0,mapped=0;
for(const article of articles){
  for(const example of article.examples??[]){
    const relative='downloads/'+example.path;
    await stat(path.join('dist',relative));
    checkManifest(relative);downloads++;
    if(example.path.endsWith('.zip')&&!archives.has(example.path)){
      const file=path.join('dist',relative);
      const entries=execFileSync('unzip',['-Z1',file],{encoding:'utf8'}).trim().split('\n');
      assert.ok(entries.length>0,file+' is empty');
      assert.ok(!entries.some(e=>/(^|\/)(node_modules|\.venv|__pycache__|\.test|\.git)(\/|$)/.test(e)),file+' includes a local environment');
      assert.ok(!entries.some(e=>/(^|\/)\.env(?:$|\.)/.test(e)&&!e.endsWith('/.env.example')),file+' includes an environment secret');
      assert.ok(!entries.some(e=>/^next-(?:server-boundaries|data-cache|server-writes)\/data\//.test(e)),file+' includes local demo runtime data');
      archives.set(example.path,{file,entries:new Set(entries)});
      const root=example.path.slice(0,-4);
      for(const name of ['README.md','package-lock.json','pyproject.toml','requirements.txt','.nvmrc','.python-version','.dockerignore']){
        let source;
        try{source=await readFile(path.join('examples',root,name));}catch(error){if(error.code==='ENOENT')continue;throw error;}
        const entry=root+'/'+name;
        assert.ok(entries.includes(entry),entry+' missing from ZIP');
        assert.deepEqual(zipEntry(file,entry),source,entry+' ZIP metadata differs');
      }
    }
  }
  for(const section of article.sections)for(const block of section.blocks??[]){
    if(block.type==='figure'){
      await stat(path.join('dist',block.src));checkManifest(block.src);figures++;
    }
    if(block.type!=='code'||!block.filename?.startsWith('examples/')||block.kind==='pseudocode')continue;
    const filename=block.filename.split(' · ')[0];
    // Source references carrying line ranges are checked by the source-specific tests.
    if(!/\.(?:[cm]?js|tsx?|jsx|py|sql|json|jsonl|dart|glsl|vert|frag|sh|c|cc)$/.test(filename))continue;
    const relative=filename.slice('examples/'.length);
    const original=await readFile(filename);
    assert.deepEqual(await readFile(path.join('dist/downloads',relative)),original,relative+' downloadable source differs');
    checkManifest('downloads/'+relative);mapped++;
    const root=relative.split('/')[0];
    const archive=archives.get(root+'.zip');
    if(archive){
      assert.ok(archive.entries.has(relative),relative+' missing from ZIP');
      assert.deepEqual(zipEntry(archive.file,relative),original,relative+' ZIP source differs');
    }
  }
}
// Data fixtures are needed even when no code block quotes them. JSONL was previously omitted.
async function inspectFixtures(directory,inside=false){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.name.startsWith('.')||['node_modules','dist','build','__pycache__','data'].includes(entry.name))continue;
    const file=path.join(directory,entry.name);
    const fixture=inside||['fixtures','shared'].includes(entry.name);
    if(entry.isDirectory())await inspectFixtures(file,fixture);
    else if((fixture&&/\.(jsonl?|txt|sql)$/.test(entry.name))||entry.name.endsWith('.service.in')||entry.name.endsWith('.conf.in')||entry.name.endsWith('.yaml.in')||entry.name.endsWith('.lock')||entry.name==='MANIFEST.in'){
      const relative=file.slice('examples/'.length);
      const archive=archives.get(relative.split('/')[0]+'.zip');
      if(!archive)continue;
      assert.ok(archive.entries.has(relative),relative+' fixture missing from ZIP');
      assert.deepEqual(zipEntry(archive.file,relative),await readFile(file),relative+' fixture differs');
      checkManifest('downloads/'+relative);
    }
  }
}
await inspectFixtures('examples');
console.log(`Verified delivery: ${downloads} article downloads, ${figures} figure references, ${mapped} inline source blocks, ${archives.size} ZIPs.`);
