// Intentional compiler failure: a Node ESM relative import needs its output suffix.
import { parseNote } from '../src/notes';
console.log(parseNote({ title: 'ok', tags: [] }));
