import React, {useState} from 'react';
export function App({data}) {
  const [count, setCount] = useState(data.count);
  return <main><h1>{data.title}</h1><p>请求：{data.requestId}</p>
    <button onClick={() => setCount(n => n + 1)}>计数 {count}</button>
    <nav><a href="/">重新请求页面</a> | <a href="/?mismatch=1">不匹配反例</a> | <a href="/?fail=1">服务端失败</a></nav>
  </main>;
}
