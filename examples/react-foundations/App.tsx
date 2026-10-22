import React, { useState } from 'react';
type Book = { id: string; title: string; done: boolean };
const initialBooks = (): Book[] => [
  { id: 'A', title: 'React 基础', done: false },
  { id: 'B', title: 'TypeScript 基础', done: false },
];
function BookRow({ book, onToggle }: { book: Book; onToggle: (id: string) => void }) {
  const [note, setNote] = useState('');
  return <li data-row={book.id} style={{ padding: 12, border: '1px solid #b9c9c0', marginBottom: 12 }}>
    <strong>{book.id} · {book.title}</strong>{' '}
    <button onClick={() => onToggle(book.id)}>{book.done ? '标为未读' : '标为已读'} {book.id}</button>
    <p>状态：<output data-done={book.id}>{book.done ? '已读' : '未读'}</output></p>
    <label>临时笔记 {book.id}<input aria-label={`临时笔记 ${book.id}`} value={note} onChange={e => setNote(e.target.value)} style={{ maxWidth: '100%', boxSizing: 'border-box' }}/></label>
    <p>当前草稿：<output data-note={book.id}>{note || '（空）'}</output></p>
  </li>;
}
function SnapshotCounter() {
  const [count, setCount] = useState(0);
  const [report, setReport] = useState('尚未点击');
  function values() {
    setCount(count + 1); setCount(count + 1); setCount(count + 1);
    setReport(`本次处理函数读取的 count=${count}`);
  }
  function updaters() {
    setCount(n => n + 1); setCount(n => n + 1); setCount(n => n + 1);
    setReport(`本次处理函数读取的 count=${count}`);
  }
  return <section aria-label="快照实验"><h2>状态快照实验</h2>
    <p>计数：<output data-count>{count}</output>；<span data-report>{report}</span></p>
    <button onClick={values}>三次值更新</button>{' '}<button onClick={updaters}>三次函数更新</button>{' '}
    <button onClick={() => { setCount(0); setReport('尚未点击'); }}>重置计数</button>
  </section>;
}
export default function App() {
  const [books, setBooks] = useState(initialBooks);
  const [query, setQuery] = useState('');
  const [byIndex, setByIndex] = useState(false);
  const [generation, setGeneration] = useState(0);
  const visible = books.filter(book => book.title.toLowerCase().includes(query.trim().toLowerCase()));
  const completed = books.filter(book => book.done).length;
  function toggle(id: string) {
    setBooks(previous => previous.map(book => book.id === id ? { ...book, done: !book.done } : book));
  }
  function changeStrategy() {
    setByIndex(value => !value); setBooks(initialBooks()); setQuery(''); setGeneration(n => n + 1);
  }
  return <main style={{ fontFamily: 'system-ui', maxWidth: 760, margin: 'auto', padding: 20, lineHeight: 1.8 }}>
    <h1>阅读清单：数据、状态和身份</h1>
    <p>React 18.3.1；无网络请求，无 StrictMode，不统计性能。刷新后数据重置。</p>
    <label>搜索书名 <input aria-label="搜索书名" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <p data-summary>总共 {books.length} 本，已读 {completed} 本，当前显示 {visible.length} 本。</p>
    <p>当前 key：{byIndex ? '数组下标（故障对照）' : '业务 ID'}</p>
    <button onClick={() => setBooks(previous => [...previous].reverse())}>反转顺序</button>{' '}
    <button onClick={changeStrategy}>切换 key 策略并重置</button>{' '}
    <button onClick={() => setGeneration(n => n + 1)}>只重建列表</button>
    <ul key={generation} style={{ padding: 0, listStyle: 'none' }}>
      {visible.map((book, index) => <BookRow key={byIndex ? index : book.id} book={book} onToggle={toggle} />)}
    </ul>
    <p>临时笔记属于行组件，过滤掉一行会卸载它，重新显示时草稿为空；已读状态属于父组件，仍然保留。真实产品若要保留隐藏后的草稿，应调整数据归属。</p>
    <SnapshotCounter />
  </main>;
}
