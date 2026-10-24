import {build} from 'esbuild';
await build({entryPoints:[new URL('./entry.tsx',import.meta.url).pathname],outfile:new URL('./dist/app.js',import.meta.url).pathname,bundle:true,minify:true,define:{'process.env.NODE_ENV':'"production"'},jsx:'automatic'});
