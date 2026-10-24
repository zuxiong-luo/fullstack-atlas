'use client';
export default function ReportError({error,retry}:{error:unknown;retry:()=>void}){
 const digest=typeof error==='object'&&error!==null&&'digest' in error?String(error.digest):'unavailable';
 return <section role="alert"><h2>报告加载失败</h2><p>诊断编号：{digest}。不会在这里展示内部错误原文。</p><button onClick={()=>retry()}>重新读取并恢复</button><a href="/">回工作台</a></section>;
}
