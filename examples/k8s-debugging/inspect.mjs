// 静态连接检查，只从声明推导明显的selector/端口错误，不冒充K8s控制面或网络实现。
export function inspect(deployment,service){
 const labels=deployment.spec.template.metadata.labels;
 const selected=Object.entries(service.spec.selector).every(([k,v])=>labels[k]===v);
 const ports=deployment.spec.template.spec.containers.flatMap(c=>c.ports||[]);
 const findings=[];
 if(!selected)findings.push('SELECTOR_MISMATCH');
 for(const port of service.spec.ports){
  const target=port.targetPort??port.port;
  if(typeof target==='string'&&!ports.some(p=>p.name===target))findings.push('NAMED_PORT_MISSING');
  // 数字targetPort不要求声明containerPort；声明不等于进程真的监听。
 }
 return findings;
}
