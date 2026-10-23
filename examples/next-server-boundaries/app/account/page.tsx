import {requireUser,RequestFailure} from '@/lib/auth';
import {readAccount} from '@/lib/store';
import {getCatalog} from '@/lib/catalog';
import Editor from '../components/Editor';
import {redirect} from 'next/navigation';
export default async function AccountPage(){
 let id;
 try{id=await requireUser();}catch(error){if(error instanceof RequestFailure&&error.status===401)redirect('/');throw error;}
 const [account,catalog]=await Promise.all([readAccount(id),getCatalog()]);
 return <main><h1>{account.displayName} 的账户</h1><p>当前私人笔记：{account.note}</p>
  <h2>公开内容：{catalog.title}</h2><p>目录版本 {catalog.revision} · 来源读取标识 {catalog.readId}</p>
  <Editor key={account.id} initialNote={account.note} canEditCatalog={id==='alice'}/>
 </main>;
}
