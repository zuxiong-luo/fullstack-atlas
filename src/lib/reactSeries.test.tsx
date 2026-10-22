import {it,expect} from 'vitest';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {renderToStaticMarkup} from 'react-dom/server';
import {articles} from '../data/articles';
import {reactSeries} from '../data/reactSeries';
import ReactSeriesNav from '../components/ReactSeriesNav';
const ids=['react-hooks-interactions','react-state-management','react-concurrency','react-performance','react-modern-engineering','react-fiber-reconciliation','react-fiber-structure','react-double-buffer','react-root-scheduling','react-bailout-memo','react-hook-memoization'];
it('keeps inline primary-source excerpts equal to pinned offline source lines',()=>{
 const manifest=JSON.parse(fs.readFileSync('public/sources/react-v18.3.1/manifest.json','utf8'));
 for(const [path,hash] of Object.entries(manifest.files))expect(createHash('sha256').update(fs.readFileSync('public/sources/react-v18.3.1/'+path)).digest('hex')).toBe(hash);
 for(const id of ids){const article=articles.find(a=>a.id===id)!;expect(article).toBeDefined();
  for(const section of article.sections)for(const block of section.blocks||[]){
   if(block.type!=='code')continue;
   const match=/([\w]+(?:\.old)?\.js):(\d+)[–-](\d+)/.exec(block.filename||'');if(!match)continue;
   const path=Object.keys(manifest.files).find(path=>path.endsWith('/'+match[1]));expect(path,block.filename).toBeDefined();
   const source=fs.readFileSync('public/sources/react-v18.3.1/'+path,'utf8').split('\n').slice(Number(match[2])-1,Number(match[3])).join('\n');
   expect(block.code.trim(),block.filename).toBe(source.trim());
  }
 }
});
it('links only existing chapters and identifies current chapter without creating planned routes',()=>{
 for(const series of reactSeries)for(const id of series.articles)expect(articles.some(a=>a.id===id)).toBe(true);
 const html=renderToStaticMarkup(<ReactSeriesNav current="react-double-buffer"/>);
 expect(html).toContain('href="#article/react-double-buffer" aria-current="page"');
 expect(html).toContain('待编写');expect(html).not.toContain('href="#article/react-ssr');
});
