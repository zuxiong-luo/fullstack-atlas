const { readFile } = require('node:fs');
readFile(__filename, () => {
  const trace = ['io'];
  setTimeout(() => { trace.push('timer'); console.log(JSON.stringify(trace)); }, 0);
  setImmediate(() => trace.push('immediate'));
});
