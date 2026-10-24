export type Item={id:string;weight:number;value:number};
export function validateItems(items:readonly Item[],capacity:number){
 if(!Number.isInteger(capacity)||capacity<0||capacity>2000||items.length>200)throw new RangeError('capacity 0..2000, at most 200 items');const ids=new Set<string>();
 for(let i=0;i<items.length;i++){const x=items[i];if(!Object.hasOwn(items,i)||!x||typeof x.id!=='string'||!x.id||ids.has(x.id)||!Number.isInteger(x.weight)||x.weight<1||x.weight>2000||!Number.isSafeInteger(x.value)||x.value<0||x.value>1_000_000)throw new RangeError('unique IDs, positive weights and bounded values required');ids.add(x.id);}
}
export type SearchEvent={i:number;remaining:number;value:number;action:string;path?:string[]};
export function backtrackKnapsack(items:readonly Item[],capacity:number,observe?:(e:SearchEvent)=>void){
 validateItems(items,capacity);if(items.length>20)throw new RangeError('backtracking demo at most 20 items');const path:string[]=[],best:{value:number;ids:string[]}={value:0,ids:[]};let calls=0;
 function visit(i:number,remaining:number,value:number){if(++calls>250000)throw new RangeError('search call budget exceeded');if(i===items.length){if(value>best.value){best.value=value;best.ids=[...path];}observe?.({i,remaining,value,action:'leaf',path:[...path]});return;}
  visit(i+1,remaining,value);const item=items[i];if(item.weight<=remaining){path.push(item.id);try{visit(i+1,remaining-item.weight,value+item.value);}finally{path.pop();}}
 }
 visit(0,capacity,0);return {...best,calls};
}
export function topDownKnapsack(items:readonly Item[],capacity:number,memoized=true,observe?:(e:SearchEvent)=>void){
 validateItems(items,capacity);if(items.length>100)throw new RangeError('top-down depth budget 100 items');if(!memoized&&items.length>20)throw new RangeError('plain recursion demo at most 20 items');const memo=new Map<string,number>();let calls=0,hits=0,computed=0;
 function value(i:number,c:number):number{if(++calls>250000)throw new RangeError('search call budget exceeded');if(i===items.length)return 0;const key=i+':'+c;if(memoized&&memo.has(key)){hits++;const answer=memo.get(key)!;observe?.({i,remaining:c,value:answer,action:'memo hit'});return answer;}
  const item=items[i],skip=value(i+1,c),take=item.weight<=c?item.value+value(i+1,c-item.weight):-Infinity,answer=Math.max(skip,take);computed++;if(memoized)memo.set(key,answer);observe?.({i,remaining:c,value:answer,action:'computed'});return answer;
 }
 return {value:value(0,capacity),calls,hits,computed,states:memo.size};
}
export function tableKnapsack(items:readonly Item[],capacity:number){
 validateItems(items,capacity);const table=Array.from({length:items.length+1},()=>new Array<number>(capacity+1).fill(0));
 for(let i=1;i<=items.length;i++){const item=items[i-1];for(let c=0;c<=capacity;c++){table[i][c]=table[i-1][c];if(item.weight<=c)table[i][c]=Math.max(table[i][c],item.value+table[i-1][c-item.weight]);}}
 const ids:string[]=[];let c=capacity;for(let i=items.length;i>0;i--)if(table[i][c]!==table[i-1][c]){const item=items[i-1];ids.push(item.id);c-=item.weight;}
 return {value:table[items.length][capacity],ids:ids.reverse(),table};
}
export function compactKnapsack(items:readonly Item[],capacity:number){
 validateItems(items,capacity);const best=new Array<number>(capacity+1).fill(0);for(const item of items)for(let c=capacity;c>=item.weight;c--)best[c]=Math.max(best[c],item.value+best[c-item.weight]);return best[capacity];
}
