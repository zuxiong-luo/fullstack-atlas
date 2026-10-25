const PREFIX='atlas-offline:'+self.registration.scope;
const META=new URL('./offline-ready',self.registration.scope).href;
let busy=false;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function installed(){const keys=(await caches.keys()).filter(k=>k.startsWith(PREFIX));const result=[];for(const k of keys){const c=await caches.open(k);const marker=await c.match(META);if(marker)result.push({key:k,cache:c,meta:await marker.json()})}return result.sort((a,b)=>b.meta.savedAt-a.meta.savedAt)}
self.addEventListener('message',event=>{const port=event.ports[0];if(!port)return;const reply=data=>port.postMessage(data);event.waitUntil((async()=>{let acquired=false;try{
 if(event.data.type==='STATUS'){const list=await installed();reply({done:true,installed:list[0]?.meta||null});return}
 if(busy)throw new Error('已有缓存操作正在进行，请稍后再试。');
 busy=true;acquired=true;
 if(event.data.type==='CLEAR'){for(const key of await caches.keys())if(key.startsWith(PREFIX))await caches.delete(key);reply({done:true,installed:null});return}
 if(event.data.type!=='DOWNLOAD')throw new Error('未知操作');
 const response=await fetch(new URL('./offline-manifest.json',self.registration.scope),{cache:'no-store'});if(!response.ok)throw new Error('无法获取离线清单');const manifest=await response.json();
 if(!Array.isArray(manifest.files)||!manifest.files.length||typeof manifest.version!=='string')throw new Error('离线清单无效');
 const key=PREFIX+manifest.version+':'+Date.now();const cache=await caches.open(key);
 try{for(let i=0;i<manifest.files.length;i++){const url=new URL(manifest.files[i],self.registration.scope);if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))throw new Error('离线资源越界');const r=await fetch(url,{cache:'no-store'});if(!r.ok||r.type==='opaque')throw new Error('下载失败：'+url.pathname);await cache.put(url,r);reply({progress:i+1,total:manifest.files.length})}const meta={version:manifest.version,bytes:manifest.bytes,savedAt:Date.now(),count:manifest.files.length};await cache.put(META,new Response(JSON.stringify(meta)));reply({done:true,installed:meta});}catch(e){await caches.delete(key);throw e}
 // Keep one previous complete version for already-open tabs.
 const complete=await installed();for(const old of complete.slice(2))await caches.delete(old.key);
 }catch(e){reply({error:e.message||'离线操作失败'})}finally{if(acquired)busy=false}})())});
self.addEventListener('fetch',event=>{const request=event.request;const url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope)||url.pathname.endsWith('/sw.js')||url.pathname.endsWith('/offline-manifest.json'))return;
 event.respondWith((async()=>{const list=await installed();const shell=new URL('./index.html',self.registration.scope);
 const appNavigation=request.mode==='navigate'&&(url.pathname===new URL(self.registration.scope).pathname||url.pathname===shell.pathname);
 // Match the actual resource first: downloads and standalone HTML are navigations too.
 // Only this hash-router application's entry may fall back to its shell.
 for(const item of list){const hit=await item.cache.match(request,{ignoreVary:true})||(appNavigation?await item.cache.match(shell.href,{ignoreVary:true}):null);if(hit)return hit}return fetch(request)})());
});
