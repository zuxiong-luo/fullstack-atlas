import {monitorEventLoopDelay,performance,PerformanceObserver} from 'node:perf_hooks';
export function metrics(){
 const histogram=monitorEventLoopDelay({resolution:10});histogram.enable();let baseElu,baseCpu,started,gcObserved=0;
 const gc=[];const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){if(entry.startTime<started)continue;gcObserved++;gc.push({kind:entry.detail.kind,durationMs:entry.duration});if(gc.length>128)gc.shift();}});observer.observe({entryTypes:['gc']});
 const reset=()=>{histogram.reset();baseElu=performance.eventLoopUtilization();baseCpu=process.cpuUsage();started=performance.now();gcObserved=0;gc.length=0;};reset();
 return {reset,snapshot(){const elapsedMs=performance.now()-started,elu=performance.eventLoopUtilization(baseElu),cpu=process.cpuUsage(baseCpu),samples=Number(histogram.count);
  return {elapsedMs,eventLoopUtilization:elu.utilization,eventLoopDelayMs:{samples,mean:samples?histogram.mean/1e6:null,p99:samples?histogram.percentile(99)/1e6:null,max:samples?histogram.max/1e6:null},cpuMicroseconds:cpu,memoryBytes:process.memoryUsage(),gcObserved,gcEvents:[...gc]};
 },close(){histogram.disable();observer.disconnect();}};
}
