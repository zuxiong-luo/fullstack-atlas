import {ArrowRight} from 'lucide-react';
import {articles} from '../data/articles';
import {agentChapters,aiCourseChapters} from '../data/series';

type Chapter = (typeof aiCourseChapters)[number];
function Chapters({chapters,start=0}:{chapters:Chapter[];start?:number}){
 return <div className="agent-chapters">{chapters.map((chapter,index)=>{
  const article=articles.find(a=>a.id===chapter.id);
  if(!article)return null;
  return <a className="agent-chapter" key={article.id} href={'#article/'+article.id}>
   <span className="chapter-number">{String(start+index+1).padStart(2,'0')}</span>
   <div><span className="eyebrow">{chapter.stage} · {article.status==='overview'?'概览 · 待完善':article.status==='review'?'审阅稿':'完整章节'} · 约 {article.minutes} 分钟</span>
    <h2>{article.title}</h2><p>{article.description}</p><p className="chapter-outcome">本章目标：{chapter.outcome}</p>
   </div><ArrowRight size={20}/>
  </a>;
 })}</div>;
}
export default function AgentColumn(){return <>
 <div className="page-intro"><div><span className="eyebrow">AI / AGENT ENGINEERING</span><h1>把模型能力，变成可靠的产品。</h1><p>先建立概念，再逐步完成可验证的应用和工程实作。</p></div><span className="pill">公开专栏</span></div>
 <section className="agent-intro"><h2>从应用入门，到可靠 Agent</h2><p>会写 Web 服务，就可以从前三篇开始：认识模型和上下文，建立 Prompt 契约，再把资料变成可追溯的知识。后三篇补框架恢复、流式界面和受限数据查询。原八章继续深入工具、MCP、记忆、评测、安全和交付。</p>
 <div className="agent-prereqs"><a href="#article/python-language-foundations">补齐 Python 基础 ↗</a><a href="#article/node-execution-model">复习 Node.js 执行模型 ↗</a><a href="#article/reliable-tasks">复习可靠任务系统 ↗</a></div>
 <p className="subtle small">正文公开阅读，研习与个人笔记登录后使用。示例在本地运行，默认无需模型密钥；真实模型调用与效果的验证范围在各篇说明。</p></section>
 <section className="agent-intro"><h2>应用入门：先把输入、输出和资料讲清楚</h2><p>补充系列第 1～3 篇。逐篇建立前置概念，每篇都有独立入口和失败用例。</p></section>
 <Chapters chapters={aiCourseChapters.slice(0,3)}/>
 <section className="agent-intro"><h2>进阶实作：让任务、界面和数据有边界</h2><p>补充系列第 4～6 篇。沿用内部知识与工单助手的领域，各模块分别验证，避免把教学实验当成已上线的平台。</p></section>
 <Chapters chapters={aiCourseChapters.slice(3)} start={3}/>
 <section className="agent-intro"><h2>Agent 工程：原有八章连续项目</h2><p>以双语言知识库助手继续深入。原章节顺序与阅读记录保留；新实作与原项目的范围和运行说明分别标明。</p></section>
 <Chapters chapters={agentChapters}/>
 <section className="agent-intro"><h2>把学到的边界串成一个作品</h2><p>用固定样本验证正常、拒绝和恢复路径，记录失败原因、执行轨迹与真实用量，再决定是否增加模型规划、多 Agent 或更多工具。工程测试、真实模型效果和生产容量分别验收。</p></section>
 </>}
