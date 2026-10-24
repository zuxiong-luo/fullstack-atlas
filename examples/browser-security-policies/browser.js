const api=document.body.dataset.api,output=document.getElementById('output'),button=document.getElementById('run');
button.addEventListener('click',async()=>{
  button.disabled=true;const results=[];
  const record=(name,result)=>{results.push({name,...result});output.textContent=JSON.stringify(results,null,2);};
  async function probe(name,path,options={}){
    try{const response=await fetch(api+path,options),body=await response.json();record(name,{readable:true,status:response.status,body});return body;}
    catch(error){record(name,{readable:false,error:error.name});return null;}
  }
  try{
    await probe('无CORS响应不能被脚本读取','/no-cors');
    await probe('不带凭据的星号公共响应可以读取','/wildcard');
    await probe('credentials include与星号不兼容','/wildcard',{credentials:'include'});
    await probe('建立仅供本机实验的HttpOnly Cookie','/session',{credentials:'include'});
    record('Cookie按host不按端口隔离；HttpOnly对脚本不可见',{documentCookie:document.cookie,httpOnlyHidden:!document.cookie.split(';').some(s=>s.trim().startsWith('sid=')),visibleCookie:document.cookie.includes('display=visible')});
    await probe('跨源fetch默认不附带同站Cookie','/private');
    await probe('显式include后服务端认证通过','/private',{credentials:'include'});
    const before=await fetch(api+'/metrics').then(r=>r.json());
    await probe('简单POST可发送但响应被CORS挡住','/simple-write',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'example=1'});
    const after=await fetch(api+'/metrics').then(r=>r.json());record('服务端效果不会被读取限制回滚',{simpleWriteDelta:after.simpleWrites-before.simpleWrites});
    await probe('预检拒绝后实际JSON POST不应发送','/json-denied',{method:'POST',headers:{'Content-Type':'application/json','X-Lab':'yes'},body:JSON.stringify({message:'test'})});
    await probe('允许预检与凭据后，实际写入仍独立检查身份','/json-write',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Lab':'yes'},body:JSON.stringify({message:'test'})});
    await probe('最终服务端计数','/metrics');
  }finally{button.disabled=false;}
});
