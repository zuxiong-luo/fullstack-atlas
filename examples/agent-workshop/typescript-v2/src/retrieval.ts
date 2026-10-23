import {documents,type Document,type Evidence,evidenceOf} from './contracts.js';
export interface Retriever {search(owner:string,question:string):Promise<Evidence[]>;}
export class KeywordRetriever implements Retriever {
 constructor(private docs:Document[]=documents){}
 async search(owner:string,question:string):Promise<Evidence[]> {
  const normalized=question.normalize('NFKC').toLowerCase();
  const ranked=this.docs.filter(d=>d.owner==='public'||d.owner===owner).map(doc=>({doc,score:doc.keywords.filter(k=>normalized.includes(k)).length})).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||(a.doc.id<b.doc.id?-1:a.doc.id>b.doc.id?1:0));
  return evidenceOf(ranked.slice(0,3).map(row=>row.doc));
 }
}
