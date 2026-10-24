"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireUser,requireSameOrigin} from '../lib/auth';
import {parseNote} from '../lib/input';
import {createNote} from '../lib/store';
import {Failure} from '../lib/errors';
export async function saveNote(form:FormData){
 let destination:string;
 try{
  await requireSameOrigin();const owner=await requireUser();
  const fields=[...form.keys()].filter(key=>!key.startsWith('$ACTION_'));
  if(fields.some(key=>!['title','key'].includes(key))||form.getAll('title').length!==1||form.getAll('key').length!==1)throw new Failure(422,'BAD_NOTE');
  const input=parseNote({title:form.get('title'),key:form.get('key')});
  const note=await createNote(owner,input);revalidatePath('/');destination='/?saved='+note.id;
 }catch(error){
  if(!(error instanceof Failure))console.error('action unavailable',error);
  destination='/?error='+(error instanceof Failure?error.code:'UNAVAILABLE');
 }
 redirect(destination);
}
