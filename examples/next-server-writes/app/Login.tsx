"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function Login(){
 const router=useRouter();const [message,setMessage]=useState('');
 return <form onSubmit={async event=>{
  event.preventDefault();const data=new FormData(event.currentTarget);setMessage('登录中');
  try{
   const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:data.get('user'),password:data.get('password')})});
   if(response.ok){setMessage('已登录');router.refresh();}else{setMessage('登录失败，请检查演示账号和服务端配置');}
  }catch{setMessage('网络失败');}
 }}>
 <label>演示账号<select name="user"><option value="alice">alice</option><option value="bob">bob</option></select></label>
 <label>密码<input name="password" type="password" required autoComplete="current-password"/></label>
 <button>登录</button><p role="status">{message}</p></form>;
}
