import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
export const records: string[] = [];
function record(message: string) { records.push(message); console.log('[fiber-lab]', message); }
function Row({id}: {id: string}) {
  const [count, setCount] = useState(0);
  const node = useRef<HTMLOutputElement | null>(null);
  const attach = useCallback((element: HTMLOutputElement | null) => {
    node.current = element;
    record(`${id}:ref:${element ? 'attach' : 'detach'}`);
  }, [id]);
  // 仅为教学诊断而记录render，不得将此副作用用作业务逻辑。
  record(`${id}:render:${count}`);
  useLayoutEffect(() => {
    record(`${id}:layout:setup:${count}:DOM=${node.current?.textContent}`);
    return () => record(`${id}:layout:cleanup:${count}`);
  }, [id, count]);
  useEffect(() => {
    record(`${id}:passive:setup:${count}`);
    return () => record(`${id}:passive:cleanup:${count}`);
  }, [id, count]);
  return <li data-row={id} style={{padding:12,border:'1px solid #afc2b7',marginBottom:10}}>
    书籍 {id} · 本地计数 <output ref={attach}>{count}</output>{' '}
    <button onClick={() => { record(`${id}:event:${count}`); setCount(n => n + 1); }}>给 {id} 加一</button>
  </li>;
}
export default function App() {
  const [ids, setIds] = useState(['A','B','C']);
  const [indexKey,setIndexKey] = useState(false);
  const [epoch,setEpoch] = useState(0);
  const [snapshot,setSnapshot] = useState<string[]>([]);
  return <main style={{fontFamily:'system-ui',padding:20,maxWidth:820,margin:'auto',lineHeight:1.7}}>
    <h1>Fiber 与协调：观察状态、DOM 和提交</h1>
    <p>React 18.3.1，无 StrictMode。日志是诊断，render次数不是提交次数。请先清空记录，再做一个操作，最后读取记录。</p>
    <p>当前 key：{indexKey?'下标（故障组）':'业务ID'}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <button onClick={() => setIds(['C','A','B'])}>重排为 C A B</button>
      <button onClick={() => setIds(['A','D','C'])}>改为 A D C</button>
      <button onClick={() => setEpoch(n => n+1)}>更换父级 key</button>
      <button onClick={() => {setIndexKey(v=>!v);setIds(['A','B','C']);setEpoch(n=>n+1);}}>切换 key 并重置</button>
      <button onClick={() => {records.length=0;setSnapshot([]);}}>清空记录</button>
      <button onClick={() => setSnapshot([...records])}>读取记录</button>
    </div>
    <ul key={epoch} style={{listStyle:'none',padding:0}}>{ids.map((id,index)=><Row key={indexKey?index:id} id={id}/>)}</ul>
    <p>“清空/读取记录”也可能引发父组件与行组件计算。只观察目标事件之后的片段，不把日志条数当性能结论。</p>
    <pre aria-label="诊断记录" style={{overflowX:'auto',background:'#edf3ee',padding:12}}>{snapshot.join('\n') || '尚未读取记录'}</pre>
    <p>完整原始诊断也输出到浏览器控制台。实验不读取私有Fiber，不模拟CPU调度，不把Effect与浏览器绘制绑成固定顺序。</p>
  </main>;
}
