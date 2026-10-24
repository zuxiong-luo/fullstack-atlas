import type {Instrumentation} from 'next';
export const onRequestError:Instrumentation.onRequestError=async(error,request,context)=>{
 const digest=typeof error==='object'&&error!==null&&'digest' in error?String(error.digest):undefined;
 console.error(JSON.stringify({event:'next.error',digest,method:request.method,route:context.routePath,kind:context.routeType}));
};
