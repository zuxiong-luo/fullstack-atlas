"""Chapter 3: versioned plain-text chunks with authorized lexical retrieval."""
import hashlib
import json
import math
import re
import sqlite3
from pathlib import Path


def chunks(text: str, size=48, overlap=8):
    if type(size) is not int or type(overlap) is not int or not 0 <= overlap < size:
        raise ValueError('INVALID_CHUNK_WINDOW')
    for start in range(0, len(text), size - overlap):
        end = min(start + size, len(text))
        yield start, end, text[start:end]
        if end == len(text):
            break


def terms(text):
    words = re.findall(r'[a-z0-9_]+', text.casefold())
    for run in re.findall(r'[\u4e00-\u9fff]+', text):
        words.extend(run[i:i + 2] for i in range(len(run) - 1))
        if len(run) == 1:
            words.append(run)
    return set(words)


class Knowledge:
    def __init__(self, path=':memory:'):
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS documents(
          tenant TEXT, doc TEXT, version TEXT, source TEXT, text TEXT,
          PRIMARY KEY(tenant, doc));
        CREATE TABLE IF NOT EXISTS chunks(
          tenant TEXT, doc TEXT, version TEXT, id TEXT, start INTEGER, end INTEGER, text TEXT,
          PRIMARY KEY(tenant, id));
        ''')

    def close(self):
        self.db.close()

    def ingest(self, tenant, doc, source, text, size=48, overlap=8):
        if not re.fullmatch(r'[a-z0-9-]{1,40}', tenant) or not re.fullmatch(r'[a-z0-9-]{1,40}', doc):
            raise ValueError('INVALID_ID')
        if not isinstance(text, str) or not text.strip() or len(text) > 100_000:
            raise ValueError('INVALID_DOCUMENT')
        if not isinstance(source, str) or not 1 <= len(source) <= 200:
            raise ValueError('INVALID_SOURCE')
        canonical = text.replace('\r\n', '\n')
        # Version includes preprocessing policy, not only original bytes.
        version = hashlib.sha256(json.dumps([canonical, source, size, overlap, 'char-window-v1'], ensure_ascii=False).encode()).hexdigest()
        parts = [(start, end, part) for start, end, part in chunks(canonical, size, overlap)]
        rows = [(tenant, doc, version, f'{doc}:{version}:{start}:{end}', start, end, part)
                for start, end, part in parts]
        with self.db:
            self.db.execute('DELETE FROM chunks WHERE tenant=? AND doc=?', (tenant, doc))
            self.db.execute('INSERT OR REPLACE INTO documents VALUES(?,?,?,?,?)',
                            (tenant, doc, version, source, canonical))
            self.db.executemany('INSERT INTO chunks VALUES(?,?,?,?,?,?,?)', rows)
        return {'version': version, 'chunk_count': len(rows)}

    def search(self, tenant, query, limit=3):
        if not isinstance(query, str) or not 1 <= len(query.strip()) <= 1000 or type(limit) is not int or not 1 <= limit <= 10:
            raise ValueError('INVALID_QUERY')
        # Filter before scoring. Demo supports tenant-level access only.
        rows = [dict(r) for r in self.db.execute('SELECT * FROM chunks WHERE tenant=?', (tenant,))]
        query_terms = terms(query)
        document_terms = [terms(row['text']) for row in rows]
        ranked = []
        for row, tokens in zip(rows, document_terms):
            score = sum(math.log(1 + len(rows) / (1 + sum(t in bag for bag in document_terms)))
                        for t in query_terms & tokens)
            if score > 0:
                ranked.append({**row, 'score': round(score, 6)})
        return sorted(ranked, key=lambda r: (-r['score'], r['id']))[:limit]

    def citation(self, tenant, chunk_id):
        row = self.db.execute('''SELECT c.*, d.source FROM chunks c JOIN documents d
          ON c.tenant=d.tenant AND c.doc=d.doc AND c.version=d.version
          WHERE c.tenant=? AND c.id=?''', (tenant, chunk_id)).fetchone()
        if row is None:
            raise ValueError('STALE_OR_FORBIDDEN_CITATION')
        return dict(row)


if __name__ == '__main__':
    knowledge = Knowledge()
    try:
        for doc in json.loads((Path(__file__).parent / 'fixtures/knowledge.json').read_text()):
            knowledge.ingest(doc['tenant'], doc['id'], doc['source'], doc['text'])
        hits = knowledge.search('acme', '账号没有权限')
        print(json.dumps({'hits': hits, 'unknown': knowledge.search('acme', '火星天气')}, ensure_ascii=False, indent=2))
        old_id = hits[0]['id']
        knowledge.ingest('acme', 'access', 'help/access.txt', '权限申请统一通过新的工单入口。')
        try:
            knowledge.citation('acme', old_id)
        except ValueError as error:
            print('旧引用拒绝：', error)
    finally:
        knowledge.close()
