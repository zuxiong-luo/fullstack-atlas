import {documents,exact,fail,id,type Document,type Evidence,wellFormed} from './contracts.js';
export function lookup(owner:string,documentId:string,docs:Document[]=documents):Evidence {
 const doc=docs.find(item=>item.id===documentId&&(item.owner==='public'||item.owner===owner));
 if(!doc)fail(403,'DOCUMENT_FORBIDDEN');const {id,title,text}=doc!;return{id,title,text};
}
export function executeTool(owner:string,raw:unknown,docs:Document[]=documents):Evidence {
 const request=exact(raw,['name','arguments']);
 if(typeof request.name!=='string'||!wellFormed(request.name))fail(400,'INVALID_REQUEST');
 if((request.name as string).trim()!=='lookup_document')fail(403,'TOOL_FORBIDDEN');
 const args=exact(request.arguments,['document_id']);return lookup(owner,id(args.document_id),docs);
}
