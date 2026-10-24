'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function Controls(){
  const router=useRouter(),[id,setId]=useState('browser-demo'),[message,setMessage]=useState('先初始化，再释放等待');
  async function act(op:'init'|'release',mode:'ok'|'fail-once'='ok'){
    try{const response=await fetch('/api/gates',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op,id,mode})});const result=await response.json();
      if(!response.ok)throw new Error(result.error);setMessage(JSON.stringify(result.state));if(op==='init')router.push('/reports/'+encodeURIComponent(id));
    }catch(error){setMessage(error instanceof Error?error.message:'操作失败');}
  }
  return <aside><label>实验ID <input value={id} maxLength={40} onChange={e=>setId(e.target.value)}/></label><button onClick={()=>act('init')}>初始化正常等待</button><button onClick={()=>act('init','fail-once')}>初始化一次失败</button><button onClick={()=>act('release')}>释放等待</button><p role="status">{message}</p></aside>;
}
