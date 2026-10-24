import {readFile,writeFile} from 'node:fs/promises';
const text="import React from 'react';\n"+await readFile(new URL('./core.ts',import.meta.url),'utf8')+'\n'+await readFile(new URL('./view.tsx.txt',import.meta.url),'utf8');
await writeFile(new URL('./App.tsx',import.meta.url),text);
