import {useEffect, useReducer, useRef, useState} from 'react';
export type Book = {id:string; title:string; done:boolean};
export type Action = {type:'toggle'; id:string} | {type:'reset'};
export const initialBooks:Book[] = [{id:'hooks',title:'Hooks 与交互',done:false},{id:'fiber',title:'Fiber 与协调',done:false}];
export function reducer(state:Book[], action:Action):Book[] {
  switch(action.type){
    case 'reset': return initialBooks.map(book=>({...book}));
    case 'toggle': return state.map(book=>book.id===action.id?{...book,done:!book.done}:book);
  }
}
export type Loader = (query:string, signal:AbortSignal)=>Promise<string[]>;
// A deterministic fake I/O source: slow takes 600ms, fast takes 40ms.
// This is a teaching transport, not measured network latency.
export const loadSuggestions:Loader = (query,signal)=>new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return;}
  const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);if(query==='error')reject(new Error('模拟上游失败'));else resolve([`${query} 的阅读建议`]);},query==='slow'?600:40);
  signal.addEventListener('abort',abort,{once:true});
});
type SearchState = {query:string;status:'idle'|'loading'|'success'|'error';items:string[];error:string};
export function useSuggestions(query:string, loader:Loader=loadSuggestions) {
  const [state,setState]=useState<SearchState>({query:'',status:'idle',items:[],error:''});
  useEffect(()=>{
    if(!query){setState({query,status:'idle',items:[],error:''});return;}
    const controller=new AbortController();let active=true;
    setState({query,status:'loading',items:[],error:''});
    loader(query,controller.signal).then(items=>{
      if(active)setState({query,status:'success',items,error:''});
    },error=>{
      if(active)setState({query,status:'error',items:[],error:error instanceof Error?error.message:String(error)});
    });
    return ()=>{active=false;controller.abort();};
  },[query,loader]);
  // An old response can briefly remain in state before the next Effect runs.
  // Never label that old result as belonging to the new query.
  return state.query===query?state:{query,status:query?'loading':'idle',items:[],error:''} as SearchState;
}
export default function App(){
  const [books,dispatch]=useReducer(reducer,initialBooks);
  const [count,setCount]=useState(0);
  const [query,setQuery]=useState('');
  const [message,setMessage]=useState('尚未保存快照');
  const saved=useRef<(()=>number)|null>(null);
  const input=useRef<HTMLInputElement>(null);
  const result=useSuggestions(query);
  const done=books.filter(book=>book.done).length;
  return <main style={{fontFamily:'system-ui',maxWidth:780,margin:'auto',padding:20,lineHeight:1.7}}>
    <h1>阅读清单：Hooks 与交互</h1>
    <p>本例无网络请求。slow / fast 用可取消的定时器模拟不同响应顺序。</p>
    <section><h2>一、状态队列与快照</h2><output aria-label="计数">{count}</output>
      <div><button onClick={()=>{setCount(count+1);setCount(count+1);setCount(count+1);}}>替换三次</button>
      <button onClick={()=>{setCount(n=>n+1);setCount(n=>n+1);setCount(n=>n+1);}}>函数更新三次</button>
      <button onClick={()=>{saved.current=()=>count;setMessage(`已保存 count=${count} 的闭包`);}}>保存快照</button>
      <button onClick={()=>setMessage(saved.current?`旧闭包读到 ${saved.current()}`:'请先保存')}>读取旧闭包</button></div><p role="status">{message}</p>
    </section>
    <section><h2>二、Reducer 与派生数据</h2><p>已读 <output aria-label="已读">{done}</output> / {books.length}</p>
      <ul>{books.map(book=><li key={book.id}><button onClick={()=>dispatch({type:'toggle',id:book.id})}>{book.done?'取消已读':'标记已读'}：{book.title}</button></li>)}</ul>
      <button onClick={()=>dispatch({type:'reset'})}>重置清单</button>
    </section>
    <section><h2>三、请求的生命周期</h2><label>关键词 <input ref={input} value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div><button onClick={()=>setQuery('slow')}>查询 slow</button><button onClick={()=>setQuery('fast')}>查询 fast</button><button onClick={()=>setQuery('error')}>模拟失败</button><button onClick={()=>setQuery('')}>清空查询</button><button onClick={()=>input.current?.focus()}>聚焦输入</button></div>
      <p aria-label="请求状态">{result.status}</p><ul aria-label="建议">{result.items.map(item=><li key={item}>{item}</li>)}</ul>{result.error&&<p role="alert">{result.error}</p>}
      <p>先 slow 再 fast，最终应保持 fast。要验证忽略 AbortSignal 的上游，运行配套契约测试。</p>
    </section>
  </main>;
}
