import { buildApp } from './app.js';
const app = buildApp();
const port = Number(process.env.PORT ?? '3001');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
await app.listen({ port, host: '127.0.0.1' });
console.log(`Agent chapter 01 listening on http://127.0.0.1:${port}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => { await app.close(); });
