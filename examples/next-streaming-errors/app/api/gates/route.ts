import {initialize,release,state,validId} from '@/lib/gates';
export const runtime='nodejs';
export async function POST(request:Request){
  if(process.env.DEMO_LAB!=='1')return Response.json({error:'LAB_DISABLED'},{status:403});
  if(request.headers.get('origin')!==process.env.DEMO_APP_ORIGIN)return Response.json({error:'ORIGIN'},{status:403});
  const reader=request.body?.getReader();let text='',bytes=0;
  try {
    if(!reader)throw new Error('BAD_INPUT');const decoder=new TextDecoder();
    for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1024){await reader.cancel();throw new Error('BAD_INPUT');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
    const input=JSON.parse(text);if(!validId(input.id))throw new Error('BAD_INPUT');
    if(input.op==='init')initialize(input.id,input.mode,input.timeoutMs??30000);
    else if(input.op==='release')release(input.id);
    else throw new Error('BAD_INPUT');
    return Response.json({ok:true,state:state(input.id)});
  }catch(error){const message=error instanceof Error?error.message:'BAD_INPUT';return Response.json({error:message},{status:['GATE_BUSY','LAB_CAPACITY'].includes(message)?409:message==='NOT_FOUND'?404:400});}
  finally{reader?.releaseLock();}
}
export async function GET(request:Request){
  if(process.env.DEMO_LAB!=='1')return Response.json({error:'LAB_DISABLED'},{status:403});
  const id=new URL(request.url).searchParams.get('id');if(!validId(id))return Response.json({error:'BAD_INPUT'},{status:400});
  return Response.json({state:state(id)});
}
