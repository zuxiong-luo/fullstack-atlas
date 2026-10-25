import 'reflect-metadata';
import { DataSource, EntitySchema, type Logger } from 'typeorm';
export interface Owner { tenantId: string; id: string; name: string; notes?: Note[] }
export interface Note { id: number; tenantId: string; ownerId: string; title: string; body: string | null; amount: string; createdAt: Date; version: number; owner?: Owner }
export const OwnerEntity = new EntitySchema<Owner>({ name: 'Owner', tableName: 'owners', columns: {
  tenantId: { type: String, primary: true }, id: { type: String, primary: true }, name: { type: String }
}, relations: { notes: { type: 'one-to-many', target: 'Note', inverseSide: 'owner' } } });
export const NoteEntity = new EntitySchema<Note>({ name: 'Note', tableName: 'notes', columns: {
  id: { type: Number, primary: true, generated: true }, tenantId: { type: String }, ownerId: { type: String },
  title: { type: String }, body: { type: String, nullable: true, default: null },
  amount: { type: 'numeric', precision: 20, scale: 2, default: '0.00' },
  createdAt: { type: 'timestamptz', precision: 6, default: () => 'CURRENT_TIMESTAMP' },
  version: { type: Number, default: 1 }
}, uniques: [{ columns: ['tenantId', 'title'] }], relations: { owner: {
  type: 'many-to-one', target: 'Owner', inverseSide: 'notes', nullable: false,
  joinColumn: [{ name: 'tenantId', referencedColumnName: 'tenantId' }, { name: 'ownerId', referencedColumnName: 'id' }]
} } });
export class SqlLog implements Logger {
  queries: { sql: string; parameters?: unknown[] }[] = [];
  logQuery(sql: string, parameters?: unknown[]) { this.queries.push({ sql, parameters }); }
  logQueryError() {} logQuerySlow() {} logSchemaBuild() {} logMigration() {} log() {}
  reset() { this.queries = []; }
  selects() { return this.queries.filter(x => /^SELECT/.test(x.sql)).length; }
}
export function source(schema: string, logger = new SqlLog()) {
  return new DataSource({ type: 'postgres', url: process.env.DATABASE_URL ?? 'postgres://127.0.0.1:55483/typeorm_content',
    schema, entities: [OwnerEntity, NoteEntity], synchronize: false, logging: ['query'], logger,
    extra: { max: 4, connectionTimeoutMillis: 1500 },
    invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' } });
}
export async function seed(ds: DataSource) {
  await ds.getRepository(OwnerEntity).insert([{ tenantId: 'tenant-a', id: 'alice', name: 'Alice' }, { tenantId: 'tenant-a', id: 'bob', name: 'Bob' }, { tenantId: 'tenant-b', id: 'bob', name: 'Bob B' }]);
  await ds.getRepository(NoteEntity).insert([
    { tenantId: 'tenant-a', ownerId: 'alice', title: 'Alpha', amount: '9007199254740993.10' },
    { tenantId: 'tenant-a', ownerId: 'alice', title: 'Beta', body: 'text' },
    { tenantId: 'tenant-a', ownerId: 'bob', title: 'Gamma' },
    { tenantId: 'tenant-b', ownerId: 'bob', title: 'Private' }
  ]);
}
