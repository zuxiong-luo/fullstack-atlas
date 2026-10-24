// Intentional compiler failure: static input is already known to be wrong.
import type { Note } from '../src/notes.js';
const note: Note = { title: 'bad', tags: [3] };
console.log(note);
