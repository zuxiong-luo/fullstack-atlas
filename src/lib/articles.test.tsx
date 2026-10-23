import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {articles,articleTopics,readingPaths,findArticles} from '../data/articles';
import {questions} from '../data/content';
import {sectionBlocks} from '../data/articleTypes';
import {PublicArticle} from '../components/Articles';
describe('public reading and private practice',()=>{
 it('resolves article, topic, path and question references',()=>{const ids=new Set(articles.map(a=>a.id));expect(ids.size).toBe(articles.length);for(const a of articles){expect(articleTopics.some(t=>t.id===a.topic)).toBe(true);for(const id of a.questionIds)expect(questions.some(q=>q.id===id)).toBe(true)}for(const p of readingPaths)for(const id of p.articleIds)expect(ids.has(id)).toBe(true)});
 it('shows public prose without rendering related question links while locked',()=>{const a=articles.find(a=>a.id==='oauth-login')!;const html=renderToStaticMarkup(<PublicArticle article={a} unlocked={false}/>);const first=sectionBlocks(a.sections[0]).find(b=>b.type==='paragraph');expect(first?.type).toBe('paragraph');if(first?.type==='paragraph')expect(html).toContain(first.text);expect(html).toContain('#study/'+a.id);expect(html).not.toContain('href="#q/');expect(html).not.toContain('textarea');const unlocked=renderToStaticMarkup(<PublicArticle article={a} unlocked/>);expect(unlocked).toContain('href="#q/oauth"')});
 it('provides public article paths and searches prose with topic filters',()=>{expect(findArticles('code_verifier','identity').map(a=>a.id)).toContain('oauth-login');expect(findArticles('code_verifier','flutter')).toHaveLength(0)});
});
