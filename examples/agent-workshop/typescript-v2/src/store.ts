import {DatabaseSync} from 'node:sqlite';
import {fail,type Answer,type Evidence} from './contracts.js';
export type Run={owner:string;request_id:string;question:string;status:'queued'|'retrieved'|'completed';checkpoint:'queued'|'retrieved'|'done';evidence:string;answer:string|null;citations:string|null;epoch:number;lease_until:number};
export class Store {
 readonly db:DatabaseSync;
 constructor(path:string=':memory:',readonly now:()=>number=Date.now){
  this.db=new DatabaseSync(path);this.db.exec(`PRAGMA busy_timeout=1000; PRAGMA journal_mode=WAL;
   CREATE TABLE IF NOT EXISTS runs(owner TEXT NOT NULL,request_id TEXT NOT NULL,question TEXT NOT NULL,status TEXT NOT NULL,checkpoint TEXT NOT NULL,evidence TEXT NOT NULL DEFAULT '[]',answer TEXT,citations TEXT,epoch INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner,request_id));
   CREATE TABLE IF NOT EXISTS memory(owner TEXT NOT NULL,id TEXT NOT NULL,text TEXT NOT NULL,PRIMARY KEY(owner,id));`);
 }
 private tx<T>(fn:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result}catch(error){this.db.exec('ROLLBACK');throw error}}
 get(owner:string,id:string):Run|undefined{return this.db.prepare('SELECT * FROM runs WHERE owner=? AND request_id=?').get(owner,id) as Run|undefined;}
 ensure(owner:string,id:string,question:string):Run {
  return this.tx(()=>{const found=this.get(owner,id);if(found){if(found.question!==question)fail(409,'IDEMPOTENCY_CONFLICT');return found;}
   this.db.prepare("INSERT INTO runs(owner,request_id,question,status,checkpoint) VALUES(?,?,?,'queued','queued')").run(owner,id,question);return this.get(owner,id)!;
  });
 }
 claim(owner:string,id:string,leaseMs:number):Run {
  return this.tx(()=>{const found=this.get(owner,id);if(!found)fail(404,'RUN_NOT_FOUND');if(found!.status==='completed')return found!;
   if(found!.lease_until>this.now())fail(409,'RUN_BUSY');
   this.db.prepare('UPDATE runs SET epoch=epoch+1,lease_until=? WHERE owner=? AND request_id=?').run(this.now()+leaseMs,owner,id);return this.get(owner,id)!;
  });
 }
 retrieved(run:Run,evidence:Evidence[]) {
  const changed=this.db.prepare("UPDATE runs SET status='retrieved',checkpoint='retrieved',evidence=? WHERE owner=? AND request_id=? AND epoch=? AND lease_until>?").run(JSON.stringify(evidence),run.owner,run.request_id,run.epoch,this.now()).changes;
  if(!changed)fail(409,'STALE_RUN');
 }
 complete(run:Run,answer:Answer){
  const changed=this.db.prepare("UPDATE runs SET status='completed',checkpoint='done',answer=?,citations=?,lease_until=0 WHERE owner=? AND request_id=? AND epoch=? AND lease_until>?").run(answer.answer,JSON.stringify(answer.citations),run.owner,run.request_id,run.epoch,this.now()).changes;
  if(!changed)fail(409,'STALE_RUN');
 }
 release(run:Run){this.db.prepare('UPDATE runs SET lease_until=0 WHERE owner=? AND request_id=? AND epoch=?').run(run.owner,run.request_id,run.epoch);}
 putMemory(owner:string,id:string,text:string){this.db.prepare('INSERT INTO memory(owner,id,text) VALUES(?,?,?) ON CONFLICT(owner,id) DO UPDATE SET text=excluded.text').run(owner,id,text);return{id,text};}
 memory(owner:string){return this.db.prepare('SELECT id,text FROM memory WHERE owner=? ORDER BY id').all(owner) as {id:string;text:string}[];}
 deleteMemory(owner:string,id:string){if(!this.db.prepare('DELETE FROM memory WHERE owner=? AND id=?').run(owner,id).changes)fail(404,'MEMORY_NOT_FOUND');}
 close(){this.db.close();}
}
export function publicRun(run:Run){return{request_id:run.request_id,status:run.status,answer:run.answer,citations:run.citations?JSON.parse(run.citations):[],checkpoint:run.checkpoint};}
