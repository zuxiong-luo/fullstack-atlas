import { ConflictException, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { randomUUID, createHash } from "node:crypto";
import { AuditEntity, NoteEntity } from "./model";
import { Identity } from "./auth";
export interface Job {
  id: number;
  tenantId: string;
  ownerId: string;
  key: string;
  title: string;
  status: string;
  attempts: number;
  leaseToken: string;
  resultId: number | null;
  fingerprint: string;
}
@Injectable()
export class DurableJobs {
  constructor(private readonly source: DataSource) {}
  async enqueue(key: string, title: string, identity: Identity) {
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ title }))
      .digest("hex");
    await this.source.query(
      'INSERT INTO jobs ("tenantId","ownerId",key,fingerprint,title) VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("tenantId","ownerId",key) DO NOTHING',
      [identity.tenantId, identity.ownerId, key, fingerprint, title],
    );
    const [job] = (await this.source.query(
      'SELECT * FROM jobs WHERE "tenantId"=$1 AND "ownerId"=$2 AND key=$3',
      [identity.tenantId, identity.ownerId, key],
    )) as Job[];
    if (job.fingerprint !== fingerprint)
      throw new ConflictException("same key, different payload");
    return job;
  }
  async claim(leaseMs = 100) {
    await this.source.query(
      `UPDATE jobs SET status='failed',"leaseToken"=NULL,"leaseUntil"=NULL WHERE status='running' AND attempts>=3 AND "leaseUntil"<clock_timestamp()`,
    );
    const token = randomUUID();
    const runner = this.source.createQueryRunner();
    try {
      const result = await runner.query(
        `WITH picked AS (SELECT id FROM jobs WHERE attempts<3 AND (status='pending' OR (status='running' AND "leaseUntil"<clock_timestamp())) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE jobs j SET status='running',attempts=attempts+1,"leaseToken"=$1,"leaseUntil"=clock_timestamp()+($2::int * interval '1 millisecond') FROM picked WHERE j.id=picked.id RETURNING j.*`,
        [token, leaseMs],
        true,
      );
      return (result.records[0] as Job | undefined) ?? null;
    } finally {
      await runner.release();
    }
  }
  async complete(claim: Job) {
    return this.source.transaction(async (manager) => {
      const [job] = (await manager.query(
        "SELECT * FROM jobs WHERE id=$1 FOR UPDATE",
        [claim.id],
      )) as Job[];
      if (
        !job ||
        job.status !== "running" ||
        job.leaseToken !== claim.leaseToken
      )
        throw new Error("LEASE_LOST");
      // Token fencing prevents a replaced owner from committing. This worker does no external side effects.
      const note = await manager.getRepository(NoteEntity).save({
        tenantId: job.tenantId,
        ownerId: job.ownerId,
        title: job.title,
      });
      await manager
        .getRepository(AuditEntity)
        .insert({ noteId: note.id, action: "create" });
      await manager.query(
        'UPDATE jobs SET status=\'done\',"resultId"=$1,"leaseToken"=NULL,"leaseUntil"=NULL WHERE id=$2',
        [note.id, job.id],
      );
      return note.id;
    });
  }
  async runOnce() {
    const claim = await this.claim();
    if (!claim) return null;
    try {
      return await this.complete(claim);
    } catch (error) {
      await this.source.query(
        "UPDATE jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'pending' END,\"leaseToken\"=NULL,\"leaseUntil\"=NULL WHERE id=$1 AND \"leaseToken\"=$2 AND status='running'",
        [claim.id, claim.leaseToken],
      );
      throw error;
    }
  }
}
