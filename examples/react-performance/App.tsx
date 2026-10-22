import React, {memo, Profiler, useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
type Book = {id:number; title:string; selected:boolean};
export function makeBooks(n=300):Book[]{return Array.from({length:n},(_,id)=>({id,title:`书籍 ${id}`,selected:false}));}
export function toggleBook(books:Book[],id:number){return books.map(b=>b.id===id?{...b,selected:!b.selected}:b);}
export function windowRange(total:number,scrollTop:number,rowHeight:number,height:number,overscan=3){
 const start=Math.max(0,Math.floor(scrollTop/rowHeight)-overscan);
 const end=Math.min(total,Math.ceil((scrollTop+height)/rowHeight)+overscan);
 return {start:Math.min(start,total),end};
}
export function percentile(values:number[],fraction:number){if(!values.length)return null;const a=[...values].sort((x,y)=>x-y);return a[Math.max(0,Math.min(a.length-1,Math.ceil(fraction*a.length)-1))];}
// 保存 Profiler 观测，不在回调中 setState，避免测量面板引起额外提交循环。
export const samples:{phase:string;actual:number;base:number}[]=[];
function Row({book,onToggle}:{book:Book;onToggle:(id:number)=>void}){
 const commits=useRef(0);const counter=useRef<HTMLSpanElement>(null);
 useLayoutEffect(()=>{commits.current++;if(counter.current)counter.current.textContent=String(commits.current)});
 return <div data-row={book.id} style={{height:44,boxSizing:'border-box',display:'flex',gap:10,alignItems:'center',borderBottom:'1px solid #ccd6d0'}}>
  <button aria-label={`切换书籍 ${book.id}`} onClick={()=>onToggle(book.id)}>{book.selected?'已选':'未选'}</button>
  <span>{book.title}</span><small>行提交诊断 <span data-commits={book.id} ref={counter}>0</span></small>
 </div>;
}
const MemoRow=memo(Row);
const UnsafeRead=memo(function Read({read}:{read:()=>void}){return <button onClick={read}>错误比较：读取计数</button>},()=>true);
const SafeRead=memo(function Read({read}:{read:()=>void}){return <button onClick={read}>默认比较：读取计数</button>});
export default function App(){
 const [books,setBooks]=useState(()=>makeBooks());const [tick,setTick]=useState(0);const [mode,setMode]=useState('plain');
 const [query,setQuery]=useState('');const [top,setTop]=useState(0);const [report,setReport]=useState('尚未读取');
 const listRef=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{if(listRef.current)listRef.current.scrollTop=0},[mode,query]);
 const stableToggle=useCallback((id:number)=>setBooks(prev=>toggleBook(prev,id)),[]);
 const filtered=useMemo(()=>books.filter(b=>b.title.includes(query)),[books,query]);
 const virtual=mode==='window';const range=windowRange(filtered.length,top,44,264);const shown=virtual?filtered.slice(range.start,range.end):filtered;
 const Item=mode==='plain'?Row:MemoRow;
 const toggle=mode==='unstable'?(id:number)=>stableToggle(id):stableToggle;
 return <main style={{padding:20,fontFamily:'system-ui',maxWidth:900,margin:'auto',lineHeight:1.7}}>
  <h1>性能优化：减少哪些工作？</h1><p>React 18.3.1。行计数来自 layout effect，只验证提交后行为，不能当耗时或全部 render 尝试次数。</p>
  <label>模式 <select aria-label="优化模式" value={mode} onChange={e=>{setMode(e.target.value);setTop(0)}}><option value="plain">普通行</option><option value="unstable">memo + 不稳定函数</option><option value="stable">memo + 稳定输入</option><option value="window">固定行高窗口</option></select></label>{' '}
  <button onClick={()=>setTick(n=>n+1)}>无关计数加一</button> <output aria-label="无关计数">{tick}</output>
  <p><label>搜索 <input aria-label="搜索书籍" value={query} onChange={e=>{setQuery(e.target.value);setTop(0)}}/></label></p>
  <p>匹配 {filtered.length} 行；渲染 {shown.length} 行；已选 {books.filter(b=>b.selected).length} 本。</p>
  <Profiler id="books" onRender={(_id,phase,actual,base)=>{samples.push({phase,actual,base})}}>
   <div key={mode} ref={listRef} aria-label="书籍列表" style={{height:264,overflowY:'auto',border:'1px solid #999'}} onScroll={e=>{if(virtual)setTop(e.currentTarget.scrollTop)}}>
    <div style={virtual?{height:filtered.length*44,position:'relative'}:{}}>
     <div style={virtual?{position:'absolute',top:range.start*44,left:0,right:0}:{}}>{shown.map(book=><Item key={book.id} book={book} onToggle={toggle}/>)}</div>
    </div>
   </div>
  </Profiler>
  <p>窗口版固定44px行高、264px视口，未实现动态测量、焦点保留、浏览器全文查找与完整可访问性策略。业务选中状态在父列表，移出窗口不会丢失。</p>
  <button onClick={()=>{samples.length=0}}>清空采样</button>{' '}
  <button onClick={()=>{const a=samples.filter(x=>x.phase==='update').map(x=>x.actual);setReport(a.length?`update样本=${a.length}; actualDuration中位数=${percentile(a,.5)?.toFixed(3)}ms; P95=${percentile(a,.95)?.toFixed(3)}ms`:'无样本：普通生产React默认关闭Profiler，请用本地npm run dev。')}}>读取采样</button>
  <p>记录当次读取之前的样本；读取本身也会更新父组件。开发构建结果只用于定位，不能宣传为生产性能收益。</p>
  <UnsafeRead read={()=>setReport(`错误闭包：${tick}`)}/>{' '}<SafeRead read={()=>setReport(`当前快照：${tick}`)}/>
  <pre aria-label="结果" style={{whiteSpace:'pre-wrap'}}>{report}</pre>
 </main>;
}
