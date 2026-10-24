import {readCatalog,writeCatalog} from '../../../lib/store';
import {handle,requireAdmin,jsonInput} from '../../../lib/http';
// Deliberately skip cache invalidation so a stale-result window is reproducible.
export async function POST(request:Request){return handle(async()=>{
 requireAdmin(request);const title=await jsonInput(request);const before=await readCatalog();
 const next={title,revision:before.revision+1};await writeCatalog(next);return next;
});}
