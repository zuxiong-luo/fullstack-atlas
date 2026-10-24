async function parse(text) { return JSON.parse(text); }
const pending = parse('{');
console.log('caller continued');
try { await pending; }
catch (error) { console.log(`caught ${error.name}`); }
