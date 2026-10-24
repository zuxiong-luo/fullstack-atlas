import {requireUser} from '../../../../lib/auth';
import {listNotes} from '../../../../lib/store';
import {Failure} from '../../../../lib/errors';
import {handle} from '../../../../lib/http';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{
 const owner=await requireUser();const {id}=await params;const note=(await listNotes(owner)).find(item=>item.id===id);
 if(!note)throw new Failure(404,'NOT_FOUND');return note;
});}
