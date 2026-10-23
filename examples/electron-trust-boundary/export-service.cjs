const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const {randomUUID}=require('node:crypto');
const path=require('node:path');
const {BoundaryError,assertSender,reportId,safeTarget}=require('./policy.cjs');
// 主进程维护可导出资源和用户权限；renderer提交ID而非文件路径/内容。
const reports={
 summary:{roles:['reader','admin'],text:'month,total\n2026-09,12\n2026-10,18\n'},
 finance:{roles:['admin'],text:'internal-only\nconfidential\n'},
};
function createExportHandler({getWindow,entryURL,exportDir,role='reader'}){
 let busy=false;
 return async(event,payload)=>{
  let ownsSlot=false;
  try{
   const win=getWindow();assertSender(event,win,entryURL);const id=reportId(payload);
   const report=Object.hasOwn(reports,id)?reports[id]:null;if(!report||!report.roles.includes(role))throw new BoundaryError('FORBIDDEN','无权导出此报表');
   if(busy)throw new BoundaryError('BUSY','已有导出正在处理');busy=true;ownsSlot=true;
   await fs.mkdir(exportDir,{recursive:true,mode:0o700});const root=await fs.realpath(exportDir);
   const target=safeTarget(root,id);
   if(win.isDestroyed())throw new BoundaryError('WINDOW_CLOSED','窗口已经关闭');
   // 先完整写临时文件，再用不覆盖的hard link发布最终名字。
   const temp=path.join(root,'.tmp-'+randomUUID());
   let file;
   try{
    file=await fs.open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    try{await file.writeFile(report.text,'utf8');}finally{await file.close();}
    if(win.isDestroyed())throw new BoundaryError('WINDOW_CLOSED','窗口已经关闭');
    try{await fs.link(temp,target);}
    catch(error){if(error.code==='EEXIST'||error.code==='ELOOP')throw new BoundaryError('ALREADY_EXISTS','目标已经存在，示例不会覆盖');throw error;}
   }finally{await fs.unlink(temp).catch(()=>{});}
   return {ok:true,filename:id+'.csv',bytes:Buffer.byteLength(report.text)};
  }catch(error){
   if(error instanceof BoundaryError)return {ok:false,code:error.code,message:error.message};
   console.error('[export failed]',error);return {ok:false,code:'IO_ERROR',message:'导出失败，请检查应用目录权限'};
  }finally{if(ownsSlot)busy=false;}
 };
}
module.exports={createExportHandler};
