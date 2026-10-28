import {pythonCoursePlan,pythonRewritePlanUrl} from '../data/pythonCoursePlan';

export default function PythonCourseReset({withdrawn=false}:{withdrawn?:boolean}) {
 const Heading=withdrawn?'h1':'h2';
 return <section className="answer-card">
  <span className="eyebrow">PYTHON · 重新规划</span>
  <Heading>{withdrawn?'这篇旧文已撤下':'Python 系列正在重新规划'}</Heading>
  <p>旧版九篇已撤下。新版面向有 Node.js／TypeScript 经验的开发者，重点讲 Python 的语法、运行机制和工程差异，再进入 FastAPI。</p>
  <p className="subtle">以下是重写目录，正文尚未发布，不计入文章数量。</p>
  <details><summary>查看重写目录（{pythonCoursePlan.length} 篇规划）</summary>
   <ol>{pythonCoursePlan.map(c=><li key={c.id}><strong>{c.title}</strong><p>{c.outcome}</p></li>)}</ol>
  </details>
  <p><a href={pythonRewritePlanUrl} target="_blank" rel="noreferrer">查看完整规划与验收标准 ↗</a></p>
  {withdrawn&&<a className="button secondary" href="#library">返回专栏</a>}
 </section>;
}
