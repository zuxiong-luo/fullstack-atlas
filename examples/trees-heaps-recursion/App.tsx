import React, {useState} from 'react';

export type TreeNode={value:number;left:TreeNode|null;right:TreeNode|null};
export function validateTree(root:TreeNode|null){
 const seen=new Set<TreeNode>(),stack=root?[root]:[];
 while(stack.length){const node=stack.pop()!;if(typeof node!=='object'||node===null||!Number.isFinite(node.value)||seen.has(node))throw new TypeError('finite values and a genuine tree required');seen.add(node);if(node.left)stack.push(node.left);if(node.right)stack.push(node.right);}
 return seen.size;
}
export type Visit={value:number;depth:number};
export function traverse(root:TreeNode|null,order:'pre'|'in'|'post'|'level'):Visit[]{
 validateTree(root);if(!['pre','in','post','level'].includes(order))throw new RangeError('unknown traversal');if(!root)return [];
 const out:Visit[]=[];
 if(order==='level'){const q=[{node:root,depth:0}];for(let head=0;head<q.length;head++){const {node,depth}=q[head];out.push({value:node.value,depth});if(node.left)q.push({node:node.left,depth:depth+1});if(node.right)q.push({node:node.right,depth:depth+1});}return out;}
 const stack=[{node:root,depth:0,phase:0}];
 while(stack.length){const f=stack[stack.length-1];
  if(f.phase===0){if(order==='pre')out.push({value:f.node.value,depth:f.depth});f.phase=1;if(f.node.left)stack.push({node:f.node.left,depth:f.depth+1,phase:0});}
  else if(f.phase===1){if(order==='in')out.push({value:f.node.value,depth:f.depth});f.phase=2;if(f.node.right)stack.push({node:f.node.right,depth:f.depth+1,phase:0});}
  else{if(order==='post')out.push({value:f.node.value,depth:f.depth});stack.pop();}
 }
 return out;
}
export function recursivePreorder(root:TreeNode|null,maxDepth=256):number[]{
 validateTree(root);if(!Number.isInteger(maxDepth)||maxDepth<0||maxDepth>256)throw new RangeError('depth budget 0..256');const out:number[]=[];
 function visit(node:TreeNode|null,depth:number){if(!node)return;if(depth>maxDepth)throw new RangeError('teaching recursion depth budget exceeded');out.push(node.value);visit(node.left,depth+1);visit(node.right,depth+1);}
 visit(root,0);return out;
}
export class MinHeap{
 private data:number[];comparisons=0;
 constructor(values:readonly number[]=[]){this.data=Array.from(values);for(const n of this.data)if(!Number.isFinite(n))throw new RangeError('finite priorities required');for(let i=Math.floor(this.data.length/2)-1;i>=0;i--)this.down(i);}
 get size(){return this.data.length;}
 values(){return [...this.data];}
 peek(){return this.data[0];}
 private less(i:number,j:number){this.comparisons++;return this.data[i]<this.data[j];}
 private swap(i:number,j:number){[this.data[i],this.data[j]]=[this.data[j],this.data[i]];}
 private down(i:number){for(;;){let smallest=i;const left=2*i+1,right=left+1;if(left<this.size&&this.less(left,smallest))smallest=left;if(right<this.size&&this.less(right,smallest))smallest=right;if(smallest===i)return;this.swap(i,smallest);i=smallest;}}
 push(value:number){if(!Number.isFinite(value))throw new RangeError('finite priority required');this.data.push(value);let i=this.size-1;while(i>0){const parent=Math.floor((i-1)/2);if(!this.less(i,parent))break;this.swap(i,parent);i=parent;}}
 pop():number|undefined{if(!this.size)return undefined;const value=this.data[0],last=this.data.pop()!;if(this.size){this.data[0]=last;this.down(0);}return value;}
 assertInvariant(){for(let i=1;i<this.size;i++)if(this.data[Math.floor((i-1)/2)]>this.data[i])throw new Error('heap order broken');}
}
export function sampleTree():TreeNode{return {value:4,left:{value:2,left:{value:1,left:null,right:null},right:{value:3,left:null,right:null}},right:{value:7,left:null,right:{value:9,left:null,right:null}}};}

export default function App(){
 const [order,setOrder]=useState<'pre'|'in'|'post'|'level'>('pre'),[index,setIndex]=useState(0),[heap,setHeap]=useState(()=>new MinHeap([7,2,9,1,5,3])),[value,setValue]=useState('4'),[revision,setRevision]=useState(0),[message,setMessage]=useState('堆只保证父≤子，不是完整排序');
 const visits=traverse(sampleTree(),order),nodes=[{x:300,y:45,v:4},{x:150,y:140,v:2},{x:450,y:140,v:7},{x:75,y:235,v:1},{x:225,y:235,v:3},{x:525,y:235,v:9}],current=visits[index];
 function action(pop=false){try{if(pop)setMessage(`弹出 ${String(heap.pop())}`);else{if(heap.size>=31)throw new Error('视图最多31项');if(!value.trim())throw new Error('请输入数值');heap.push(Number(value));setMessage('已插入并上浮');}heap.assertInvariant();setRevision(x=>x+1);}catch(e){setMessage((e as Error).message);}}
 return <main style={{padding:16,maxWidth:960,margin:'auto',fontFamily:'system-ui',color:'#173c2e'}} data-revision={revision}><h1>树的访问顺序与堆的优先级</h1><label>遍历 <select value={order} onChange={e=>{setOrder(e.target.value as typeof order);setIndex(0);}}><option value="pre">先序</option><option value="in">中序</option><option value="post">后序</option><option value="level">层序</option></select></label><button onClick={()=>setIndex(i=>(i+1)%visits.length)}>下一节点</button><p>当前值 {current.value}，深度 {current.depth}；已输出 {visits.slice(0,index+1).map(x=>x.value).join(' → ')}</p><div style={{overflowX:'auto'}}><svg viewBox="0 0 600 280" style={{minWidth:440,width:'100%'}} role="img" aria-label="固定六节点二叉树，当前节点高亮">{[[300,45,150,140],[300,45,450,140],[150,140,75,235],[150,140,225,235],[450,140,525,235]].map((p,i)=><line key={i} x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]} stroke="#567b67"/>)}{nodes.map(n=><g key={n.v}><circle cx={n.x} cy={n.y} r="22" fill={current.value===n.v?'#f7d58c':'#edf5ef'} stroke="#285443"/><text x={n.x} y={n.y+6} textAnchor="middle">{n.v}</text></g>)}</svg></div><h2>最小堆：数组下标就是结构</h2><label>优先级 <input value={value} onChange={e=>setValue(e.target.value)} style={{width:110}}/></label><button onClick={()=>action()}>插入</button><button onClick={()=>action(true)}>弹出最小</button><button onClick={()=>{setHeap(new MinHeap([7,2,9,1,5,3]));setRevision(x=>x+1);setMessage('已重建');}}>重建</button><p role="status">{message}</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{heap.values().map((n,i)=><div key={i} style={{border:'1px solid #285443',padding:10}}><b>{i}: {n}</b><br/>parent={i?Math.floor((i-1)/2):'无'}</div>)}</div><p>size={heap.size}；peek={String(heap.peek())}；累计键比较={heap.comparisons}。点击弹出后重新检查父子关系；数组内容无须整体升序。</p><p>递归预算与深树失败在下载项目 CPU 测试中验证。此视图不测设备速度、不展示假的运行耗时。</p></main>;
}
