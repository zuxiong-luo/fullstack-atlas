import {readFile,writeFile} from 'node:fs/promises';
const core=await readFile(new URL('./core.ts',import.meta.url),'utf8');
const view=await readFile(new URL('./view.tsx.txt',import.meta.url),'utf8');
await writeFile(new URL('./App.tsx',import.meta.url),"import React, {useState} from 'react';\n\n"+core+'\n'+view);
