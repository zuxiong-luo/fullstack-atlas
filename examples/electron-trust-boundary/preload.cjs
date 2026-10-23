const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('reports',{
 exportReport:reportId=>ipcRenderer.invoke('reports:export',{reportId}),
 openHelp:()=>ipcRenderer.invoke('reports:help'),
});
