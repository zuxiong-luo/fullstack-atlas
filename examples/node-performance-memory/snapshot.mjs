import {pathToFileURL} from 'node:url';
import {writeHeapSnapshot} from 'node:v8';
import {PerformanceObserver} from 'node:perf_hooks';
import {mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
export function countNamedObjects(raw,name){
 const parsed=JSON.parse(raw),{node_fields:fields,node_types:types}=parsed.snapshot.meta;
 const type=fields.indexOf('type'),label=fields.indexOf('name'),step=fields.length;let count=0;
 for(let i=0;i<parsed.nodes.length;i+=step)if(types[type][parsed.nodes[i+type]]==='object'&&parsed.strings[parsed.nodes[i+label]]===name)count++;
 return count;
}
export function inspectRetentionEdges(raw){
 const p=JSON.parse(raw),m=p.snapshot.meta,nf=m.node_fields,ef=m.edge_fields;
 const nt=nf.indexOf('type'),nn=nf.indexOf('name'),nc=nf.indexOf('edge_count'),et=ef.indexOf('type'),en=ef.indexOf('name_or_index'),to=ef.indexOf('to_node');
 const name=index=>p.strings[p.nodes[index+nn]];
 const visit=fn=>{let edge=0;for(let node=0;node<p.nodes.length;node+=nf.length)for(let k=0;k<p.nodes[node+nc];k++,edge+=ef.length)fn(node,m.edge_types[et][p.edges[edge+et]],p.edges[edge+en],p.edges[edge+to]);};
 let holder=-1,array=-1,owned=false,elements=0;
 visit((from,type,key,target)=>{if(type==='property'&&p.strings[key]==='tag'&&name(target)==='atlas-retention-root')holder=from;});
 visit((from,type,key,target)=>{if(from===holder&&type==='property'&&p.strings[key]==='notes')array=target;if(type==='property'&&p.strings[key]==='__atlasMemoryDemo'&&target===holder)owned=true;});
 visit((from,type,_key,target)=>{if(from===array&&type==='element'&&m.node_types[nt][p.nodes[target+nt]]==='object'&&name(target)==='AtlasNote')elements++;});
 return {globalHolder:owned,noteElements:elements};
}
class AtlasNote{constructor(id){this.id=id;this.payload=new Array(512).fill(id);}}
export async function retentionProbe(directory){
 if(typeof global.gc!=='function')throw new Error('RUN_WITH_EXPOSE_GC');
 await mkdir(directory,{recursive:true});const gc=[],observer=new PerformanceObserver(list=>{for(const e of list.getEntries())gc.push({kind:e.detail.kind,durationMs:e.duration});});observer.observe({entryTypes:['gc']});
 const holder={tag:'atlas-retention-root',notes:[]};globalThis.__atlasMemoryDemo=holder;
 const sample=async name=>{global.gc();await new Promise(setImmediate);const file=writeHeapSnapshot(join(directory,name+'.heapsnapshot'));return {file,memoryBytes:process.memoryUsage()};};
 try{
  const baseline=await sample('baseline');for(let i=0;i<128;i++)holder.notes.push(new AtlasNote(i));
  const retained=await sample('retained');holder.notes.length=0;const released=await sample('released');
  return {baseline,retained,released,gcEvents:gc};
 }finally{delete globalThis.__atlasMemoryDemo;observer.disconnect();}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const result=await retentionProbe(process.argv[2]??'profiles');
 for(const stage of ['baseline','retained','released']){const raw=await readFile(result[stage].file,'utf8');result[stage].atlasNoteCount=countNamedObjects(raw,'AtlasNote');result[stage].ownership=inspectRetentionEdges(raw);}
 console.log(JSON.stringify(result));
}
