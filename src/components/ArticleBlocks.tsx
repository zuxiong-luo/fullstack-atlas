import {useRef,useState} from 'react';
import HighlightedCode from './HighlightedCode';
import {sourceLocation,sourceSlice} from '../lib/reactSource';
import type {ArticleBlock} from '../data/articleTypes';
const asset=(path:string)=>`${import.meta.env.BASE_URL}${path.replace(/^\//,'')}`;
function CodeBlock({block:b}:{block:Extract<ArticleBlock,{type:'code'}>}){
 const [message,setMessage]=useState('复制');
 async function copy(){try{await navigator.clipboard.writeText(b.code);setMessage('已复制')}catch{setMessage('复制失败，请手动选择代码')}}
 return <div className="article-code"><div className="code-caption"><span>{b.filename||b.language} · {{runnable:'可直接运行',excerpt:'项目节选',pseudocode:'原理伪代码'}[b.kind]}</span><button onClick={copy} aria-label={'复制代码 '+(b.filename||b.purpose)}>{message}</button></div><p className="code-purpose">{b.purpose}</p><pre tabIndex={0} aria-label={b.purpose}><HighlightedCode code={b.code} language={b.filename?.includes(".old.js")?"flow":b.language}/></pre></div>
}
function SourceReference({block:b,shown=false}:{block:Extract<ArticleBlock,{type:'reference'}>;shown?:boolean}){
 const location=sourceLocation(b.url);
 const [open,setOpen]=useState(false),[snippet,setSnippet]=useState<{code:string;end:number}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function toggle(){
  if(open){setOpen(false);return}setOpen(true);
  if(snippet||!location)return;
  setBusy(true);setError('');
  try{const response=await fetch(asset(location.asset));if(!response.ok)throw new Error('加载失败');const text=await response.text();if(!text.startsWith('/**'))throw new Error('源码资源格式错误');setSnippet(sourceSlice(text,location.start,location.end))}
  catch{setError('源码暂未加载，请联网重试，或先下载完整离线包。')}finally{setBusy(false)}
 }
 return <div className="inline-reference source-reference"><div className="source-reference-heading">{location&&!shown&&<button type="button" aria-expanded={open} onClick={toggle}>{open?'收起源码':'展开源码'} · {b.title}</button>}<a href={b.url} target="_blank" rel="noreferrer">{location?'代码出处 · React v18.3.1':b.title} ↗</a></div>{b.note&&<p>{b.note}</p>}{open&&<div>{busy&&<p role="status">正在加载本地源码…</p>}{error&&<p role="alert">{error}</p>}{snippet&&location&&<><CodeBlock block={{type:'code',code:snippet.code,language:'flow',kind:'excerpt',filename:location.path.split('/').pop()+':'+location.start+'–'+snippet.end,purpose:location.context?'固定 v18.3.1：显示定位行起的上下文，不代表完整函数。':'固定 v18.3.1：引用行范围的原始源码，可能从函数中间开始或结束；依赖 React 内部上下文。'}}/><p className="subtle small">Facebook React · MIT · <a href={asset('sources/react-v18.3.1/LICENSE')} target="_blank" rel="noreferrer">版权与许可</a></p></>}</div>}</div>
}
function Figure({block:b}:{block:Extract<ArticleBlock,{type:'figure'}>}){
 const dialog=useRef<HTMLDialogElement>(null);
 return <figure className="article-figure"><div className="figure-scroll" tabIndex={0}><img src={asset(b.src)} alt={b.alt} loading="lazy"/></div><figcaption><strong>{b.title}</strong><p>{b.caption}</p><button className="text-button" onClick={()=>dialog.current?.showModal()}>放大查看</button></figcaption><dialog ref={dialog} className="figure-dialog" aria-label={b.title} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}><button className="button secondary" autoFocus onClick={()=>dialog.current?.close()}>关闭图形</button><div className="figure-scroll"><img src={asset(b.src)} alt={b.alt}/></div><p>{b.caption}</p></dialog></figure>
}
export default function ArticleBlocks({blocks}:{blocks:ArticleBlock[]}){return <>{blocks.map((b,i)=>{switch(b.type){case 'paragraph':return <p key={i}>{b.text}</p>;case 'list':{const Tag=b.ordered?'ol':'ul';return <Tag key={i}>{b.items.map((item,j)=><li key={j}>{item}</li>)}</Tag>};case 'code':return <CodeBlock key={i} block={b}/>;case 'figure':return <Figure key={i} block={b}/>;case 'table':return <div className="article-table" key={i} tabIndex={0}><table>{b.caption&&<caption>{b.caption}</caption>}<thead><tr>{b.headers.map((h,j)=><th key={j} scope="col">{h}</th>)}</tr></thead><tbody>{b.rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k}>{cell}</td>)}</tr>)}</tbody></table></div>;case 'callout':return <aside key={i} className="answer-card article-callout"><strong>{b.title}</strong><p>{b.text}</p></aside>;case 'experiment':return <div key={i} className="answer-card"><strong>{b.title}</strong><p>{b.description}</p><a className="button secondary" href={'#lab/example/'+b.id}>打开这个实验 →</a></div>;case 'reference':{const loc=sourceLocation(b.url);const shown=Boolean(loc&&blocks.slice(0,i).some(item=>item.type==='code'&&new RegExp(`(?:^|[ ·])${loc.path.split('/').pop()!.replaceAll('.','\\.')}[: ]${loc.start}[–-]${loc.end}(?:$|[ ·])`).test(item.filename||'')));return <SourceReference key={b.url+':'+i} block={b} shown={shown}/>}}})}</>}
