import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {App} from './dist/App.mjs';
// JSON is placed in an HTML script raw-text context; JSON.stringify alone is insufficient.
export function serialize(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
}
export function documentFor(data) {
  const markup = renderToString(React.createElement(App, {data}));
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>React SSR 实验</title></head><body><div id="root">'
    + markup + '</div><script type="application/json" id="initial-data">'
    + serialize(data) + '</script><script defer src="/client.js"></script></body></html>';
}
export function createServer({log = console.log} = {}) {
  return http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const start = performance.now();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/client.js') {
        res.setHeader('Content-Type','text/javascript; charset=utf-8');
        res.end(await readFile(new URL('./dist/client.js',import.meta.url))); return;
      }
      if (url.pathname !== '/') {res.writeHead(404); res.end('Not found'); return;}
      if (url.searchParams.has('fail')) throw new Error('simulated loader failure');
      // Each request owns its own data. Never store the current visitor in a module-global variable.
      const data = {title: url.searchParams.get('title')?.slice(0,200) || '服务端与浏览器共享一份快照', count:0, requestId};
      const html = documentFor(data); // Complete before sending headers: failures can still return 500.
      res.setHeader('Content-Type','text/html; charset=utf-8');
      res.end(html);
    } catch (error) {
      res.writeHead(500, {'Content-Type':'text/plain; charset=utf-8'});
      res.end('页面暂时不可用，请重试。请求编号：' + requestId);
      log(JSON.stringify({requestId, phase:'render-or-load', error:error.message}));
    } finally {
      log(JSON.stringify({requestId,status:res.statusCode, durationMs:Math.round(performance.now()-start)}));
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer().listen(4307,'127.0.0.1', () => console.log('http://127.0.0.1:4307'));
}
