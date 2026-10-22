import React, { createContext, memo, useContext, useLayoutEffect, useRef, useState } from 'react';
const Theme = createContext('light');
// 诊断界面：只在layout effect后更新单独的计数span，不在render中改状态或计数。
function CommitCount({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const count = useRef(0);
  useLayoutEffect(() => { count.current += 1; if (ref.current) ref.current.textContent = String(count.current); });
  return <p>{name} 提交后诊断次数：<span data-count={name} ref={ref}>0</span></p>;
}
function Leaf() {
  const [value, setValue] = useState(0);
  return <div><button data-action="leaf" onClick={() => setValue(n => n + 1)}>子任务进度 +1</button><output data-value="leaf">{value}</output><CommitCount name="leaf"/></div>;
}
const Panel = memo(function Panel({ title }: { title: string }) {
  const [value, setValue] = useState(0);
  const theme = useContext(Theme);
  return <section style={{ border: '1px solid #aac5b6', padding: 14 }}><h2>{title}</h2><p data-value="theme">主题：{theme}</p><button data-action="panel" onClick={() => setValue(n => n + 1)}>面板自己的 state +1</button><output data-value="panel">{value}</output><CommitCount name="panel"/><Leaf/></section>;
});
const ObjectCard = memo(function ObjectCard({ options }: { options: { title: string } }) { return <section><p>对象 prop：{options.title}</p><CommitCount name="object"/></section>; });
function Plain({ title }: { title: string }) { return <section><p>普通组件：{title}</p><CommitCount name="plain"/></section>; }
const UnsafeButton = memo(function UnsafeButton({ label, onClick }: { label: string; onClick: () => void }) { return <button data-action="unsafe" onClick={onClick}>{label}</button>; }, (prev, next) => prev.label === next.label);
const SafeButton = memo(function SafeButton({ label, onClick }: { label: string; onClick: () => void }) { return <button data-action="safe" onClick={onClick}>{label}</button>; });
export default function App() {
  const [tick, setTick] = useState(0);
  const [theme, setTheme] = useState('light');
  const [report, setReport] = useState('尚未读取');
  return <main style={{ fontFamily: 'system-ui', maxWidth: 820, margin: 'auto', padding: 20, lineHeight: 1.7 }}><h1>memo 能跳过谁？</h1><p>React 18.3.1 / createRoot，无 StrictMode。计数来自独立诊断节点的 layout effect，不是全部 render 尝试次数，也不是性能数据。</p><button data-action="parent" onClick={() => setTick(n => n + 1)}>父组件无关更新 +1</button><output data-value="tick">{tick}</output><button data-action="theme" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>切换 Context</button><Theme.Provider value={theme}><Panel title="任务面板"/></Theme.Provider><ObjectCard options={{ title: '任务列表' }}/><Plain title="任务列表"/><h2>错误比较函数会留下旧闭包</h2><UnsafeButton label="错误比较：读取父快照" onClick={() => setReport(`unsafe:${tick}`)}/><SafeButton label="默认比较：读取父快照" onClick={() => setReport(`safe:${tick}`)}/><p data-value="report">{report}</p><p>先点父组件更新，再分别读取。错误比较只看label，忽略函数prop；按钮保留旧onClick。</p></main>;
}
