import {existsSync,readFileSync} from 'node:fs';
export const shared = [new URL('../../shared/v2/',import.meta.url),new URL('../../../shared/v2/',import.meta.url)].find(url=>existsSync(new URL('CONTRACT.md',url)))!;
if(!shared)throw new Error('shared/v2 contract not found');
export const readShared=(file:string):any=>JSON.parse(readFileSync(new URL(file,shared),'utf8'));
export type Document={id:string;owner:string;title:string;text:string;keywords:string[]};
export type Evidence=Pick<Document,'id'|'title'|'text'>;
export type Input={question:string;evidence:Evidence[]};
export type Answer={answer:string;citations:string[]};
export const documents:Document[]=readShared('documents.json');
export const cp=(text:string)=>Array.from(text).length;
export const wellFormed=(value:string)=>Array.from(value).every(char=>{const point=char.codePointAt(0)!;return point<0xD800||point>0xDFFF});
export class ServiceError extends Error {constructor(public status:number,public code:string,message=code){super(message);}}
export const fail=(status:number,code:string):never=>{throw new ServiceError(status,code)};
export const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function exact(value:unknown,keys:string[]):Record<string,unknown>{
 if(!object(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail(400,'INVALID_REQUEST');
 return value as Record<string,unknown>;
}
export function text(value:unknown,max=2000):string {
 if(typeof value!=='string')fail(400,'INVALID_REQUEST');const result=(value as string).trim();
 if(!wellFormed(result)||cp(result)<1||cp(result)>max)fail(400,'INVALID_REQUEST');return result;
}
export function id(value:unknown):string {const result=text(value,64);if(!/^[A-Za-z0-9_-]{1,64}$/.test(result))fail(400,'INVALID_REQUEST');return result;}
export function questionBody(raw:unknown){const body=exact(raw,['question']);return{question:text(body.question)}}
export function runBody(raw:unknown){const body=exact(raw,['request_id','question']);return{request_id:id(body.request_id),question:text(body.question)}}
export function memoryBody(raw:unknown){const body=exact(raw,['id','text']);return{id:id(body.id),text:text(body.text)}}
export function parseAnswer(raw:string,evidence:Evidence[]):Answer {
 let value:unknown;try{value=JSON.parse(raw)}catch{fail(502,'MODEL_FORMAT_ERROR')}
 if(!object(value)||Object.keys(value).length!==2||!Object.hasOwn(value,'answer')||!Object.hasOwn(value,'citations')||typeof value.answer!=='string'||!value.answer.trim()||!wellFormed(value.answer)||cp(value.answer.trim())>4000||!Array.isArray(value.citations)||value.citations.some(item=>typeof item!=='string'||!item||!wellFormed(item))||new Set(value.citations).size!==value.citations.length)fail(502,'MODEL_SCHEMA_ERROR');
 const answer=value as {answer:string;citations:string[]};const allowed=new Set(evidence.map(d=>d.id));
 if(answer.citations.some(item=>!allowed.has(item)))fail(502,'UNSUPPORTED_CITATION');
 return{answer:answer.answer.trim(),citations:answer.citations};
}
export const evidenceOf=(docs:Document[]):Evidence[]=>docs.map(({id,title,text})=>({id,title,text}));
