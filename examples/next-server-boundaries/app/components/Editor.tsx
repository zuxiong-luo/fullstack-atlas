'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function Editor({initialNote,canEditCatalog}:{initialNote:string;canEditCatalog:boolean}){
 const router=useRouter();const [note,setNote]=useState(initialNote),[title,setTitle]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(url:string,payload:Record<string,string>){
  setBusy(true);setMessage('');
  try{
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json();if(!response.ok)throw new Error(data.error+(data.requestId?' · '+data.requestId:''));
   setMessage('保存成功，正在读取最新视图');router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'网络不可用，请稍后重试');}
  finally{setBusy(false);}
 }
 return <section><h2>私人笔记</h2><label>笔记 <input value={note} maxLength={80} onChange={e=>setNote(e.target.value)}/></label>{' '}
  <button disabled={busy} onClick={()=>save('/api/note',{note})}>保存自己的笔记</button>
  {canEditCatalog&&<div><h2>公开目录管理</h2><input aria-label="新目录名称" value={title} maxLength={80} onChange={e=>setTitle(e.target.value)}/>{' '}
   <button disabled={busy} onClick={()=>save('/api/catalog',{title})}>保存公开目录</button></div>}
  <p role="status">{message}</p></section>;
}
