import {articles} from '../data/articles';
import {reactSeries} from '../data/reactSeries';
export default function ReactSeriesNav({current}:{current?:string}){
 return <nav className="source-series answer-card react-series-nav" aria-label="React 系列阅读"><strong>React · 从基础到深入</strong><p>按 A → G 逐步阅读。概览与审阅稿会标明状态；下面只链接已有正文。</p>{reactSeries.map(series=>{
 const entries=series.articles.map(id=>articles.find(a=>a.id===id)).filter(a=>a!==undefined);
 return <details key={series.id} open={current?series.articles.includes(current):series.id==='C'}><summary>{series.id} · {series.title}<span className="subtle small"> — {series.description}</span></summary><div className="related-links">{entries.map(a=><a key={a.id} href={'#article/'+a.id} aria-current={a.id===current?'page':undefined}>{a.title}<small> · {a.status==='complete'?'完整文章':a.status==='review'?'审阅稿':'概览 · 待重写'}</small></a>)}</div><p className="subtle small">{series.pending}</p></details>})}</nav>
}
