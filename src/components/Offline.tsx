import {useEffect,useState} from 'react';
import {offlineRegistration,offlineWorker} from '../lib/offlineWorker';
type Snapshot={version:string;bytes:number;savedAt:number;count:number};
async function request(type:string,onProgress?:(n:number,total:number)=>void):Promise<Snapshot|null>{
 if(!('serviceWorker' in navigator))throw new Error('当前浏览器不支持离线缓存，请使用 HTTPS 或本机预览。');
 const registration=await offlineRegistration(navigator.serviceWorker,document.baseURI,type==='DOWNLOAD');
 const worker=await offlineWorker(registration,type==='DOWNLOAD');
 return new Promise((resolve,reject)=>{const channel=new MessageChannel();let timer:ReturnType<typeof setTimeout>;const fail=()=>{channel.port1.close();reject(new Error('下载超时，请检查网络后重试。'))};const arm=()=>{clearTimeout(timer);timer=setTimeout(fail,120000)};arm();channel.port1.onmessage=e=>{arm();if(e.data.progress)onProgress?.(e.data.progress,e.data.total);if(e.data.done||e.data.error){clearTimeout(timer);channel.port1.close();e.data.error?reject(new Error(e.data.error)):resolve(e.data.installed)}};worker.postMessage({type},[channel.port2])});
}
export default function Offline(){const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[progress,setProgress]=useState(0);
 const dev=import.meta.env.DEV;
 useEffect(()=>{if(!dev)request('STATUS').then(setSnapshot).catch(e=>setMessage(e.message))},[dev]);
 async function run(type:string){if(sessionStorage.getItem('atlas:session')!=='luo'){setMessage('请先登录后再使用离线阅读。');return}setBusy(true);setMessage('');setProgress(0);try{if(type==='DOWNLOAD')await navigator.storage?.persist?.();const data=await request(type,(n,total)=>setProgress(Math.round(n/total*100)));setSnapshot(data);setMessage(type==='CLEAR'?'已移除离线内容，笔记与草稿仍保留。':'全部内容已保存。刷新后即可使用此离线版本。')}catch(e){setMessage(e instanceof Error?e.message:'操作失败')}finally{setBusy(false)}}
 return <section className="offline-panel"><div><h2>随时阅读，离线也可以。</h2><p>一键保存本站所有文章、深度研习内容和 JS / TS / React 代码实验资源。</p><p className="subtle small">外部参考链接、评论与邮件需要联网。缓存仅保存在当前浏览器，系统清理空间后可能需要重新下载。</p></div>{dev?<p className="subtle">离线下载在构建预览和正式网站启用；开发页面不缓存，以便即时查看修改。</p>:<><div className="offline-actions"><button className="button primary" disabled={busy} onClick={()=>run('DOWNLOAD')}>{busy?`处理中 ${progress}%`:snapshot?'下载最新离线版本':'一键下载全部内容'}</button>{snapshot&&<button className="button secondary" disabled={busy} onClick={()=>run('CLEAR')}>清除离线内容</button>}</div>{busy&&<progress max={100} value={progress} aria-label="离线下载进度"/>}{snapshot&&<p className="small">已保存 {snapshot.count} 个资源 · {(snapshot.bytes/1024/1024).toFixed(1)} MB · {new Date(snapshot.savedAt).toLocaleString()}</p>}</>}{message&&<p role="status">{message}</p>}</section>
}
