import React from 'react';
export function summarizeFrames(intervals:readonly number[]){
 if(!intervals.length||intervals.some(x=>!Number.isFinite(x)||x<=0))throw new RangeError('positive frame samples required');
 const sorted=[...intervals].sort((a,b)=>a-b),rank=(p:number)=>sorted[Math.ceil(sorted.length*p)-1];
 return {samples:sorted.length,p50Ms:rank(.5),p95Ms:rank(.95),maxMs:sorted.at(-1)!,over16_7Ms:sorted.filter(x=>x>16.7).length};
}
export function visibleRange(scrollTop:number,count=2000,height=320,rowHeight=32,overscan=3){
 if(!Number.isFinite(scrollTop)||scrollTop<0||!Number.isSafeInteger(count)||count<1||!Number.isFinite(height)||height<=0||!Number.isFinite(rowHeight)||rowHeight<=0||!Number.isSafeInteger(overscan)||overscan<0)throw new RangeError('bounded list parameters required');
 const first=Math.min(count-1,Math.floor(scrollTop/rowHeight)),start=Math.max(0,first-overscan),end=Math.min(count,Math.ceil((scrollTop+height)/rowHeight)+overscan);
 return {start,end,before:start*rowHeight,after:(count-end)*rowHeight};
}
export function expectedBytes(size:number){
 if(!Number.isSafeInteger(size)||size<1||size>8*1024*1024)throw new RangeError('1..8MiB');
 return {size,first:7,last:19};
}

export function startupMark(value:unknown){
 return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
}
type WorkerEnvironment={createURL:(source:string)=>string;createWorker:(url:string)=>Worker;revokeURL:(url:string)=>void};
export async function withOwnedWorker<T>(source:string,run:(worker:Worker)=>Promise<T>,environment:WorkerEnvironment={
 createURL:source=>URL.createObjectURL(new Blob([source],{type:'text/javascript'})),
 createWorker:url=>new Worker(url),revokeURL:url=>URL.revokeObjectURL(url)
}){
 let url:string|undefined,worker:Worker|undefined;
 try{url=environment.createURL(source);worker=environment.createWorker(url);return await run(worker);}
 finally{try{worker?.terminate();}finally{if(url!==undefined)environment.revokeURL(url);}}
}

const workerSource="self.onmessage=e=>{const a=new Uint8Array(e.data.buffer);self.postMessage({id:e.data.id,size:a.byteLength,first:a[0],last:a[a.length-1]});};";
export default function App(){
 const [mode,setMode]=React.useState<'full'|'window'>('full'),[top,setTop]=React.useState(0),[busy,setBusy]=React.useState(false),[scrollResult,setScrollResult]=React.useState<unknown>(null),[channel,setChannel]=React.useState<unknown>(null),[memory,setMemory]=React.useState<unknown>(null),[startup,setStartup]=React.useState<unknown>(null);
 const box=React.useRef<HTMLDivElement>(null),booted=React.useRef(false);
 React.useLayoutEffect(()=>{if(booted.current)return;booted.current=true;const begin=startupMark((window as unknown as {__atlasBoot?:number}).__atlasBoot),commit=performance.now();
  if(begin===null){setStartup({supported:false,note:'HTML pre-bundle mark absent: startup timing requires the independent local index.html; lab host lifecycle is different'});return;}
  requestAnimationFrame(()=>requestAnimationFrame(()=>setStartup({supported:true,cacheCondition:'本页未强制清缓存；请记录首次或重复加载',begin:'HTML inline mark, before local JS bundle',end:'React layout effect / second requestAnimationFrame opportunity',htmlToCommitMs:commit-begin,htmlToSecondFrameMs:performance.now()-begin,navigationType:(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.type??'unavailable'})));
 },[]);
 const range=visibleRange(top),ids=Array.from({length:mode==='full'?2000:range.end-range.start},(_,i)=>mode==='full'?i:range.start+i);
 async function scroll(){
  if(!box.current||document.visibilityState!=='visible')return;setBusy(true);setScrollResult(null);
  const intervals:number[]=[];let previous:number|undefined;const target=box.current,begin=performance.now();
  try{for(let step=0;step<120;step++){const now=await new Promise<number>(requestAnimationFrame);if(document.visibilityState!=='visible')throw new Error('TAB_HIDDEN: discard this run');if(previous!==undefined)intervals.push(now-previous);previous=now;const next=Math.floor(step*(2000*32-320)/119);target.scrollTop=next;setTop(next);}
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   setScrollResult({platform:'Web DOM',mode,rows:2000,viewportPx:320,rowHeightPx:32,steps:120,...summarizeFrames(intervals),elapsedMs:performance.now()-begin,domRows:target.querySelectorAll('[data-row]').length,scrollTop:target.scrollTop,note:'rAF callback intervals, not physical frame presentation or native FPS; identical fixed workload'});
  }catch(error){setScrollResult({error:(error as Error).message});}finally{setBusy(false);}
 }
 async function communicate(transfer:boolean){
  setBusy(true);
  try{await withOwnedWorker(workerSource,async worker=>{
   const samples:number[]=[],records:unknown[]=[];let nextId=0;
   const round=async(size:number,measured:boolean)=>{const expected=expectedBytes(size),buffer=new ArrayBuffer(size),a=new Uint8Array(buffer);a[0]=7;a[a.length-1]=19;const id=nextId++,start=performance.now();
    const received=await new Promise<{id:number;size:number;first:number;last:number}>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('WORKER_TIMEOUT')),5000);worker.onmessage=e=>{clearTimeout(timer);resolve(e.data);};worker.onerror=()=>{clearTimeout(timer);reject(new Error('WORKER_ERROR'));};worker.postMessage({id,buffer},transfer?[buffer]:[]);});
    const ms=performance.now()-start;if(received.id!==id||received.size!==expected.size||received.first!==7||received.last!==19)throw new Error('BAD_RESULT');
    if(measured){samples.push(ms);records.push({id,senderBytes:buffer.byteLength,receivedBytes:received.size});}
   };
   await round(8,false);for(let i=0;i<8;i++)await round(1024*1024,true);
   setChannel({transport:'real browser Worker',mode:transfer?'transfer':'clone',warmup:1,payloadBytes:1024*1024,...summarizeFrames(samples),records,note:'round trip includes dispatch, clone/transfer, worker response; no claim of universal zero-copy or speed ranking'});
  });}catch(error){setChannel({error:(error as Error).message});}finally{setBusy(false);}
 }
 function inspectMemory(){const data=(performance as Performance&{memory?:{usedJSHeapSize:number;totalJSHeapSize:number;jsHeapSizeLimit:number}}).memory;setMemory(data?{supported:true,usedJSHeapSize:data.usedJSHeapSize,totalJSHeapSize:data.totalJSHeapSize,jsHeapSizeLimit:data.jsHeapSizeLimit,note:'non-standard approximate JS heap of this browser context; not RSS, not retained size, no forced GC'}:{supported:false,note:'performance.memory unavailable; do not substitute fabricated zero'});}
 return <main style={{fontFamily:'system-ui',padding:20,maxWidth:1000,margin:'auto',color:'#193c2d'}}><h1>跨平台性能：先固定平台与测量边界</h1><p>当前代表平台是 Web DOM。请保持页面可见；先运行全量，再切窗口化重复。结果不代表 RN/Flutter 真机帧率。</p><h2>启动观察</h2><pre style={{overflowX:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(startup,null,2)}</pre><h2>固定 2000 行滚动</h2><label>实现 <select disabled={busy} value={mode} onChange={e=>{setMode(e.target.value as typeof mode);setTop(0);if(box.current)box.current.scrollTop=0;setScrollResult(null);}}><option value="full">全量 DOM</option><option value="window">窗口化 DOM</option></select></label> <button disabled={busy} onClick={scroll}>运行 120 步滚动</button><div ref={box} onScroll={e=>setTop(e.currentTarget.scrollTop)} style={{height:320,overflowY:'auto',border:'1px solid #789c86',marginTop:12}}><div style={{height:mode==='window'?range.before:0}}/>{ids.map(id=><div key={id} data-row={id} style={{height:32,boxSizing:'border-box',padding:'5px 12px',borderBottom:'1px solid #dce9df'}}>第 {id} 行 · 固定行高与相同文本工作量</div>)}<div style={{height:mode==='window'?range.after:0}}/></div><pre style={{overflowX:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(scrollResult,null,2)}</pre><h2>真实 Worker 通信</h2><button disabled={busy} onClick={()=>communicate(false)}>测 clone：8 × 1MiB</button> <button disabled={busy} onClick={()=>communicate(true)}>测 transfer：8 × 1MiB</button><pre style={{overflowX:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(channel,null,2)}</pre><h2>内存能力检测</h2><button disabled={busy} onClick={inspectMemory}>读取可用堆指标</button><pre style={{overflowX:'auto',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(memory,null,2)}</pre><p role="status">{busy?'测量中，请保持前台':'空闲；复制完整原始结果并注明缓存、平台、视口和运行顺序。'}</p></main>;
}
