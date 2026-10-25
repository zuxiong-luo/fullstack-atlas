import "reflect-metadata";
import { EntitySchema } from "typeorm";
export interface Owner {
  tenantId: string;
  id: string;
  name: string;
  notes?: Note[];
}
export interface Note {
  id: number;
  tenantId: string;
  ownerId: string;
  title: string;
  body: string | null;
  amount: string;
  createdAt: Date;
  version: number;
  owner?: Owner;
}
export const OwnerEntity = new EntitySchema<Owner>({
  name: "Owner",
  tableName: "owners",
  columns: {
    tenantId: { type: String, primary: true },
    id: { type: String, primary: true },
    name: { type: String },
  },
  relations: {
    notes: { type: "one-to-many", target: "Note", inverseSide: "owner" },
  },
});
export const NoteEntity = new EntitySchema<Note>({
  name: "Note",
  tableName: "notes",
  columns: {
    id: { type: Number, primary: true, generated: true },
    tenantId: { type: String },
    ownerId: { type: String },
    title: { type: String },
    body: { type: String, nullable: true, default: null },
    amount: { type: "numeric", precision: 20, scale: 2, default: "0.00" },
    createdAt: {
      type: "timestamptz",
      precision: 6,
      default: () => "CURRENT_TIMESTAMP",
    },
    version: { type: Number, default: 1 },
  },
  uniques: [{ columns: ["tenantId", "title"] }],
  relations: {
    owner: {
      type: "many-to-one",
      target: "Owner",
      inverseSide: "notes",
      nullable: false,
      joinColumn: [
        { name: "tenantId", referencedColumnName: "tenantId" },
        { name: "ownerId", referencedColumnName: "id" },
      ],
    },
  },
});
export interface Audit {
  id: number;
  noteId: number;
  action: string;
}
export const AuditEntity = new EntitySchema<Audit>({
  name: "Audit",
  tableName: "audits",
  columns: {
    id: { type: Number, primary: true, generated: true },
    noteId: { type: Number },
    action: { type: String },
  },
  checks: [{ expression: "\"action\" IN ('create','update')" }],
});
