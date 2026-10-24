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
