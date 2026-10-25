import { createHook } from 'node:async_hooks';
import { readFile } from 'node:fs';
import { createServer, get } from 'node:http';
import { pathToFileURL } from 'node:url';
// async_hooks observes Node resources, not kernel scheduling or pool thread IDs.
export async function traceIO({file=new URL('./fixture.txt',import.meta.url)}={}) {
  const resources = [], events = [];
  const hook = createHook({ init(_id, type) {
    if (['FSREQCALLBACK','TCPWRAP','TCPCONNECTWRAP','HTTPCLIENTREQUEST'].includes(type)) resources.push(type);
  }});
  const sockets = new Set();
  const server = createServer((_req, res) => { events.push('server:request'); res.end('notes'); });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  hook.enable();
  try {
    events.push('file:submit');
    const text = await new Promise((resolve, reject) => readFile(file, 'utf8', (error, value) => {
      events.push('file:callback'); error ? reject(error) : resolve(value.trim());
    }));
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    events.push('http:submit');
    const body = await new Promise((resolve, reject) => {
      const request = get({host:'127.0.0.1', port:server.address().port, path:'/', agent:false}, response => {
        events.push('http:response'); let value=''; response.setEncoding('utf8');
        response.on('data', part => value += part); response.once('end', () => { events.push('http:end'); resolve(value); }); response.once('error', reject);
      });
      request.setTimeout(2000, () => request.destroy(new Error('LOCAL_HTTP_TIMEOUT'))); request.once('error', reject);
    });
    return {text, body, events, resources:[...new Set(resources)]};
  } finally { hook.disable(); for (const socket of sockets) socket.destroy(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) console.log(JSON.stringify(await traceIO()));
