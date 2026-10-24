import {readFile,writeFile} from 'node:fs/promises';
const files=['gl-utils.ts','data.ts','renderer.ts'];
const parts=await Promise.all(files.map(name=>readFile(new URL(name,import.meta.url),'utf8')));
const view=await readFile(new URL('view.tsx.txt',import.meta.url),'utf8');
const result="import React from 'react';\n\n"+parts.map(text=>text.replace(/^import .*?;\n/gm,'')).join('\n')+'\n'+view;
const target=new URL('App.tsx',import.meta.url);
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==result)throw new Error('App.tsx未同步');}
else await writeFile(target,result);
