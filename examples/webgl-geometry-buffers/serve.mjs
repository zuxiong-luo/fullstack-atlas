import * as esbuild from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('public-app',{recursive:true});
await writeFile('public-app/index.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebGL2实验</title><div id="root"></div><script src="/app.js"></script>');
const ctx=await esbuild.context({entryPoints:['browser.tsx'],bundle:true,outfile:'public-app/app.js',platform:'browser',format:'iife'});
await ctx.serve({host:'127.0.0.1',port:4332,servedir:'public-app'});
console.log('http://127.0.0.1:4332');
for(const name of ['SIGINT','SIGTERM'])process.once(name,async()=>{await ctx.dispose();process.exit(0);});
