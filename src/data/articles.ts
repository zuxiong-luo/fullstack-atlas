import {operationsExpansionArticles} from './articles/operations';
import {webglExpansionArticles} from './articles/webgl';
import {algorithmExpansionArticles} from './articles/algorithms';
import {crossPlatformExpansionArticles} from './articles/flutter';
import {taskExpansionArticles} from './articles/tasks';
import {reactHooksInteractionsArticle} from './articles/react-hooks-interactions';
import {reactStateManagementArticle} from './articles/react-state-management';
import {reactConcurrencyArticle} from './articles/react-concurrency';
import {reactPerformanceArticle} from './articles/react-performance';
import {reactModernEngineeringArticle} from './articles/react-modern-engineering';
import {reactFiberReconciliationArticle} from './articles/react-fiber-reconciliation';
import {reactFoundationsArticle} from './articles/react-foundations';
import {reactDoubleBufferArticle} from './articles/react-double-buffer';
import {reactRootSchedulingArticle} from './articles/react-root-scheduling';
import {reactBailoutMemoArticle} from './articles/react-bailout-memo';
import {reactHookMemoizationArticle} from './articles/react-hook-memoization';
import {reactFiberStructureArticle} from './articles/react-fiber-structure';
import {reactWorkLoopArticle} from './articles/react-work-loop-commit';
import {reactHooksQueueArticle} from './articles/react-hooks-queue';
import {reactLaneSelectionArticle} from './articles/react-lane-selection';
import {reactFiberArticle} from './articles/react-fiber-scheduling';
import {agentFoundationsArticle} from './articles/agent-foundations';
import {legacyArticles} from './articles/legacy';
import {sectionBlocks,blockText} from './articleTypes';
import {curriculumRank} from './topicCurricula';
import {nodeExpansionArticles} from './articles/nodejs';
import {dataExpansionArticles} from './articles/data';
import {pythonExpansionArticles} from './articles/python';
import {identityExpansionArticles} from './articles/identity';
import {nextExpansionArticles} from './articles/nextjs';
export type {Article,ArticleSection} from './articleTypes';
export const articleTopics=[
{id:'identity',name:'身份认证与安全',description:'从安全连接到可信身份，厘清每一层的责任。'},
{id:'react',name:'React 核心原理',description:'从状态与闭包，深入 Fiber、调度、Hooks 与事件。'},
{id:'data',name:'数据与并发',description:'从业务不变量理解事务、锁与数据库约束。'},
{id:'tasks',name:'可靠的异步系统',description:'把超时、重复与失联纳入设计，而不是例外。'},
{id:'operations',name:'部署与故障排查',description:'沿请求链路，用证据逐层缩小问题范围。'},
{id:'flutter',name:'跨平台工程',description:'Flutter、React Native 与 Electron 的渲染、通信和交付。'},
{id:'nextjs',name:'Next.js 全栈',description:'理解服务端组件、渲染与缓存边界。'},
{id:'nodejs',name:'Node.js 工程',description:'事件循环、流、背压和服务容量。'},
{id:'python',name:'Python 工程',description:'类型边界、异步任务与服务生命周期。'},
{id:'algorithms',name:'算法与数据结构',description:'用不变量、复杂度和反例推导正确性。'},
{id:'webgl',name:'WebGL 与图形',description:'从坐标变换到 GPU 流水线与帧预算。'},
{id:'ai',name:'AI / Agent 工程',description:'从模型调用到工具、RAG、评测与可靠部署。'}
];

const rewritten = [reactFiberArticle,agentFoundationsArticle];
export const reactSourceArticles = [reactFiberStructureArticle,reactHooksQueueArticle,reactLaneSelectionArticle,reactWorkLoopArticle,reactDoubleBufferArticle,reactRootSchedulingArticle,reactBailoutMemoArticle,reactHookMemoizationArticle];
export const articles = [reactFoundationsArticle,reactHooksInteractionsArticle,reactStateManagementArticle,reactFiberReconciliationArticle,reactConcurrencyArticle,reactPerformanceArticle,reactModernEngineeringArticle,...legacyArticles.map(a=>rewritten.find(r=>r.id===a.id)??a),...reactSourceArticles,...nodeExpansionArticles,...dataExpansionArticles,...pythonExpansionArticles,...identityExpansionArticles,...nextExpansionArticles,...taskExpansionArticles,...crossPlatformExpansionArticles,...algorithmExpansionArticles,...webglExpansionArticles,...operationsExpansionArticles];
export const readingPaths=[
{id:'request',name:'从身份到数据',description:'理解一次请求如何建立信任，再保证数据变更正确。',articleIds:['oauth-login','transactions-locks'],prerequisites:'HTTP 与 SQL 基础'},
{id:'interface',name:'从状态到交互',description:'对照 Web 与 Flutter，理解状态、生命周期与通信。',articleIds:['react-state-effects','flutter-engineering'],prerequisites:'JavaScript / Dart 基础'},
{id:'delivery',name:'从任务到可靠交付',description:'先保证并发正确，再设计恢复，并沿链路定位问题。',articleIds:['transactions-locks','reliable-tasks','k8s-debugging'],prerequisites:'服务端与容器基础'}
];

export function findArticles(query:string,topic='all'){const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);const matches=articles.filter(a=>(topic==='all'||a.topic===topic)&&words.every(w=>[a.title,a.description,...a.tags,...a.sections.flatMap(s=>[s.title,...sectionBlocks(s).map(blockText)])].join(' ').toLocaleLowerCase().includes(w)));return topic==='all'?matches:matches.sort((a,b)=>curriculumRank(topic,a.id)-curriculumRank(topic,b.id));}
