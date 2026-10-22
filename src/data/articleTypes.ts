export type ArticleBlock =
 | {type:'paragraph';text:string}
 | {type:'list';items:string[];ordered?:boolean}
 | {type:'code';code:string;language:string;filename?:string;purpose:string;kind:'runnable'|'excerpt'|'pseudocode'}
 | {type:'figure';src:string;title:string;alt:string;caption:string}
 | {type:'table';headers:string[];rows:string[][];caption?:string}
 | {type:'callout';title:string;text:string}
 | {type:'experiment';id:string;title:string;description:string}
 | {type:'reference';title:string;url:string;note?:string};
export type ArticleSection={id:string;title:string;paragraphs:string[];blocks?:ArticleBlock[];code?:string;language?:string;takeaway?:string};
export type Article={id:string;topic:string;title:string;description:string;minutes:number;tags:string[];scope:string;prerequisites:string[];sections:ArticleSection[];questionIds:string[];references:{title:string;url:string}[];experiment?:'js'|'ts'|'react';kind?:'overview'|'tutorial'|'series';status?:'overview'|'review'|'complete';versions?:string[];verifiedAt?:string;labMinutes?:number;examples?:{label:string;path:string}[]};
export function sectionBlocks(s:ArticleSection):ArticleBlock[]{return s.blocks??[...s.paragraphs.map(text=>({type:'paragraph' as const,text})),...(s.code?[{type:'code' as const,code:s.code,language:s.language||'text',purpose:'示例与说明',kind:'excerpt' as const}]:[]),...(s.takeaway?[{type:'callout' as const,title:'记住这一点',text:s.takeaway}]:[])];}
export function blockText(b:ArticleBlock):string{switch(b.type){case 'paragraph':return b.text;case 'list':return b.items.join(' ');case 'code':return [b.code,b.filename,b.purpose].join(' ');case 'figure':return [b.title,b.alt,b.caption].join(' ');case 'table':return [b.caption,...b.headers,...b.rows.flat()].join(' ');case 'callout':return b.title+' '+b.text;case 'experiment':return b.title+' '+b.description;case 'reference':return b.title+' '+(b.note||'');}}
