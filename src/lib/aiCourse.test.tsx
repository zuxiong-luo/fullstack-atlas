import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import AgentColumn from '../components/AgentColumn';
import {PublicArticle} from '../components/Articles';
import {articles,findArticles} from '../data/articles';
import {agentChapters,aiCourseChapters} from '../data/series';

it('keeps new course pagination inside its sequence and original chapter pagination stable',()=>{
 const entry=articles.find(a=>a.id==='ai-prompt-contracts')!;
 const html=renderToStaticMarkup(<PublicArticle article={entry} unlocked={false}/>);
 expect(html).toContain('href="#article/ai-model-context"');
 expect(html).toContain('href="#article/ai-rag-ingestion"');
 expect(html).not.toContain('href="#article/agent-rag"');
 const original=renderToStaticMarkup(<PublicArticle article={articles.find(a=>a.id==='agent-foundations')!} unlocked={false}/>);
 expect(original).toContain('href="#article/agent-tools-mcp"');
 expect(original).not.toContain('href="#article/ai-prompt-contracts"');
});
it('makes both series discoverable without the stale overview-only notice',()=>{
 const html=renderToStaticMarkup(<AgentColumn/>);
 for(const chapter of [...agentChapters,...aiCourseChapters])expect(html).toContain('href="#article/'+chapter.id+'"');
 expect(html).not.toContain('后续章节目前为概览');
 expect(findArticles('cl100k_base','ai').some(a=>a.id==='ai-model-context')).toBe(true);
 expect(findArticles('query_only','ai').some(a=>a.id==='ai-data-tools')).toBe(true);
});
