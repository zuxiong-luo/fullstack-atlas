import 'server-only';
export class Failure extends Error{constructor(public status:number,public code:string){super(code);}}
