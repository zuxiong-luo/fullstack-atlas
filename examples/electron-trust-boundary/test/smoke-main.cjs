const {BrowserWindow,net}=require('electron');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs/promises');
async function run({app,win,entryURL}){
 try{
  const prefs=win.webContents.getLastWebPreferences();assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.sandbox,true);
  const boundary=await win.webContents.executeJavaScript(`({require:typeof require,process:typeof process,api:Object.keys(window.reports).sort()})`);
  assert.equal(boundary.require,'undefined');assert.equal(boundary.process,'undefined');assert.deepEqual(boundary.api,['exportReport','openHelp']);
  await win.webContents.executeJavaScript(`document.querySelector('#export').click()`);
  let status='';for(let i=0;i<100;i++){status=await win.webContents.executeJavaScript(`document.querySelector('#status').textContent`);if(status.startsWith('已导出'))break;await new Promise(resolve=>setTimeout(resolve,20));}
  assert.match(status,/已导出 summary.csv/);assert.match(await fs.readFile(path.join(process.env.ELECTRON_SMOKE_DIR,'summary.csv'),'utf8'),/2026-10,18/);
  assert.equal((await win.webContents.executeJavaScript(`window.reports.exportReport('finance')`)).code,'FORBIDDEN');assert.equal((await win.webContents.executeJavaScript(`window.reports.exportReport('../outside')`)).code,'INVALID_INPUT');assert.equal((await win.webContents.executeJavaScript(`window.reports.exportReport('summary')`)).code,'ALREADY_EXISTS');
  const other=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'../preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  await other.loadURL(entryURL);const denied=await other.webContents.executeJavaScript(`window.reports.exportReport('summary')`);assert.equal(denied.code,'UNAUTHORIZED');other.destroy();
  const count=BrowserWindow.getAllWindows().length;
  await win.webContents.executeJavaScript(`window.open('https://example.com/') === null`);assert.equal(BrowserWindow.getAllWindows().length,count);
  const navigation=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('navigation guard did not fire')),2000);win.webContents.once('will-navigate',()=>{clearTimeout(timer);resolve();});});
  await win.webContents.executeJavaScript(`window.location.assign('https://example.com/')`);await navigation;assert.equal(win.webContents.getURL(),entryURL);
  assert.equal((await net.fetch('atlas://app/policy.cjs')).status,404);
  const screenshot=await win.webContents.capturePage();await fs.writeFile(path.join(process.env.ELECTRON_SMOKE_DIR,'window.png'),screenshot.toPNG());
  console.log('ELECTRON_SMOKE_OK '+JSON.stringify({electron:process.versions.electron,chrome:process.versions.chrome,node:process.versions.node,platform:process.platform,arch:process.arch,boundary,checks:['real sandboxed renderer','isolated bridge','IPC export','forbidden report','path traversal','no overwrite','other webContents denied','popup denied','navigation denied','unmapped asset denied']}));app.exit(0);
 }catch(error){console.error('ELECTRON_SMOKE_FAILED',error);app.exit(1);}
}
module.exports={run};
