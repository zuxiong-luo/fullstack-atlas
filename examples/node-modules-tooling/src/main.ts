import { parseNote } from './notes.js';
import type { Note } from './notes.js';
const raw: unknown = JSON.parse(process.argv[2] ?? '{"title":"Learn Node","tags":["node"]}');
const note: Note = parseNote(raw);
console.log(JSON.stringify(note));
