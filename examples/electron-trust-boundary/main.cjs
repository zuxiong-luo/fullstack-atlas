const {app,BrowserWindow,ipcMain,shell,protocol,net}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {assertSender,externalURL,BoundaryError}=require('./policy.cjs');
const {createExportHandler}=require('./export-service.cjs');
protocol.registerSchemesAsPrivileged([{scheme:'atlas',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const entryURL='atlas://app/index.html';
let win;
const smoke=process.argv.includes('--smoke');
app.whenReady().then(async()=>{
 const assets={'/index.html':'index.html','/renderer.js':'renderer.js','/style.css':'style.css'};
 protocol.handle('atlas',request=>{
  const url=new URL(request.url),file=Object.hasOwn(assets,url.pathname)?assets[url.pathname]:null;
  if(request.method!=='GET'||url.hostname!=='app'||url.username||url.password||url.port||url.search||!file)return new Response('Not found',{status:404});
  return net.fetch(pathToFileURL(path.join(__dirname,file)).href);
 });
 win=new BrowserWindow({width:840,height:680,show:!smoke,webPreferences:{
  preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false,
 }});
 const contents=win.webContents;
 contents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 contents.session.setPermissionCheckHandler(()=>false);
 contents.setWindowOpenHandler(()=>({action:'deny'}));
 contents.on('will-navigate',event=>event.preventDefault());
 contents.on('will-redirect',event=>event.preventDefault());
 contents.on('will-attach-webview',event=>event.preventDefault());
 ipcMain.handle('reports:export',createExportHandler({getWindow:()=>win,entryURL,exportDir:smoke?process.env.ELECTRON_SMOKE_DIR:path.join(app.getPath('userData'),'exports')}));
 ipcMain.handle('reports:help',async event=>{
  try{assertSender(event,win,entryURL);await shell.openExternal(externalURL('https://www.electronjs.org/docs/latest/tutorial/security'));return {ok:true};}
  catch(error){return {ok:false,code:error instanceof BoundaryError?error.code:'OPEN_FAILED',message:'无法打开帮助'};}
 });
 if(!smoke)console.log('Exports directory:',path.join(app.getPath('userData'),'exports'));
 await win.loadURL(entryURL);
 if(smoke)await require('./test/smoke-main.cjs').run({app,win,entryURL});
}).catch(error=>{console.error('[startup failed]',error);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
