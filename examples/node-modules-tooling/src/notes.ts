export type Note = { title: string; tags: string[] };
export function parseNote(input: unknown): Note {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('note must be an object');
  }
  const value = input as Record<string, unknown>;
  if (typeof value.title !== 'string' || value.title.trim().length === 0 || value.title.length > 80) {
    throw new TypeError('title must contain 1..80 characters');
  }
  if (!Array.isArray(value.tags) || value.tags.length > 5 || !Array.from(value.tags).every(tag => typeof tag === 'string')) {
    throw new TypeError('tags must contain at most 5 strings');
  }
  return { title: value.title.trim(), tags: [...value.tags] };
}
