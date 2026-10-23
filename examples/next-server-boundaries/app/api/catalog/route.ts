import {requireUser,requireSameOrigin,RequestFailure} from '@/lib/auth';
import {handle,textInput} from '@/lib/http';
import {writeCatalog} from '@/lib/store';
import {getCatalog} from '@/lib/catalog';
import {revalidateTag,revalidatePath} from 'next/cache';
export async function GET(){return handle(getCatalog);}
export async function POST(request:Request){return handle(async()=>{
 requireSameOrigin(request);const id=await requireUser();
 if(id!=='alice')throw new RequestFailure(403,'只有演示编辑者 Alice 可以修改公开目录');
 const title=await textInput(request,'title');await writeCatalog(title);
 revalidateTag('atlas-public-catalog',{expire:0});revalidatePath('/account');
 return {ok:true};
});}
