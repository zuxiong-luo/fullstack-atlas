import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import fs from 'node:fs';
import {articles,findArticles} from '../data/articles';
import {sectionBlocks} from '../data/articleTypes';
import {PublicArticle} from '../components/Articles';
import ArticleBlocks from '../components/ArticleBlocks';
import {pythonChapters} from '../data/series';
import {browserExamples} from '../data/browserExamples';
import Playground from '../components/Playground';
it('renders interleaved prose, local figures and executable entries with stable identities',()=>{
 for(const a of articles){
  const id=a.id;const html=renderToStaticMarkup(<PublicArticle article={a} unlocked={false}/>);
  for(const s of a.sections){expect(html).toContain('section-'+s.id);for(const b of sectionBlocks(s)){
   if(b.type==='figure'){expect(fs.existsSync('public/'+b.src)).toBe(true);expect(html).toContain(b.alt);expect(html).toContain('<img');}
   if(b.type==='experiment'){expect(browserExamples[b.id]).toBeDefined();expect(html).toContain('#lab/example/'+b.id)}
  }}
  expect(html).not.toContain('href="#q/');if(a.questionIds.length)expect(html).toContain('#study/'+id);else expect(html).toContain('配套研习问题正在整理');
 }
 expect(findArticles('UNSUPPORTED_CITATION').some(a=>a.id==='agent-foundations')).toBe(true);
 expect(findArticles('current workInProgress').some(a=>a.id==='react-fiber-scheduling')).toBe(true);
});
it('keeps example drafts separate from the existing React scratchpad',()=>{
 const drafts={react:'ORIGINAL_MODE_DRAFT','example:react-scheduling':'EXAMPLE_ONLY_DRAFT'};
 const example=renderToStaticMarkup(<Playground exampleId="react-scheduling" drafts={drafts} onSave={()=>{}}/>);
 expect(example).toContain('EXAMPLE_ONLY_DRAFT');expect(example).not.toContain('ORIGINAL_MODE_DRAFT');
 const normal=renderToStaticMarkup(<Playground initialMode="react" drafts={drafts} onSave={()=>{}}/>);
 expect(normal).toContain('ORIGINAL_MODE_DRAFT');expect(normal).not.toContain('EXAMPLE_ONLY_DRAFT');
});
it('adapts legacy prose in order without silently dropping its code or takeaway',()=>{
 const blocks=sectionBlocks({id:'legacy',title:'旧文',paragraphs:['前文'],code:'console.log(1)',takeaway:'结论'});
 expect(blocks.map(b=>b.type)).toEqual(['paragraph','code','callout']);
});

it('keeps the chapter contents but removes the old A–G series navigation',()=>{
 const a=articles.find(a=>a.id==='react-fiber-reconciliation')!;
 const html=renderToStaticMarkup(<PublicArticle article={a} unlocked={false}/>);
 expect(html).not.toContain('按 A');
 expect(html).not.toContain('React · 从基础到深入');
 expect(html).toContain('section-concept');
});

it('keeps beginner output separate from executable code and links all Python chapters in order',()=>{
 const output=renderToStaticMarkup(<ArticleBlocks blocks={[{type:'code',language:'text',kind:'excerpt',purpose:'程序输出，供你和终端结果逐行对照。',code:'30'}]}/>);
 expect(output).toContain('程序输出');expect(output).not.toContain('项目节选');
 const visible=findArticles('', 'python');
 expect(visible.map(a=>a.id)).toEqual(pythonChapters.map(c=>c.id));
 for(let i=0;i<visible.length;i++){
  const html=renderToStaticMarkup(<PublicArticle article={visible[i]} unlocked={false}/>);
  expect(html).toContain('Python 从零开始');
  if(i>0)expect(html).toContain('href="#article/'+visible[i-1].id+'"');
  if(i<visible.length-1)expect(html).toContain('href="#article/'+visible[i+1].id+'"');
 }
});
