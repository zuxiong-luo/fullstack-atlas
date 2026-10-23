import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import fs from 'node:fs';
import {articles,findArticles} from '../data/articles';
import {sectionBlocks} from '../data/articleTypes';
import {PublicArticle} from '../components/Articles';
import {browserExamples} from '../data/browserExamples';
import Playground from '../components/Playground';
it('renders interleaved prose, local figures and executable entries with stable identities',()=>{
 for(const id of ['react-state-effects','react-identity-events','react-hooks-interactions','react-state-management','react-concurrency','react-performance','react-modern-engineering','react-fiber-reconciliation','react-fiber-scheduling','agent-foundations','react-fiber-structure','react-hooks-queue','react-lane-selection','react-work-loop-commit','react-double-buffer','react-root-scheduling','react-bailout-memo','react-hook-memoization']){
  const a=articles.find(a=>a.id===id)!;const html=renderToStaticMarkup(<PublicArticle article={a} unlocked={false}/>);
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
