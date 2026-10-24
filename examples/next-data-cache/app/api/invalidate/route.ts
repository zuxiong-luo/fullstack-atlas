import { revalidateTag } from 'next/cache';
import { handle,requireAdmin } from '../../../lib/http';
export async function POST(request:Request){return handle(async()=>{
 requireAdmin(request);revalidateTag('chapter-catalog',{expire:0});return {invalidated:true};
});}
