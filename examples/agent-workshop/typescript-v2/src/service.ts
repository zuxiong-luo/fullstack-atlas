import {cp,fail,parseAnswer,type Answer,type Evidence} from './contracts.js';
import {KeywordRetriever,type Retriever} from './retrieval.js';
import {invoke,mockProvider,type Provider} from './providers.js';
import {Store,publicRun,type Run} from './store.js';
type Hold=(promise:Promise<unknown>)=>void;
export type Options={chapter?:number;store?:Store;provider?:Provider;retriever?:Retriever;timeoutMs?:number;leaseMs?:number;maxConcurrent?:number;maxContextChars?:number;maxModelCalls?:number;afterRetrieved?:(run:Run)=>Promise<void>|void};
export class Service {
 readonly chapter:number;readonly store:Store;readonly provider:Provider;readonly retriever:Retriever;
 readonly timeoutMs:number;readonly leaseMs:number;readonly maxConcurrent:number;readonly maxContextChars:number;readonly maxModelCalls:number;
 active=0;
 constructor(readonly options:Options={}){
  this.chapter=options.chapter??8;this.store=options.store??new Store();this.provider=options.provider??mockProvider;this.retriever=options.retriever??new KeywordRetriever();
  this.timeoutMs=options.timeoutMs??3000;this.leaseMs=options.leaseMs??10000;this.maxConcurrent=options.maxConcurrent??2;this.maxContextChars=options.maxContextChars??12000;this.maxModelCalls=options.maxModelCalls??1;
  for(const [name,value,min,max]of [['chapter',this.chapter,2,8],['timeoutMs',this.timeoutMs,1,60000],['leaseMs',this.leaseMs,1,120000],['maxConcurrent',this.maxConcurrent,1,100],['maxContextChars',this.maxContextChars,1,1000000],['maxModelCalls',this.maxModelCalls,0,100]] as const)if(!Number.isInteger(value)||value<min||value>max)throw new Error('Invalid '+name);
 }
 private async inSlot<T>(fn:(hold:Hold)=>Promise<T>):Promise<T>{
  if(this.chapter<8)return fn(()=>{});
  if(this.active>=this.maxConcurrent)fail(503,'SERVICE_BUSY');this.active++;
  const holds:Promise<unknown>[]=[];
  try{return await fn(promise=>holds.push(promise))}
  finally {if(holds.length)void Promise.allSettled(holds).then(()=>{this.active--});else this.active--;}
 }
 private async respond(question:string,evidence:Evidence[],hold:Hold){
  const context_chars=cp(question)+evidence.reduce((n,item)=>n+cp(item.id)+cp(item.title)+cp(item.text),0);
  if(this.chapter>=8&&context_chars>this.maxContextChars)fail(400,'CONTEXT_TOO_LARGE');
  if(!evidence.length)return{answer:'没有找到可引用的资料。',citations:[],evidence,metrics:{retrieved:0,model_calls:0,context_chars}};
  if(this.chapter>=8&&this.maxModelCalls<1)fail(400,'MODEL_BUDGET_EXCEEDED');
  const raw=await invoke(this.provider,{question,evidence},this.timeoutMs,hold);
  return{...parseAnswer(raw,evidence),evidence,metrics:{retrieved:evidence.length,model_calls:1,context_chars}};
 }
 async answer(owner:string,question:string){return this.inSlot(async hold=>this.respond(question,await this.retriever.search(owner,question),hold));}
 async run(owner:string,id:string,question?:string){
  const initial=question===undefined?this.store.get(owner,id):this.store.ensure(owner,id,question);
  if(!initial)fail(404,'RUN_NOT_FOUND');if(initial!.status==='completed')return publicRun(initial!);
  return this.inSlot(async hold=>{
   const claim=this.store.claim(owner,id,this.leaseMs);if(claim.status==='completed')return publicRun(claim);
   try {
    let evidence:Evidence[];
    if(claim.checkpoint==='retrieved')evidence=JSON.parse(claim.evidence);
    else {evidence=await this.retriever.search(owner,claim.question);this.store.retrieved(claim,evidence);await this.options.afterRetrieved?.(this.store.get(owner,id)!);}
    const result=await this.respond(claim.question,evidence,hold);this.store.complete(claim,result as Answer);return publicRun(this.store.get(owner,id)!);
   }finally{this.store.release(claim);}
  });
 }
}
