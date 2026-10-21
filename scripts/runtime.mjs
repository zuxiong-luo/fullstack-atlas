import {build} from 'esbuild';
await build({stdin:{contents:"import React from 'react';import * as ReactDOM from 'react-dom/client';window.React=React;window.ReactDOM=ReactDOM;",resolveDir:process.cwd()},outfile:'public/react-runtime.js',bundle:true,minify:true,format:'iife',define:{'process.env.NODE_ENV':'"development"'}});
