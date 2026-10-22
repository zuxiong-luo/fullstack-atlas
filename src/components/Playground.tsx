import {browserExamples} from '../data/browserExamples';
import {useEffect,useRef,useState} from 'react';
import {Play,Square,RotateCcw,Terminal,Code2,Monitor,Smartphone,CheckCircle2,AlertCircle} from 'lucide-react';
import {exercises} from '../data/exercises';
import type {Mode} from '../data/exercises';
import {createReactDocument,createWorkerSource} from '../lib/runner';
type Log={kind:string;text:string};
export default function Playground({drafts,onSave,initialMode='js',exampleId}:{drafts:Record<string,string>;onSave:(key:string,code:string)=>void;initialMode?:Mode;exampleId?:string}){
 const example=exampleId?browserExamples[exampleId]:undefined;
 const [mode,setMode]=useState<Mode>(example?.mode??initialMode),[logs,setLogs]=useState<Log[]>([]),[status,setStatus]=useState('准备就绪'),[running,setRunning]=useState(false),[diagnostics,setDiagnostics]=useState<string[]|null>(null),[doc,setDoc]=useState(''),[mobile,setMobile]=useState(false),[panel,setPanel]=useState('editor');
 const current=example&&mode===example.mode?example:exercises[mode];
 const draftKey=example&&mode===example.mode?'example:'+exampleId:mode;
 const code=drafts[draftKey]??current.code;
 const worker=useRef<Worker|null>(null),checker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>>(),generation=useRef(0),token=useRef(''),iframe=useRef<HTMLIFrameElement>(null),runtime=useRef('');
 function stop(silent=false){generation.current++;worker.current?.terminate();worker.current=null;checker.current?.terminate();checker.current=null;clearTimeout(timer.current);setRunning(false);token.current='';setDoc('');if(!silent)setStatus('已停止，可修改后重新运行');}
 useEffect(()=>{return()=>{generation.current++;worker.current?.terminate();checker.current?.terminate();clearTimeout(timer.current)}},[]);
 useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.source!==iframe.current?.contentWindow||!event.data||event.data.token!==token.current||!token.current)return;const {kind,text}=event.data;if(typeof text!=='string'||!['log','info','warn','error','done'].includes(kind))return;if(kind==='done'){setRunning(false);setStatus('预览运行中')}else setLogs(prev=>[...prev,{kind,text:text.slice(0,6000)}].slice(-200))};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[]);
 async function run(){
  stop(true);const runId=generation.current;setLogs([]);setDiagnostics(null);setRunning(true);setStatus('正在编译…');if(window.innerWidth<800)setPanel('output');
  try {
   const babel=await import('@babel/standalone');if(generation.current!==runId)return;
   const transformed=babel.transform(code,{filename:mode==='react'?'App.tsx':mode==='ts'?'exercise.ts':'exercise.js',presets:mode==='react'?[['typescript',{allExtensions:true,isTSX:true}],['react',{runtime:'classic'}]]:mode==='ts'?['typescript']:[],plugins:mode==='react'?['transform-modules-commonjs']:[]}).code||'';
   if(mode==='ts'){
    checker.current=new Worker(new URL('../lib/typecheck.worker.ts',import.meta.url),{type:'module'});
    checker.current.onmessage=event=>{if(generation.current!==runId)return;setDiagnostics(event.data.diagnostics);checker.current?.terminate();checker.current=null};
    checker.current.onerror=()=>{if(generation.current===runId)setDiagnostics(['类型检查器未能启动，请重试。']);checker.current?.terminate();checker.current=null};
    checker.current.postMessage({id:runId,code});
   }
   if(mode==='react'){
    if(!runtime.current){const response=await fetch(`${import.meta.env.BASE_URL}react-runtime.js`);if(!response.ok)throw new Error('React 运行环境加载失败');runtime.current=await response.text()}
    if(generation.current!==runId)return;token.current=crypto.randomUUID();setDoc(createReactDocument(runtime.current,transformed,token.current));setStatus('正在启动预览…');setRunning(false);
   }else{
    const url=URL.createObjectURL(new Blob([createWorkerSource(transformed)],{type:'text/javascript'}));worker.current=new Worker(url);URL.revokeObjectURL(url);
    worker.current.onmessage=event=>{if(generation.current!==runId)return;const item=event.data;if(item.kind==='done')setStatus(item.text);else setLogs(prev=>[...prev,{kind:item.kind,text:String(item.text).slice(0,6000)}].slice(-200))};
    worker.current.onerror=event=>{if(generation.current!==runId)return;setLogs(prev=>[...prev,{kind:'error',text:event.message}]);setStatus('执行出错')};
    timer.current=setTimeout(()=>{worker.current?.terminate();worker.current=null;setRunning(false);setStatus('运行环境已释放（5 秒上限）')},5000);
   }
  }catch(error){if(generation.current!==runId)return;setLogs([{kind:'error',text:error instanceof Error?error.message:String(error)}]);setStatus('编译或运行失败');setRunning(false)}
 }
 function changeMode(next:Mode){stop(true);setMode(next);setLogs([]);setDiagnostics(null);setStatus('准备就绪');setPanel('editor')}
 return <div className="playground"><div className="lab-heading"><div><span className="eyebrow">LEARN BY DOING</span><h1>把理解，变成运行结果。</h1><p>修改代码、观察结果，再回到原理。每个实验都是一次验证。</p></div><span className="pill"><span className="dot"/> 浏览器本地执行</span></div>
 {exampleId&&!example&&<p role="alert">该实验不存在，已打开默认实验。</p>}{example&&<p><a href={'#article/'+example.articleId}>← 返回配套文章</a> · 此实验的草稿独立保存</p>}<div className="lab-mode-row">{(['js','ts','react'] as Mode[]).map(m=><button key={m} className={`mode-card ${mode===m?'active':''}`} onClick={()=>changeMode(m)}><span className={`lang lang-${m}`}>{m==='react'?'⚛':m.toUpperCase()}</span><div><strong>{m==='js'?'JavaScript':m==='ts'?'TypeScript':'React'}</strong><small>{m==='js'?'异步与语言基础':m==='ts'?'类型诊断与运行':'组件与实时预览'}</small></div></button>)}</div>
 <div className="experiment-brief"><div><span className="eyebrow">当前实验</span><h3>{current.title}</h3><p>{current.description}</p></div><div className="challenge"><strong>试着做一做</strong><p>{current.task}</p></div></div>
 <div className="mobile-editor-tabs"><button className={panel==='editor'?'active':''} onClick={()=>setPanel('editor')}>代码</button><button className={panel==='output'?'active':''} onClick={()=>setPanel('output')}>运行结果</button></div>
 <div className="editor-layout"><div className={`editor-pane ${panel==='editor'?'mobile-show':''}`}><div className="editor-toolbar"><span><Code2 size={15}/> {mode==='react'?'App.tsx':mode==='ts'?'exercise.ts':'exercise.js'}</span><div><button title="恢复初始代码" aria-label="恢复初始代码" onClick={()=>{if(confirm('恢复初始代码？当前实验的草稿会被替换。')){stop(true);onSave(draftKey,current.code)}}}><RotateCcw size={15}/></button><button className="run-button" onClick={run} disabled={running}><Play size={14}/>运行</button><button title="停止并清空运行环境" aria-label="停止运行" onClick={()=>stop()}><Square size={14}/></button></div></div><div className="code-area"><textarea aria-label="代码编辑器" spellCheck={false} value={code} onChange={e=>onSave(draftKey,e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();void run()}if(e.key==='Tab'){e.preventDefault();const input=e.currentTarget,start=input.selectionStart,end=input.selectionEnd;onSave(draftKey,code.slice(0,start)+'  '+code.slice(end));requestAnimationFrame(()=>{input.selectionStart=input.selectionEnd=start+2})}}}/></div><div className="editor-footer"><span>草稿自动保存在此设备</span><span>⌘ / Ctrl + Enter 运行</span></div></div>
 <div className={`output-pane ${panel==='output'?'mobile-show':''}`}><div className="output-toolbar"><span>{mode==='react'?<Monitor size={15}/>:<Terminal size={15}/>} {mode==='react'?'Preview':'Console'}</span>{mode==='react'&&<button onClick={()=>setMobile(!mobile)}><Smartphone size={14}/>{mobile?'桌面宽度':'手机宽度'}</button>}</div>
 {mode==='react'&&<div className={`preview-wrap ${mobile?'narrow':''}`}>{doc?<iframe ref={iframe} title="React 运行预览" sandbox="allow-scripts" srcDoc={doc}/>:<div className="output-empty"><Code2 size={32}/><strong>让代码呈现出来</strong><p>点击运行，查看你的 React 组件。</p></div>}</div>}
 {mode!=='react'&&logs.length===0&&<div className="output-empty"><Terminal size={32}/><strong>结果会出现在这里</strong><p>先预测输出顺序，再点击运行验证。</p></div>}
 <div className="console" aria-live="polite">{logs.map((log,i)=><div key={i} className={`log ${log.kind}`}><span>{log.kind==='error'?'×':'›'}</span><pre>{log.text}</pre></div>)}</div>
 {mode==='ts'&&<div className="diagnostics"><strong>{diagnostics===null?<Code2 size={15}/>:diagnostics.length?<AlertCircle size={15}/>:<CheckCircle2 size={15}/>}类型检查</strong>{diagnostics===null?<p>{running?'正在分析…':'运行后显示独立的类型诊断'}</p>:diagnostics.length?diagnostics.map((d,i)=><p className="type-error" key={i}>{d}</p>):<p className="type-ok">通过。类型正确不代表业务逻辑一定正确。</p>}</div>}
 <div className="output-status"><span className="dot"/>{status}</div></div></div><p className="lab-footnote">JS / TS 使用可终止的 Worker；React 在隔离 iframe 中预览。请勿运行无限循环的 React 代码。首版支持单文件与固定 React 依赖，不支持 Node.js API 或任意 npm 包。</p></div>
}
