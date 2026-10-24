import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { notes } from '../../../lib/notes';
export default async function NotePage({params}:{params:Promise<{id:string}>}) {
  await connection();
  const {id}=await params;
  const note=Object.hasOwn(notes,id)?notes[id]:undefined;
  if(!note)notFound();
  return <><h1>{note.title}</h1><p>{note.body}</p><p>当前笔记：{id}</p><small>服务端渲染标记：{randomUUID()}</small></>;
}
