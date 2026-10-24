import {requireUser,requireSameOrigin} from '../../../lib/auth';
import {createNote,listNotes} from '../../../lib/store';
import {readJson,parseNote} from '../../../lib/input';
import {handle} from '../../../lib/http';
export async function GET(){return handle(async()=>listNotes(await requireUser()));}
export async function POST(request:Request){return handle(async()=>{
 await requireSameOrigin();const owner=await requireUser();return createNote(owner,parseNote(await readJson(request)));
});}
