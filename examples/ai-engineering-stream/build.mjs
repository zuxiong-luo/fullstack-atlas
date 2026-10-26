import {copyFile} from 'node:fs/promises';
await copyFile(new URL('src/index.html',import.meta.url),new URL('public-app/index.html',import.meta.url));
