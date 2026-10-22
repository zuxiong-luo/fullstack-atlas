import {build} from 'esbuild';
await build({entryPoints:['client.jsx'],bundle:true,outfile:'dist/client.js',format:'iife',define:{'process.env.NODE_ENV':'"development"'}});
await build({entryPoints:['App.jsx'],bundle:true,outfile:'dist/App.mjs',format:'esm',platform:'node',external:['react']});
