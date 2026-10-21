export type Progress = 'new'|'learning'|'review'|'mastered';
export type RecordItem = {status:Progress;favorite:boolean;note:string;updatedAt:string};
export type Saved = {version:1;records:Record<string,RecordItem>;drafts:Record<string,string>};
export const KEY='fullstack-atlas:v1';
export const empty:Saved={version:1,records:{},drafts:{}};
export const blank:RecordItem={status:'new',favorite:false,note:'',updatedAt:''};
export function parseBackup(raw:string):Saved {
 const x=JSON.parse(raw);
 if(!x || x.version!==1 || !x.records || Array.isArray(x.records) || typeof x.records!=='object' || !x.drafts || Array.isArray(x.drafts) || typeof x.drafts!=='object') throw new Error('文件不是有效的 Atlas v1 备份');
 const records:Saved['records']={},drafts:Saved['drafts']={};
 for(const [id,r] of Object.entries(x.records) as [string,RecordItem][]){
  if(!r || !['new','learning','review','mastered'].includes(r.status)||typeof r.note!=='string'||typeof r.favorite!=='boolean'||typeof r.updatedAt!=='string') throw new Error('学习记录格式不正确');
  if(['__proto__','constructor','prototype'].includes(id)) throw new Error('无效记录标识');
  records[id]={status:r.status,note:r.note,favorite:r.favorite,updatedAt:r.updatedAt};
 }
 for(const [id,code] of Object.entries(x.drafts)) {if(typeof code!=='string'||['__proto__','constructor','prototype'].includes(id))throw new Error('代码草稿格式不正确');drafts[id]=code;}
 return {version:1,records,drafts};
}
export function readSaved():Saved {try{return parseBackup(localStorage.getItem(KEY)||JSON.stringify(empty))}catch{return structuredClone(empty)}}
export function downloadBackup(data:Saved){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`atlas-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function filterQuestions<T extends {title:string;tags:string[];summary:string;topic:string}>(items:T[],query:string,topic:string){const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);return items.filter(q=>(topic==='all'||q.topic===topic)&&words.every(w=>`${q.title} ${q.tags.join(' ')} ${q.summary}`.toLocaleLowerCase().includes(w)));}
