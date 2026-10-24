import {Suspense} from 'react';
import {notFound} from 'next/navigation';
import {readReport,state,validId} from '@/lib/gates';
export const dynamic='force-dynamic';
async function Report({id}:{id:string}){
 const report=await readReport(id);
 return <section data-testid="ready"><h2>{report.title}</h2><p>当前报告：{report.id}；实际读取次数：{report.reads}</p></section>;
}
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!validId(id)||!state(id))notFound();
 return <article><h2>报告 {id}</h2><Suspense fallback={<p data-testid="pending">REGION_PENDING · 报告仍在等待</p>}><Report id={id}/></Suspense></article>;
}
