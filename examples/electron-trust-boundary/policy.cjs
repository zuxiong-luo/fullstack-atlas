const path=require('node:path');
class BoundaryError extends Error{constructor(code,message){super(message);this.code=code;}}
function assertSender(event,win,entryURL){
 if(!win||win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame?.url!==entryURL)throw new BoundaryError('UNAUTHORIZED','当前页面不能调用这个能力');
}
function reportId(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length!==1||typeof payload.reportId!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(payload.reportId))throw new BoundaryError('INVALID_INPUT','报表ID格式错误');
 return payload.reportId;
}
function safeTarget(root,id){
 // 即使调用者漏过一层校验，也不会接受路径片段。
 const name=reportId({reportId:id})+'.csv';
 const target=path.resolve(root,name),relative=path.relative(root,target);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw new BoundaryError('INVALID_PATH','导出路径超出范围');
 return target;
}
function externalURL(value){
 if(typeof value!=='string')throw new BoundaryError('INVALID_URL','链接不可打开');
 let url;try{url=new URL(value);}catch{throw new BoundaryError('INVALID_URL','链接不可打开');}
 if(url.protocol!=='https:'||url.hostname!=='www.electronjs.org'||url.port||url.username||url.password||url.pathname!=='/docs/latest/tutorial/security'||url.search||url.hash)throw new BoundaryError('INVALID_URL','只允许固定的官方安全文档');
 return url.href;
}
module.exports={BoundaryError,assertSender,reportId,safeTarget,externalURL};
