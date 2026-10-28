import {afterEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {articles,findArticles} from '../data/articles';
import {pythonCoursePlan,retiredPythonArticleIds} from '../data/pythonCoursePlan';
import {topicCurricula} from '../data/topicCurricula';
import before from '../../docs/validation/pre-nest-supplement-identities.json';
import PythonCourseReset from '../components/PythonCourseReset';
import App from '../App';

afterEach(()=>vi.unstubAllGlobals());
it('retires exactly the old Python series without deleting the historical identity baseline',()=>{
 expect([...retiredPythonArticleIds].sort()).toEqual(before.filter(a=>a.topic==='python').map(a=>a.id).sort());
 expect(findArticles('', 'python')).toEqual([]);
 for(const id of retiredPythonArticleIds)expect(articles.some(a=>a.id===id)).toBe(false);
});
it('shows the Node developer plan without publishing fake chapter routes',()=>{
 const html=renderToStaticMarkup(<PythonCourseReset/>);
 expect(html).toContain('Node.js');expect(html).toContain('正文尚未发布');
 expect(topicCurricula.find(c=>c.topic==='python')!.chapters.map(c=>c.id)).toEqual(pythonCoursePlan.map(c=>c.id));
 for(const chapter of pythonCoursePlan){
  expect(articles.some(a=>a.id===chapter.id)).toBe(false);
  expect(html).toContain(chapter.title);
  expect(html).not.toContain('href="#article/'+chapter.id+'"');
 }
});
it('resolves every retired URL to an honest withdrawal notice without the old prose or discussion',()=>{
 vi.stubGlobal('navigator',{onLine:true});
 vi.stubGlobal('localStorage',{getItem:()=>null});
 vi.stubGlobal('sessionStorage',{getItem:()=>null});
 for(const id of retiredPythonArticleIds){
  vi.stubGlobal('location',{hash:'#article/'+id});
  const html=renderToStaticMarkup(<App/>);
  expect(html).toContain('这篇旧文已撤下');expect(html).toContain('正文尚未发布');
  expect(html).not.toContain('comments-panel');expect(html).not.toContain('section-language-model');
 }
});
