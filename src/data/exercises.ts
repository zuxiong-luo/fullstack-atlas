export type Mode='js'|'ts'|'react';
export const exercises: Record<Mode,{title:string;description:string;task:string;code:string}>={
 js:{title:'观察异步执行顺序',description:'先预测结果，再运行验证。这个实验使用浏览器 Worker 环境。',task:'把 Promise 回调替换为 async / await，比较同步日志与微任务的先后顺序。',code:`console.log('1. 同步开始');

setTimeout(() => console.log('4. 定时器任务'), 0);

Promise.resolve().then(() => {
  console.log('3. Promise 微任务');
});

console.log('2. 同步结束');`},
 ts:{title:'用类型表达任务状态',description:'类型检查与运行结果分别展示。尝试访问未收窄的字段，观察诊断。',task:'增加 cancelled 状态，修改 describeTask，并让穷尽检查重新通过。',code:`type Task =
  | { status: 'queued' }
  | { status: 'running'; progress: number }
  | { status: 'completed'; url: string }
  | { status: 'failed'; error: string };

function describeTask(task: Task): string {
  switch (task.status) {
    case 'queued': return '等待执行';
    case 'running': return '进度 ' + task.progress + '%';
    case 'completed': return task.url;
    case 'failed': return task.error;
    default: {
      const exhaustive: never = task;
      return exhaustive;
    }
  }
}

console.log(describeTask({ status: 'running', progress: 42 }));`},
 react:{title:'状态快照，还是连续更新？',description:'实际 React 18 预览。支持 React、react-dom/client、react-dom（createPortal）导入、JSX 与 TSX。',task:'把三个函数式更新改成 setCount(count + 1)，观察按钮点击后的结果。',code:`import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  function increment() {
    setCount(c => c + 1);
    setCount(c => c + 1);
    setCount(c => c + 1);
  }

  return (
    <main style={{ fontFamily: 'system-ui', padding: 32 }}>
      <small style={{ color: '#547f6c' }}>REACT STATE LAB</small>
      <h1>每一次更新，都有迹可循。</h1>
      <p>当前计数：<strong>{count}</strong></p>
      <button onClick={increment} style={{
        padding: '12px 22px', background: '#214d3e',
        color: 'white', border: 0, borderRadius: 8,
        cursor: 'pointer'
      }}>连续更新三次</button>
    </main>
  );
}`}
};
