import { connection } from 'next/server';
import { getCatalog,getRequestCatalog } from '../lib/cache';
export default async function Page(){
 await connection();
 const [catalog,one,two]=await Promise.all([getCatalog(),getRequestCatalog(),getRequestCatalog()]);
 return <><h1>缓存对象实验</h1><p>持久缓存标题：{catalog.title}</p><p>持久缓存读取：{catalog.readId}</p>
 <p>同次渲染读取一：{one.readId}</p><p>同次渲染读取二：{two.readId}</p></>;
}
