import {requireUser,requireSameOrigin} from '@/lib/auth';
import {handle,textInput} from '@/lib/http';
import {writeNote} from '@/lib/store';
import {revalidatePath} from 'next/cache';
export async function POST(request:Request){return handle(async()=>{
 requireSameOrigin(request);const id=await requireUser();const note=await textInput(request,'note');
 await writeNote(id,note);revalidatePath('/account');return {ok:true};
});}
