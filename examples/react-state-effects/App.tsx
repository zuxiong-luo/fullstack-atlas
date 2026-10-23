import {useEffect,useState} from 'react';
export type Pending={id:number;query:string;aborted:boolean;resolve:(value:string[])=>void;reject:(error:Error)=>void};
export function createTransport(){
  const requests:Pending[]=[];
  function load(query:string,signal:AbortSignal){
    return new Promise<string[]>((resolve,reject)=>{
      const entry:Pending={id:requests.length+1,query,aborted:signal.aborted,resolve,reject};
      requests.push(entry);
      const abort=()=>{entry.aborted=true;};
      signal.addEventListener('abort',abort,{once:true});
      // 教学传输故意允许取消后仍完成：用来验证写入资格，不能当作真实 fetch。
      entry.resolve=value=>{signal.removeEventListener('abort',abort);resolve(value);};
      entry.reject=error=>{signal.removeEventListener('abort',abort);reject(error);};
    });
  }
  return {requests,load};
}
export type Transport=ReturnType<typeof createTransport>;
type Result={query:string;status:'idle'|'loading'|'success'|'error';items:string[];error:string};
export function useSearch(query:string,load:Transport['load']){
  const [result,setResult]=useState<Result>({query:'',status:'idle',items:[],error:''});
  useEffect(()=>{
    if(!query){setResult({query,status:'idle',items:[],error:''});return;}
    let active=true;const controller=new AbortController();
    setResult({query,status:'loading',items:[],error:''});
    load(query,controller.signal).then(
      items=>{if(active)setResult({query,status:'success',items,error:''});},
      error=>{if(active)setResult({query,status:'error',items:[],error:String(error.message||error)});}
    );
    return ()=>{active=false;controller.abort();};
  },[query,load]);
  // 提交新query到新Effect建立前，旧state不能冒充新query的结果。
  return result.query===query?result:{query,status:query?'loading':'idle',items:[],error:''} as Result;
}
export default function App(){
  const [transport]=useState(createTransport);
  const [query,setQuery]=useState('');const [count,setCount]=useState(0);
  const [captured,setCaptured]=useState<(()=>number)|null>(null);
  const [report,setReport]=useState('尚未保存');
  const [,refresh]=useState(0);const result=useSearch(query,transport.load);
  return <main style={{padding:20,fontFamily:'system-ui',lineHeight:1.8,maxWidth:800,margin:'auto'}}>
    <h1>状态快照与请求归属</h1>
    <section><h2>闭包何时建立</h2><output aria-label="当前计数">{count}</output>{' '}
      <button onClick={()=>setCount(n=>n+1)}>加一</button>{' '}
      <button onClick={()=>{setCaptured(()=>()=>count);setReport(`保存了 ${count}`);}}>保存闭包</button>{' '}
      <button onClick={()=>setReport(captured?`闭包读到 ${captured()}`:'请先保存')}>读取闭包</button>
      <p aria-label="闭包记录">{report}</p></section>
    <section><h2>手动控制响应顺序</h2>
      <p>没有网络。取消只标记请求，仍可手动完成旧请求，模拟不配合取消的上游。</p>
      <button onClick={()=>setQuery('A')}>查询 A</button>{' '}
      <button onClick={()=>setQuery('B')}>查询 B</button>{' '}
      <button onClick={()=>setQuery('')}>清空查询</button>
      <p>当前关键词：<output aria-label="当前查询">{query||'空'}</output></p>
      <p aria-label="查询状态">{result.status}</p>
      <p aria-label="查询结果">{result.items.join(',')||'无结果'}</p>
      {result.error&&<p role="alert">{result.error}</p>}
      <button onClick={()=>refresh(n=>n+1)}>查看请求表</button>
      <ol>{transport.requests.map(r=><li key={r.id}>
        请求 {r.id} / {r.query} / {r.aborted?'已收到取消信号':'未取消'}{' '}
        <button onClick={()=>{r.resolve([`${r.query}结果`]);refresh(n=>n+1);}}>完成 {r.id}</button>{' '}
        <button onClick={()=>{r.reject(new Error(`${r.query}失败`));refresh(n=>n+1);}}>失败 {r.id}</button>
      </li>)}</ol>
    </section>
  </main>;
}
