import {useState, useSyncExternalStore} from 'react';

export type Book = Readonly<{id: string; title: string; read: boolean}>;
export type ReadingState = Readonly<{books: readonly Book[]}>;
export type Action = {type: 'toggle'; id: string};
export const initialState: ReadingState = {books: [
  {id: 'fiber', title: 'Fiber 与协调', read: false},
  {id: 'hooks', title: 'Hooks 与交互', read: false},
]};
export function reducer(state: ReadingState, action: Action): ReadingState {
  if (!state.books.some(book => book.id === action.id)) return state;
  return {...state, books: state.books.map(book => book.id === action.id
    ? {...book, read: !book.read} : book)};
}
export function createReadingStore(seed: ReadingState = initialState) {
  let state = seed;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispatch(action: Action) {
      const next = reducer(state, action);
      if (Object.is(next, state)) return;
      state = next;
      [...listeners].forEach(listener => listener());
    },
  };
}
export type QueryState<T> = Readonly<{
  status: 'idle' | 'loading' | 'success' | 'error'; data?: T;
  error?: string; stale: boolean;
}>;
// One cache instance per browser session/root, or per SSR request. No persistence.
export function createQueryCache<T>() {
  type Entry = {snapshot: QueryState<T>; version: number; pending?: Promise<T>};
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  const entry = (key: string): Entry => {
    let value = entries.get(key);
    if (!value) { value = {snapshot: {status: 'idle', stale: true}, version: 0}; entries.set(key, value); }
    return value;
  };
  const publish = (value: Entry, snapshot: QueryState<T>) => {
    value.snapshot = snapshot;
    [...listeners].forEach(listener => listener());
  };
  return {
    getSnapshot: (key: string) => entry(key).snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    invalidate(key: string) {
      const value = entry(key);
      value.version++; value.pending = undefined;
      publish(value, {...value.snapshot, stale: true,
        status: value.snapshot.status === 'loading'
          ? (value.snapshot.data === undefined ? 'idle' : 'success') : value.snapshot.status});
    },
    load(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
      const value = entry(key);
      if (!force && value.pending) return value.pending;
      if (!force && value.snapshot.status === 'success' && !value.snapshot.stale)
        return Promise.resolve(value.snapshot.data as T);
      const version = ++value.version;
      publish(value, {status: 'loading', data: value.snapshot.data, stale: true});
      const pending = Promise.resolve().then(fetcher).then(data => {
        if (version === value.version) publish(value, {status: 'success', data, stale: false});
        return data;
      }, error => {
        if (version === value.version) publish(value, {
          status: 'error', data: value.snapshot.data, stale: true,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }).finally(() => { if (version === value.version) value.pending = undefined; });
      value.pending = pending;
      return pending;
    },
    optimistic(key: string, data: T) {
      const value = entry(key), previous = value.snapshot;
      const version = ++value.version;
      value.pending = undefined; // old reads can finish, but cannot write back
      publish(value, {status: 'success', data, stale: true});
      return {
        rollback() {
          if (value.version !== version) return false;
          value.version++;
          publish(value, {...previous, stale: true,
            status: previous.status === 'loading'
              ? (previous.data === undefined ? 'idle' : 'success') : previous.status});
          return true;
        },
      };
    },
  };
}
const queryKey = JSON.stringify(['reading-summary', 'demo-user', 1]);
export default function App() {
  const [store] = useState(() => createReadingStore());
  const [cache] = useState(() => createQueryCache<string>());
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [message, setMessage] = useState('接口是本地模拟，没有连接服务端。');
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const query = useSyncExternalStore(cache.subscribe, () => cache.getSnapshot(queryKey));
  const readCount = state.books.filter(book => book.read).length;
  const visible = state.books.filter(book => !onlyUnread || !book.read);
  const delay = (value: string, ms: number) => new Promise<string>(resolve => setTimeout(() => resolve(value), ms));
  async function race() {
    setMessage('旧请求 100ms，新请求 20ms；旧请求会最后返回。');
    await Promise.all([
      cache.load(queryKey, () => delay('旧响应', 100), true),
      cache.load(queryKey, () => delay('新响应', 20), true),
    ]);
    setMessage('两个请求都结束：应保留新响应。');
  }
  async function rollback() {
    const mutation = cache.optimistic(queryKey, '乐观修改');
    setMessage('模拟保存中，100ms 后失败。');
    await delay('', 100);
    const reverted = mutation.rollback();
    setMessage(reverted ? '保存失败，已回滚；缓存仍需重新验证。' : '保存失败，但已有较新版本；不覆盖，需重新验证。');
  }
  return <main style={{fontFamily: 'system-ui', maxWidth: 780, padding: 24, margin: 'auto'}}>
    <h1>阅读清单：状态与缓存</h1>
    <p>已读 <output aria-label="已读数">{readCount}</output> / {state.books.length}。统计值来自清单，不单独保存。</p>
    <label><input type="checkbox" checked={onlyUnread} onChange={e => setOnlyUnread(e.target.checked)}/>只看未读（组件状态）</label>
    <ul>{visible.map(book => <li key={book.id}>{book.title}：{book.read ? '已读' : '未读'} <button onClick={() => store.dispatch({type: 'toggle', id: book.id})}>切换 {book.id}</button></li>)}</ul>
    <h2>请求缓存（独立于上面的客户端清单）</h2>
    <p>状态：{query.status}；{query.stale ? '待验证' : '已验证'}</p>
    <output aria-label="服务器摘要">{query.data ?? '尚未请求'}</output>
    <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16}}>
      <button onClick={() => { void cache.load(queryKey, () => delay('服务端初始摘要', 20)).catch(e => setMessage(String(e))); }}>读取摘要</button>
      <button onClick={() => cache.invalidate(queryKey)}>标记过期</button>
      <button onClick={() => { void race(); }}>制造响应乱序</button>
      <button onClick={() => { void rollback(); }}>乐观修改后失败</button>
    </div>
    <p role="status">{message}</p>
    <p>教学缓存只展示按 key 隔离、去重、版本仲裁与条件回滚。无自动重试、过期计时、垃圾回收或持久化；失效后需点击读取。状态操作不会提交数据库。</p>
  </main>;
}
