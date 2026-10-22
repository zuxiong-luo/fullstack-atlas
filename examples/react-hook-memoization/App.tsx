import React, { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
export const TASKS = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, title: `任务 ${i + 1}` }));
export function calculate(tasks: typeof TASKS, query: string) {
  let checksum = 0;
  for (const task of tasks) for (let j = 0; j < 4000; j++) checksum = (checksum + ((task.id * 31 + j) % 97)) % 1000003;
  return { rows: tasks.filter(t => t.title.includes(query)), checksum };
}
function Identity({ value, name }: { value: unknown; name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef<unknown>(undefined);
  const changes = useRef(0);
  useLayoutEffect(() => { if (!Object.is(previous.current, value)) changes.current += 1; previous.current = value; if (ref.current) ref.current.textContent = String(changes.current); });
  return <p>已提交的 {name} 引用变化：<span data-identity={name} ref={ref}>0</span></p>;
}
const ChildButton = memo(function ChildButton({ onClick, name }: { onClick: () => void; name: string }) {
  return <div><button data-action={name} onClick={onClick}>{name}：读取 query</button><Identity value={onClick} name={name}/></div>;
});
export function Board({ query, tick }: { query: string; tick: number }) {
  const [report, setReport] = useState('尚未读取');
  const correct = useMemo(() => calculate(TASKS, query), [query]);
  // 故障组1：遗漏query。请勿复制到业务代码。
  const stale = useMemo(() => calculate(TASKS, query), []);
  const options = { query };
  const unstable = useMemo(() => calculate(TASKS, options.query), [options]);
  const uncached = calculate(TASKS, query);
  const callback = useCallback(() => setReport(`correct:${query}`), [query]);
  // 故障组2：函数身份稳定，读取的却是挂载时快照。
  const staleCallback = useCallback(() => setReport(`stale:${query}`), []);
  // 该函数会随Board执行重新创建；它不一定是问题。
  const inline = () => setReport(`inline:${query}`);
  return <section><p>无关更新 tick={tick}</p><p data-result="correct">正确缓存：{correct.rows.length}</p><p data-result="stale">遗漏依赖：{stale.rows.length}</p><p data-result="uncached">不缓存：{uncached.rows.length}</p><Identity name="correct" value={correct}/><Identity name="unstable" value={unstable}/><Identity name="uncached" value={uncached}/><ChildButton name="callback" onClick={callback}/><ChildButton name="stale-callback" onClick={staleCallback}/><ChildButton name="inline" onClick={inline}/><p data-result="report">{report}</p></section>;
}
export default function App() {
  const [query, setQuery] = useState('1');
  const [tick, setTick] = useState(0);
  const [generation, setGeneration] = useState(0);
  return <main style={{ fontFamily: 'system-ui', maxWidth: 820, padding: 20, margin: 'auto', lineHeight: 1.7 }}><h1>Hook 记忆化保存了什么？</h1><p>真实 React 18.3.1，无 StrictMode。诊断只观察已提交结果的引用变化，不统计被放弃计算，也不报告性能收益。</p><label>筛选 <input aria-label="筛选" value={query} onChange={e => setQuery(e.target.value)}/></label><button data-action="query" onClick={() => setQuery(q => q === '1' ? '6' : '1')}>切换1/6</button><button data-action="unrelated" onClick={() => setTick(n => n + 1)}>无关更新</button><button data-action="remount" onClick={() => setGeneration(n => n + 1)}>换 key 重挂载</button><Board key={generation} query={query} tick={tick}/><p>遗漏依赖两组故意错误。换key后它们重新捕获当前query，不等于错误已经修复。</p></main>;
}
