'use client';
export default function ErrorPage({reset}:{reset:()=>void}){
 return <main><h1>账户数据暂时不可用</h1><p>服务端会记录错误详情，页面不展示内部堆栈或凭据。</p><button onClick={reset}>重试</button></main>;
}
