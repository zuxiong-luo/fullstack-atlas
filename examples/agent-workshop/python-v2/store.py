"""Short SQLite transactions claim a lease; external model calls hold no transaction."""
import json
import sqlite3
import time
from pathlib import Path
from contracts import fail
class Store:
    def __init__(self,path=':memory:',now=None):
        self.now=now or (lambda:int(time.time()*1000))
        if path!=':memory:':Path(path).parent.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(path,timeout=1,isolation_level=None,check_same_thread=False)
        self.db.row_factory=sqlite3.Row
        self.db.executescript('''PRAGMA busy_timeout=1000;PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS runs(owner TEXT NOT NULL,request_id TEXT NOT NULL,question TEXT NOT NULL,status TEXT NOT NULL,checkpoint TEXT NOT NULL,evidence TEXT NOT NULL DEFAULT '[]',answer TEXT,citations TEXT,epoch INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner,request_id));
        CREATE TABLE IF NOT EXISTS memory(owner TEXT NOT NULL,id TEXT NOT NULL,text TEXT NOT NULL,PRIMARY KEY(owner,id));''')
    def _tx(self,work):
        self.db.execute('BEGIN IMMEDIATE')
        try:result=work();self.db.execute('COMMIT');return result
        except BaseException:self.db.execute('ROLLBACK');raise
    def get(self,owner,id):
        row=self.db.execute('SELECT * FROM runs WHERE owner=? AND request_id=?',(owner,id)).fetchone()
        return dict(row) if row else None
    def ensure(self,owner,id,question):
        def operation():
            found=self.get(owner,id)
            if found:
                if found['question']!=question:fail(409,'IDEMPOTENCY_CONFLICT')
                return found
            self.db.execute("INSERT INTO runs(owner,request_id,question,status,checkpoint) VALUES(?,?,?,'queued','queued')",(owner,id,question))
            return self.get(owner,id)
        return self._tx(operation)
    def claim(self,owner,id,lease_ms):
        def operation():
            found=self.get(owner,id)
            if not found:fail(404,'RUN_NOT_FOUND')
            if found['status']=='completed':return found
            now=self.now()
            if found['lease_until']>now:fail(409,'RUN_BUSY')
            self.db.execute('UPDATE runs SET epoch=epoch+1,lease_until=? WHERE owner=? AND request_id=?',(now+lease_ms,owner,id))
            return self.get(owner,id)
        return self._tx(operation)
    def retrieved(self,run,evidence):
        count=self.db.execute("UPDATE runs SET status='retrieved',checkpoint='retrieved',evidence=? WHERE owner=? AND request_id=? AND epoch=? AND lease_until>?",(json.dumps(evidence,ensure_ascii=True),run['owner'],run['request_id'],run['epoch'],self.now())).rowcount
        if not count:fail(409,'STALE_RUN')
    def complete(self,run,answer):
        count=self.db.execute("UPDATE runs SET status='completed',checkpoint='done',answer=?,citations=?,lease_until=0 WHERE owner=? AND request_id=? AND epoch=? AND lease_until>?",(answer['answer'],json.dumps(answer['citations']),run['owner'],run['request_id'],run['epoch'],self.now())).rowcount
        if not count:fail(409,'STALE_RUN')
    def release(self,run):self.db.execute('UPDATE runs SET lease_until=0 WHERE owner=? AND request_id=? AND epoch=?',(run['owner'],run['request_id'],run['epoch']))
    def put_memory(self,owner,id,text):
        self.db.execute('INSERT INTO memory(owner,id,text) VALUES(?,?,?) ON CONFLICT(owner,id) DO UPDATE SET text=excluded.text',(owner,id,text));return {'id':id,'text':text}
    def memory(self,owner):return [dict(row) for row in self.db.execute('SELECT id,text FROM memory WHERE owner=? ORDER BY id',(owner,))]
    def delete_memory(self,owner,id):
        if not self.db.execute('DELETE FROM memory WHERE owner=? AND id=?',(owner,id)).rowcount:fail(404,'MEMORY_NOT_FOUND')
    def close(self):self.db.close()
def public_run(run):return {'request_id':run['request_id'],'status':run['status'],'answer':run['answer'],'citations':json.loads(run['citations']) if run['citations'] else [],'checkpoint':run['checkpoint']}
