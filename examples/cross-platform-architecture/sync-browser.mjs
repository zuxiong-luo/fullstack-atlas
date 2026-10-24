import {readFile,writeFile} from 'node:fs/promises';
const core=await readFile(new URL('./core.ts',import.meta.url),'utf8');
const adapter=(await readFile(new URL('./demo-adapter.ts',import.meta.url),'utf8')).split('\n').filter(line=>!line.startsWith('import ')).join('\n').trim();
const view=await readFile(new URL('./view.tsx.txt',import.meta.url),'utf8');
const source="import React, {useEffect,useRef,useState} from 'react';\n\n"+core+'\n'+adapter+'\n\n'+view;
await writeFile(new URL('./App.tsx',import.meta.url),source);
