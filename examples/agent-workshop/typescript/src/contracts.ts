export type Input = { question: string; documents: { id: string; text: string }[] };
export type Answer = { answer: string; citations: string[] };
export class ServiceError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const idPattern = /^[A-Za-z0-9_-]{1,64}$(?![\s\S])/;
const object = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);
const keys = (x: Record<string, unknown>, expected: string[]) => Object.keys(x).length === expected.length && expected.every(k => Object.hasOwn(x, k));
const text = (x: unknown, max: number): x is string => typeof x === 'string' && Array.from(x.trim()).length > 0 && Array.from(x.trim()).length <= max;
export function parseInput(raw: unknown): Input {
  const bad = () => new ServiceError(400, 'INVALID_REQUEST', '请检查问题和文档格式。');
  if (!object(raw) || !keys(raw, ['question', 'documents']) || !text(raw.question, 2000) || !Array.isArray(raw.documents) || raw.documents.length < 1 || raw.documents.length > 20) throw bad();
  const documents = raw.documents.map(d => {
    if (!object(d) || !keys(d, ['id', 'text']) || typeof d.id !== 'string' || !idPattern.test(d.id) || !text(d.text, 10000)) throw bad();
    return { id: d.id, text: d.text.trim() };
  });
  if (new Set(documents.map(d => d.id)).size !== documents.length) throw bad();
  return { question: raw.question.trim(), documents };
}
export function parseAnswer(raw: string, input: Input): Answer {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new ServiceError(502, 'MODEL_FORMAT_ERROR', '模型结果不是合法 JSON。'); }
  if (!object(value) || !keys(value, ['answer', 'citations']) || !text(value.answer, 4000) || !Array.isArray(value.citations) || value.citations.length === 0 || value.citations.some(id => typeof id !== 'string' || !idPattern.test(id)) || new Set(value.citations).size !== value.citations.length) throw new ServiceError(502, 'MODEL_SCHEMA_ERROR', '模型结果不符合约定结构。');
  const allowed = new Set(input.documents.map(d => d.id));
  if (value.citations.some(id => !allowed.has(id))) throw new ServiceError(502, 'UNSUPPORTED_CITATION', '模型引用了未提供的文档。');
  return { answer: value.answer.trim(), citations: value.citations };
}
