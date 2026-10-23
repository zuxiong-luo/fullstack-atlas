'use client';
import {useState} from 'react';
export default function Login(){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function enter(user:'alice'|'bob'){
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user})});
   const data=await response.json();if(!response.ok)throw new Error(data.error);
   window.location.assign('/account');
  }catch(error){setMessage(error instanceof Error?error.message:'网络错误');setBusy(false);}
 }
 return <section><p>这是本地账号切换器，任何访客都可选择两个演示账号。它没有验证真实身份。</p>
  <button disabled={busy} onClick={()=>enter('alice')}>使用 Alice</button>{' '}
  <button disabled={busy} onClick={()=>enter('bob')}>使用 Bob</button><p role="status">{message}</p>
 </section>;
}
