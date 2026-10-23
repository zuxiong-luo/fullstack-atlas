import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
function Row({id}:{id:string}){
  const [draft,setDraft]=useState('');
  return <li data-row={id}>{id}{' '}<input aria-label={`草稿 ${id}`} value={draft} onChange={e=>setDraft(e.target.value)}/><output aria-label={`内容 ${id}`}>{draft||'空'}</output></li>;
}
function PortalPanel({close,stop,log}:{close:()=>void;stop:boolean;log:(line:string)=>void}){
  const button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    button.current?.focus();
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')close();};
    window.addEventListener('keydown',key);
    return ()=>{window.removeEventListener('keydown',key);previous?.focus();};
  },[close]);
  return createPortal(<div data-backdrop onClick={e=>{if(e.target===e.currentTarget)close();}} style={{border:'2px solid #46735e',padding:20,margin:20}}>
    <section aria-label="Portal 事件面板"><h2>DOM 在 body 下，逻辑上仍属于 App</h2>
      <button ref={button} data-portal-action onClick={event=>{log('button');if(stop)event.stopPropagation();}}>Portal 点击</button>{' '}
      <button onClick={close}>关闭面板</button>
      <p>Escape 可关闭；此面板演示事件与焦点恢复，不实现完整模态焦点圈定。</p>
    </section>
  </div>,document.body);
}
export default function App(){
  const [ids,setIds]=useState(['A','B','C']);const [indexKey,setIndexKey]=useState(false);
  const [epoch,setEpoch]=useState(0);const [open,setOpen]=useState(false);const [stop,setStop]=useState(false);
  const [events,setEvents]=useState<string[]>([]);const [submitted,setSubmitted]=useState(0);
  const [version,setVersion]=useState(0);const [heard,setHeard]=useState(-1);
  useEffect(()=>{
    const ping=()=>setHeard(version);window.addEventListener('atlas-ping',ping);
    return ()=>window.removeEventListener('atlas-ping',ping);
  },[version]);
  // 只用React稳定setter本身作为关闭策略，避免每次更新制造新的订阅依赖。
  const close=useRef(()=>setOpen(false)).current;
  const log=(line:string)=>setEvents(lines=>[...lines,line]);
  const isPortal=(event:React.MouseEvent)=>event.target instanceof Element&&event.target.hasAttribute('data-portal-action');
  return <main data-owner style={{padding:20,fontFamily:'system-ui',lineHeight:1.8,maxWidth:800,margin:'auto'}}
    onClickCapture={event=>{if(isPortal(event))log('owner-capture');}}
    onClick={event=>{if(isPortal(event))log('owner-bubble');}}>
    <h1>节点身份与事件归属</h1><section><h2>身份实验</h2>
      <p>key：{indexKey?'下标':'业务 ID'}</p>
      <button onClick={()=>setIds(xs=>xs.slice(1))}>删除首项</button>{' '}
      <button onClick={()=>{setIndexKey(v=>!v);setIds(['A','B','C']);setEpoch(n=>n+1);}}>切换 key 并重置</button>
      <ul key={epoch}>{ids.map((id,index)=><Row key={indexKey?index:id} id={id}/>)}</ul></section>
    <section><h2>Portal 传播与表单默认行为</h2>
      <button onClick={()=>setOpen(true)}>打开 Portal</button>{' '}
      <label><input type="checkbox" checked={stop} onChange={e=>setStop(e.target.checked)}/>阻止 Portal 冒泡</label>{' '}
      <button onClick={()=>setEvents([])}>清空事件</button><p aria-label="传播记录">{events.join(' → ')||'无'}</p>
      {open&&<PortalPanel close={close} stop={stop} log={log}/>}
      <form onSubmit={event=>{event.preventDefault();setSubmitted(n=>n+1);}}>
        <button type="button">普通按钮</button>{' '}<button type="submit">提交表单</button>
        <output aria-label="提交次数">{submitted}</output>
      </form></section>
    <section><h2>原生订阅的建立和清理</h2><button onClick={()=>setVersion(n=>n+1)}>增加订阅版本</button>{' '}
      <button onClick={()=>window.dispatchEvent(new Event('atlas-ping'))}>发送 ping</button>
      <p>版本 {version}；<output aria-label="监听读数">{heard}</output></p></section>
  </main>;
}
