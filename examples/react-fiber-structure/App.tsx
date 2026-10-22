import React, {useState} from 'react';
type Item={id:string};
function Counter({id}:{id:string}) {
 const [count,setCount]=useState(0);
 return <p data-row={id}>{id} 的局部状态：<output>{count}</output> <button onClick={()=>setCount(n=>n+1)}>给 {id} 加一</button></p>;
}
function OtherCounter({id}:{id:string}) {
 const [count,setCount]=useState(0);
 return <p data-row={id}>{id} 的局部状态：<output>{count}</output> <button onClick={()=>setCount(n=>n+1)}>给 {id} 加一</button></p>;
}
export default function App(){
 const [items,setItems]=useState<Item[]>([{id:'A'},{id:'B'}]);
 const [byIndex,setByIndex]=useState(false);
 const [epoch,setEpoch]=useState(0);
 const [other,setOther]=useState(false);
 const Row=other?OtherCounter:Counter;
 return <main style={{padding:20,fontFamily:'system-ui',maxWidth:700,margin:'auto'}}>
  <h2>状态究竟跟着位置，还是跟着业务对象？</h2>
  <p>先给 A 加一，再交换顺序。切换 key 策略会主动重置整组实验，避免上一次的状态干扰比较。</p>
  <button onClick={()=>{setByIndex(x=>!x);setEpoch(n=>n+1);setItems([{id:'A'},{id:'B'}])}}>切换 key 策略</button>
  <p role="status">当前 key：{byIndex?'数组下标':'业务 ID'}；组件类型：{other?'OtherCounter':'Counter'}；重置版本：{epoch}</p>
  <button onClick={()=>setItems(xs=>[...xs].reverse())}>交换 A / B</button>{' '}
  <button onClick={()=>setEpoch(n=>n+1)}>更换父级 key</button>{' '}
  <button onClick={()=>setOther(x=>!x)}>更换组件类型</button>
  <section key={epoch} style={{border:'1px solid #9aaa9e',padding:16,marginTop:20}}>
   {items.map((item,index)=><Row key={byIndex?index:item.id} id={item.id}/>)}
  </section>
  <p>此实验观察 React 18.3.1 的公开行为，不读取 DOM 的私有 Fiber 字段；两种组件输出相同标签，但函数对象不同。</p>
 </main>;
}
