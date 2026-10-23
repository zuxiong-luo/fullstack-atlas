import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import fs from 'node:fs';
import {articles} from '../data/articles';
import {sourceLocation,sourceSlice} from './reactSource';
import HighlightedCode from '../components/HighlightedCode';
it('resolves every pinned React inline reference to an offline source and valid line range',()=>{
 for(const article of articles)for(const section of article.sections)for(const block of section.blocks||[]){
  if(block.type!=='reference'||!block.url.startsWith('https://github.com/facebook/react/blob/v18.3.1/'))continue;
  const loc=sourceLocation(block.url);expect(loc,block.url).not.toBeNull();
  const text=fs.readFileSync('public/'+loc!.asset,'utf8');
  const snippet=sourceSlice(text,loc!.start,loc!.end);expect(snippet.code.trim()).not.toBe('');
  if(!loc!.context)expect(snippet.end).toBe(loc!.end);
 }
 expect(sourceLocation('https://example.com/file.js#L1')).toBeNull();
 expect(sourceSlice('a\nb\nc',2,3).code).toBe('b\nc');
});
it('highlights Flow and escapes source markup without executing or changing source text',()=>{
 const html=renderToStaticMarkup(<HighlightedCode language="flow" code={'const x: number = 1; // <img src=x onerror=alert(1)>'}/>);
 expect(html).toContain('token keyword');expect(html).toContain('token comment');expect(html).not.toContain('<img');expect(html).toContain('&lt;img');
 expect(renderToStaticMarkup(<HighlightedCode language="unknown" code="<hello>"/>)).toContain('&lt;hello&gt;');
});

it('keeps source attribution without a duplicate viewer when the excerpt is already in the section',async()=>{
 const {default:ArticleBlocks}=await import('../components/ArticleBlocks');
 const reference={type:'reference' as const,title:'Fiber fields',url:'https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiber.old.js#L125-L155'};
 const excerpt={type:'code' as const,code:'this.tag = tag;',filename:'ReactFiber.old.js:125–155',language:'flow',kind:'excerpt' as const,purpose:'test excerpt'};
 const html=renderToStaticMarkup(<ArticleBlocks blocks={[excerpt,{type:'paragraph',text:'字段带读'},reference]}/>);
 expect(html).toContain(reference.url);expect(html).toContain('代码出处');expect(html).not.toContain('展开源码');
 expect(renderToStaticMarkup(<ArticleBlocks blocks={[reference]}/>)).toContain('展开源码');
});
