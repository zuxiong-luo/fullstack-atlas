import {useState} from 'react';
import type {Article} from '../data/articleTypes';
import {exampleArchive,saveExampleArchive} from '../lib/exampleDownload';
export default function ExampleDownloads({examples}:{examples:NonNullable<Article['examples']>}){
 const [pending,setPending]=useState<string|null>(null),[error,setError]=useState('');
 async function download(event:React.MouseEvent<HTMLAnchorElement>,path:string){
  if(!path.endsWith('.zip')||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();if(pending)return;setPending(path);setError('');
  try{saveExampleArchive(await exampleArchive(`${import.meta.env.BASE_URL}downloads/${path}`),path.split('/').pop()!)}
  catch(cause){setError(cause instanceof Error?cause.message:'下载失败，请联网更新离线包后重试。')}
  finally{setPending(null)}
 }
 return <><div className="related-links">{examples.map(e=><a key={e.path} href={`${import.meta.env.BASE_URL}downloads/${e.path}`} download={e.path.endsWith('.zip')?e.path.split('/').pop():undefined} target={e.path.endsWith('.zip')?undefined:'_blank'} rel="noreferrer" aria-busy={pending===e.path} onClick={event=>void download(event,e.path)}>{e.label} ↗</a>)}</div>{pending&&<p role="status">正在准备源码下载…</p>}{error&&<p role="alert">{error}</p>}</>;
}
