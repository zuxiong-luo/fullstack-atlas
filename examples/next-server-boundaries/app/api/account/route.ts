import {requireUser} from '@/lib/auth';
import {handle} from '@/lib/http';
import {readAccount} from '@/lib/store';
export async function GET(){return handle(async()=>readAccount(await requireUser()));}
