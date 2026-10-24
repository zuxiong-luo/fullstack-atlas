"use client";
import { useState } from 'react';
export default function Counter() {
  const [count,setCount]=useState(0);
  return <button onClick={()=>setCount(value=>value+1)}>布局计数：{count}</button>;
}
