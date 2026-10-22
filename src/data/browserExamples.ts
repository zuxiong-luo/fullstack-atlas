import foundations from '../../examples/react-foundations/App.tsx?raw';
import doubleBuffer from '../../examples/react-double-buffer/App.tsx?raw';
import rootScheduling from '../../examples/react-root-scheduling/App.tsx?raw';
import bailoutMemo from '../../examples/react-bailout-memo/App.tsx?raw';
import hookMemo from '../../examples/react-hook-memoization/App.tsx?raw';
import lanes from '../../examples/react-lane-selection/App.tsx?raw';
import hooks from '../../examples/react-hooks-queue/App.tsx?raw';
import workloop from '../../examples/react-work-loop-commit/App.tsx?raw';
import structure from '../../examples/react-fiber-structure/App.tsx?raw';
import scheduling from '../../examples/react-fiber-scheduling/App.tsx?raw';
import type {Mode} from './exercises';
// Populated with benchmark source at integration; each ID has a separate draft key.
export const browserExamples: Record<string,{mode:Mode;articleId:string;title:string;description:string;task:string;code:string}> = {'react-scheduling':{mode:'react',articleId:'react-fiber-scheduling',title:'输入框为什么卡：四种更新方式',description:'同一份列表，比较紧急更新、transition、减少渲染量和同步重计算。',task:'先以普通模式输入，再切换其他模式；观察输入、待处理提示与列表，而不是只看组件日志。',code:scheduling}};

browserExamples['react-fiber-structure']={mode:'react',articleId:'react-fiber-structure',title:'Fiber身份与状态',description:'重排、key与组件类型如何影响状态保留',task:'先给A加一，再交换顺序，对比业务ID与下标key。',code:structure};
browserExamples['react-work-loop-commit']={mode:'react',articleId:'react-work-loop-commit',title:'工作循环与提交观测',description:'区分render、DOM、ref与Effects',task:'依次更新、换key和卸载，观察控制台顺序。',code:workloop};
browserExamples['react-hooks-queue']={mode:'react',articleId:'react-hooks-queue',title:'Hooks更新与重放',description:'真实React与教学模型分开观察',task:'分别重置，比较值更新与函数更新，再逐轮查看重放。',code:hooks};
browserExamples['react-lane-selection']={mode:'react',articleId:'react-lane-selection',title:'Lane选择器',description:'对照固定版本的候选、WIP与纠缠分支',task:'逐个运行预设，再调整一个集合并预测输出。',code:lanes};

browserExamples['react-double-buffer']={mode:'react',articleId:'react-double-buffer',title:'双缓冲逐步推演',description:'观察current与工作节点轮换',task:'准备、完成、提交两轮，再放弃一轮。',code:doubleBuffer};

browserExamples['react-root-scheduling']={mode:'react',articleId:'react-root-scheduling',title:'根回调如何安排',description:'比较Lane与回调复用取消',task:'依次选择同Lane和不同Lane，观察回调记录。',code:rootScheduling};

browserExamples['react-bailout-memo']={mode:'react',articleId:'react-bailout-memo',title:'React.memo与子树更新',description:'真实React的父子更新对照',task:'比较父更新、子state与Context更新。',code:bailoutMemo};

browserExamples['react-hook-memoization']={mode:'react',articleId:'react-hook-memoization',title:'Hook记忆化与旧闭包',description:'对照依赖稳定、失效和缺失',task:'先做无关更新，再切换查询并观察结果。',code:hookMemo};

browserExamples['react-foundations']={mode:'react',articleId:'react-foundations',title:'阅读清单与状态快照',description:'验证组件、数据流、状态和身份',task:'依正文步骤对照业务ID与下标key，再比较两种三次更新。',code:foundations};
