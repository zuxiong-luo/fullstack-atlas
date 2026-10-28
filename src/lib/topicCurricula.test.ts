import {expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {articles,articleTopics,findArticles} from '../data/articles';
import {sectionBlocks} from '../data/articleTypes';
import {topicCurricula} from '../data/topicCurricula';
import baseline from '../../docs/validation/article-identities-baseline.json';
import preNestBaseline from '../../docs/validation/pre-nest-supplement-identities.json';
import {isRetiredPythonArticle} from '../data/pythonCoursePlan';

it('preserves every original article route, anchor and training relationship',()=>{
  const ids=articles.map(a=>a.id);
  expect(new Set(ids).size).toBe(ids.length);
  for(const original of baseline){
    const current=articles.find(a=>a.id===original.id);
    if(isRetiredPythonArticle(original.id)){
      expect(original.topic).toBe('python');
      expect(current).toBeUndefined();
      continue;
    }
    expect(current,original.id).toBeDefined();
    expect(current!.topic,original.id).toBe(original.topic);
    expect(current!.questionIds,original.id).toEqual(original.questionIds);
    for(const anchor of original.sectionIds)expect(current!.sections.map(s=>s.id),original.id).toContain(anchor);
  }
});

it('keeps planned chapters out of routes while ordering available chapters by curriculum',()=>{
  const plannedIds=topicCurricula.flatMap(c=>c.chapters.map(ch=>ch.id));
  expect(new Set(plannedIds).size).toBe(plannedIds.length);
  for(const curriculum of topicCurricula){
    expect(articleTopics.some(t=>t.id===curriculum.topic)).toBe(true);
    expect(curriculum.prerequisites.length).toBeGreaterThan(0);
    const visible=findArticles('',curriculum.topic);
    expect(visible.map(a=>a.id)).toEqual(curriculum.chapters.filter(ch=>articles.some(a=>a.id===ch.id)).map(ch=>ch.id));
    for(const chapter of curriculum.chapters){
      expect(chapter.outcome.trim()).not.toBe('');
      const published=articles.find(a=>a.id===chapter.id);
      if(chapter.phase===0)expect(published,chapter.id).toBeDefined();
      if(published)expect(published.topic,chapter.id).toBe(curriculum.topic);
    }
  }
});

it('keeps new chapter inline implementation excerpts synchronized with downloadable source',()=>{
  for(const chapter of topicCurricula.flatMap(c=>c.chapters).filter(c=>c.phase>0)){
    const article=articles.find(a=>a.id===chapter.id);
    if(!article)continue;
    let mapped=0;
    for(const block of article.sections.flatMap(sectionBlocks)){
      if(block.type!=='code'||block.kind==='pseudocode'||!block.filename)continue;
      const filename=block.filename.split(' · ')[0];
      if(!filename.startsWith('examples/'))continue;
      expect(path.relative('examples',filename).startsWith('..'),filename).toBe(false);
      expect(fs.existsSync(filename),filename).toBe(true);
      expect(fs.statSync(filename).isFile(),filename).toBe(true);
      expect(fs.readFileSync(filename,'utf8'),article.id+': '+filename).toContain(block.code.trim());
      mapped++;
    }
    expect(mapped,article.id+' needs an inline real implementation, not only commands').toBeGreaterThan(0);
    expect(article.examples?.some(e=>e.path.endsWith('.zip')),article.id+' complete source download').toBe(true);
    // An authored diagram is part of the explanation, not an unused delivery file.
    const figureDirectory=path.join('public','figures',article.id);
    if(fs.existsSync(figureDirectory)){
      const referenced=new Set(article.sections.flatMap(sectionBlocks).filter(b=>b.type==='figure').map(b=>b.src.replace(/^\//,'')));
      for(const asset of fs.readdirSync(figureDirectory).filter(name=>name.endsWith('.svg'))){
        expect(referenced.has('figures/'+article.id+'/'+asset),article.id+': authored diagram must appear in the reading flow: '+asset).toBe(true);
      }
    }

  }
});

it('keeps every published pre-Nest article, anchor and training reference stable during the supplement',()=>{
  for(const previous of preNestBaseline){
    const current=articles.find(a=>a.id===previous.id);
    if(isRetiredPythonArticle(previous.id)){
      expect(previous.topic).toBe('python');
      expect(current).toBeUndefined();
      continue;
    }
    expect(current,previous.id).toBeDefined();
    expect(current!.topic,previous.id).toBe(previous.topic);
    expect(current!.questionIds,previous.id).toEqual(previous.questionIds);
    for(const anchor of previous.sectionIds)expect(current!.sections.map(s=>s.id),previous.id+'#'+anchor).toContain(anchor);
  }
});
