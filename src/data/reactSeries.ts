// Only existing chapters receive links. Planned coverage never creates empty articles.
export const reactSeries = [
 {id:'A',title:'建立正确模型',description:'组件、状态、身份与数据流',articles:['react-foundations','react-state-effects'],pending:'七篇新版第1篇已提供标杆审阅；旧专题暂保留作为补充阅读'},
 {id:'B',title:'可靠交互',description:'Hooks、Effect、事件与竞态',articles:['react-identity-events'],pending:'交互章节待拆分深化'},
 {id:'C',title:'Fiber 与协调',description:'结构、双缓冲、协调与提交',articles:['react-fiber-structure','react-double-buffer','react-work-loop-commit'],pending:'数组协调与树遍历仍需独立深化'},
 {id:'D',title:'更新与调度',description:'队列、Lane、根调度与执行',articles:['react-fiber-scheduling','react-hooks-queue','react-lane-selection','react-root-scheduling'],pending:'Scheduler内部与完整生命周期待补'},
 {id:'E',title:'复用与性能',description:'跳过工作、记忆化与测量',articles:['react-bailout-memo','react-hook-memoization'],pending:'外部store与性能测量待编写'},
 {id:'F',title:'服务端边界',description:'SSR、hydration与框架缓存',articles:[],pending:'待编写；框架章节另行锁定版本'},
 {id:'G',title:'综合工程',description:'带着证据定位与修复问题',articles:[],pending:'待前置系列完成后实施'},
];
