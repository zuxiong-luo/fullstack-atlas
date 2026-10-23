const input=document.querySelector('#report-id'),button=document.querySelector('#export'),status=document.querySelector('#status');
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='正在导出…';
 try{
  const result=await window.reports.exportReport(input.value);
  status.textContent=result.ok?`已导出 ${result.filename}（${result.bytes} 字节）`:`${result.code}：${result.message}`;
 }catch{status.textContent='通信失败，主进程可能已经退出';}
 finally{button.disabled=false;}
});
document.querySelector('#help').addEventListener('click',async()=>{
 try{const result=await window.reports.openHelp();status.textContent=result.ok?'已请求系统浏览器打开固定官方文档':result.message;}catch{status.textContent='无法联系主进程';}
});
