import {pathToFileURL} from 'node:url';
import {readShared} from './contracts.js';import {KeywordRetriever,type Retriever} from './retrieval.js';
export type EvalCase={id:string;owner:string;question:string;expected:string[]};
export async function evaluate(cases:EvalCase[],retriever:Retriever=new KeywordRetriever()){
 if(!Array.isArray(cases)||!cases.length||!cases.some(row=>Array.isArray(row.expected)&&row.expected.length>0)||!cases.some(row=>Array.isArray(row.expected)&&row.expected.length===0))throw new Error('Evaluation requires nonempty positive and no-hit cases');
 const results=[];
 for(const item of cases){
  if(typeof item.id!=='string'||typeof item.owner!=='string'||typeof item.question!=='string'||!Array.isArray(item.expected)||item.expected.some(id=>typeof id!=='string')||new Set(item.expected).size!==item.expected.length)throw new Error('Invalid evaluation case');
  const selected=(await retriever.search(item.owner,item.question)).slice(0,3).map(d=>d.id),recall=item.expected.length?item.expected.filter(id=>selected.includes(id)).length/item.expected.length:null,no_hit_correct=item.expected.length?null:selected.length===0;
  results.push({id:item.id,selected,expected:item.expected,recall_at_3:recall,no_hit_correct});
 }
 const scored=results.filter(r=>r.recall_at_3!==null),mean=scored.reduce((n,row)=>n+row.recall_at_3!,0)/scored.length;
 return{kind:'keyword_retrieval_regression',cases:results,mean_recall_at_3:mean,no_hit_pass:results.filter(row=>row.no_hit_correct!==null).every(row=>row.no_hit_correct),model_calls:0,not_model_quality:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const report=await evaluate(readShared('retrieval-cases.json'));console.log(JSON.stringify(report,null,2));if(!Number.isFinite(report.mean_recall_at_3)||report.mean_recall_at_3<1||!report.no_hit_pass)process.exitCode=1;}
 catch{console.log(JSON.stringify({error:'INVALID_EVALUATION_DATA',not_model_quality:true}));process.exitCode=1;}
}
