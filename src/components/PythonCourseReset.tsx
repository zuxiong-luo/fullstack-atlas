import {articles} from '../data/articles';
import {pythonCoursePlan,pythonRewritePlanUrl} from '../data/pythonCoursePlan';

export default function PythonCourseReset({withdrawn=false}:{withdrawn?:boolean}) {
 const Heading=withdrawn?'h1':'h2';
 const available=articles.filter(a=>a.topic==='python');
 return <section className="answer-card">
  <span className="eyebrow">PYTHON · 从 Node.js 迁移</span>
  <Heading>{withdrawn?'这篇旧文已撤下':'Python 系列：从 Node.js 经验出发'}</Heading>
  <p>旧版九篇已撤下。新版面向有 Node.js／TypeScript 经验的开发者，重点讲 Python 的语法、运行机制和工程差异，再进入 FastAPI。</p>
  <p className="subtle">新版已发布 {available.length} 篇，其余 {pythonCoursePlan.length-available.length} 篇待编写。规划条目不计入文章数量。</p>
  {available.map(a=><p key={a.id}><a href={'#article/'+a.id}>阅读：{a.title} →</a></p>)}
  <details><summary>查看系列目录（{pythonCoursePlan.length} 篇）</summary>
   <ol>{pythonCoursePlan.map(c=>{const published=available.some(a=>a.id===c.id);return <li key={c.id}>{published?<a href={'#article/'+c.id}><strong>{c.title}</strong> · 已发布</a>:<strong>{c.title} · 待编写</strong>}<p>{c.outcome}</p></li>})}</ol>
  </details>
  <p><a href={pythonRewritePlanUrl} target="_blank" rel="noreferrer">查看完整规划与验收标准 ↗</a></p>
  {withdrawn&&<a className="button secondary" href="#library">返回专栏</a>}
 </section>;
}
