export const bridge = `
const format = value => { if(typeof value==='string') return value; if(value instanceof Error)return value.stack||value.message; try{return JSON.stringify(value)??String(value)}catch{return String(value)} };
let sent=0;
const send=(kind,args)=>{if(sent++<200)post({kind,text:args.map(format).join(' ')})};
for(const kind of ['log','info','warn','error']) console[kind]=(...args)=>send(kind,args);
self.addEventListener('error',event=>send('error',[event.message]));
self.addEventListener('unhandledrejection',event=>send('error',[event.reason]));
`;
export function createWorkerSource(code:string){return `const post=data=>self.postMessage(data);${bridge}\n(async()=>{try {\n${code}\n;post({kind:'done',text:'同步代码执行完成；异步输出继续收集，最长 5 秒。'})}catch(error){send('error',[error]);post({kind:'done',text:'运行失败'})}})();`;}
export function createReactDocument(runtime:string,code:string,token:string){
 const esc=(s:string)=>s.replace(/<\/script/gi,'<\\/script');
 return `<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#fff;color:#243c32}button,input{font:inherit}</style></head><body><div id="root"></div><script>const post=data=>parent.postMessage({...data,token:${JSON.stringify(token)}},'*');${esc(bridge)}</script><script>${esc(runtime)}</script><script>try{const exports={};const module={exports};const require=name=>{if(name==='react')return window.React;if(name==='react-dom/client')return window.ReactDOM;throw new Error('本实验只支持 react 和 react-dom/client 导入：'+name)};${esc(code)};const Component=module.exports.default||exports.default;if(!Component)throw new Error('请使用 export default 导出 React 组件');ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));post({kind:'done',text:'React 预览已启动'})}catch(error){send('error',[error])}</script></body></html>`;
}
