import React,{useState} from 'react';
export type Lane=0|1|4|16|64|128;
export type Task={id:number;priority:string;cancelled:boolean};
export type RootModel={priority:Lane;node:number|null;nextId:number;tasks:Task[];syncCount:number;microtasks:number;trace:string[]};
export const empty=():RootModel=>({priority:0,node:null,nextId:1,tasks:[],syncCount:0,microtasks:0,trace:[]});
export const names:Record<Lane,string>={0:'无可选工作',1:'Sync',4:'Continuous',16:'Default',64:'Transition A',128:'Transition B'};
// 教学根安排模型：输入是已经选定集合的最高 Lane。未实现 Lane 选择或 Scheduler。
export function ensure(previous:RootModel,next:Lane):RootModel{
 const state:RootModel={...previous,tasks:previous.tasks.map(x=>({...x})),trace:[...previous.trace,`检查已选工作：${names[next]}`]};
 function cancel(){if(state.node!==null){const task=state.tasks.find(x=>x.id===state.node);if(task)task.cancelled=true;state.trace.push(`取消 Scheduler callback #${state.node}；更新记录不被删除`);}}
 if(next===0){cancel();state.node=null;state.priority=0;state.trace.push('清空根的 callback 字段；已排入的 Sync 微任务不可在此取消');return state;}
 if(state.priority===next){state.trace.push(`Lane 优先级相同，复用安排（node=${state.node??'null'}）`);return state;}
 cancel();
 if(next===1){state.syncCount++;state.microtasks++;state.node=null;state.trace.push('加入 React Sync 内部队列；安排一次 flush 微任务；callbackNode=null');}
 else{const priority=next===4?'UserBlocking':'Normal';const id=state.nextId++;state.tasks.push({id,priority,cancelled:false});state.node=id;state.trace.push(`创建 Scheduler ${priority} callback #${id}`);}
 state.priority=next;return state;
}
export default function App(){
 const [state,setState]=useState<RootModel>(empty);
 return <main style={{fontFamily:'system-ui',maxWidth:880,margin:'auto',padding:20,lineHeight:1.75}}><h2>根已经选好工作，回调该复用还是重排？</h2><p>这是确定性安排模型，不运行 React 内部 Scheduler。按钮直接指定 getNextLanes 之后的最高 Lane；不模拟任务看板的真实输入，也不测绘制。</p><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{([64,16,4,1,0] as Lane[]).map(l=><button key={l} onClick={()=>setState(s=>ensure(s,l))}>检查 {names[l]}</button>)}<button onClick={()=>setState(empty())}>重置模型</button></div><section aria-live="polite"><h3>根上的安排</h3><p>callbackPriority：{names[state.priority]} / {state.priority}；callbackNode：{state.node===null?'null':`#${state.node}`}</p><p>Sync 队列累计入队 {state.syncCount} 次；待展示的 flush 微任务累计 {state.microtasks} 次。</p><p>模型不执行或清空这两个队列。null 句柄不代表没有已排入的 Sync 工作。</p><h3>Scheduler 回调记录</h3><ul>{state.tasks.map(t=><li key={t.id}>#{t.id} {t.priority}：{t.cancelled?'已取消（不删除更新）':'已安排，尚未执行'}</li>)}</ul><h3>决策轨迹</h3><ol>{state.trace.map((line,i)=><li key={i}>{line}</li>)}</ol></section><p>建议顺序：Transition → Transition → Default → Sync → Sync → 无工作。Default 与 Transition 都映射 Normal，但 Lane 不同，所以不会仅凭 Scheduler 类别复用。</p><p>本例把 WIP、挂起、过期、纠缠、act、LegacyRoot、真实宿主队列及执行后的 continuation 全部留给源码解释；不是完整 React 实现。</p></main>;
}
