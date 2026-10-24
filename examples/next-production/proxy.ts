import {randomUUID} from 'node:crypto';
import {NextResponse,type NextRequest} from 'next/server';
export function proxy(request:NextRequest){
 const supplied=request.headers.get('x-request-id');
 const requestId=supplied&&/^[A-Za-z0-9_-]{8,64}$/.test(supplied)?supplied:randomUUID();
 const headers=new Headers(request.headers);headers.set('x-request-id',requestId);
 const response=NextResponse.next({request:{headers}});response.headers.set('x-request-id',requestId);return response;
}
export const config={matcher:['/api/report']};
