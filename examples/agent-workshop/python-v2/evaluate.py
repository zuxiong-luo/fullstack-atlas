"""Shared deterministic retrieval regression. Zero model calls, no semantic score."""
import asyncio
import json
from contracts import read_shared
from retrieval import KeywordRetriever
async def evaluate(inputs=None,retriever=None):
    inputs=read_shared('retrieval-cases.json') if inputs is None else inputs
    if not isinstance(inputs,list) or not inputs or not any(isinstance(x,dict) and isinstance(x.get('expected'),list) and x['expected'] for x in inputs) or not any(isinstance(x,dict) and x.get('expected')==[] for x in inputs):raise ValueError('Evaluation needs positive and no-hit cases')
    retriever=retriever or KeywordRetriever();cases=[]
    for case in inputs:
        if not isinstance(case,dict) or any(not isinstance(case.get(k),str) for k in ('id','owner','question')) or not isinstance(case.get('expected'),list) or any(not isinstance(x,str) for x in case['expected']) or len(set(case['expected']))!=len(case['expected']):raise ValueError('Invalid evaluation case')
        selected=[item['id'] for item in (await retriever.search(case['owner'],case['question']))[:3]]
        expected=case['expected'];recall=len(set(selected)&set(expected))/len(expected) if expected else None
        cases.append({'id':case['id'],'selected':selected,'expected':expected,'recall_at_3':recall,'no_hit_correct':not selected if not expected else None})
    recalls=[case['recall_at_3'] for case in cases if case['recall_at_3'] is not None]
    return {'kind':'keyword_retrieval_regression','cases':cases,'mean_recall_at_3':sum(recalls)/len(recalls) if recalls else 0,'no_hit_pass':all(case['no_hit_correct'] for case in cases if case['no_hit_correct'] is not None),'model_calls':0,'not_model_quality':True}
if __name__=='__main__':
    import sys
    try:
        report=asyncio.run(evaluate());print(json.dumps(report,ensure_ascii=True))
        if report['mean_recall_at_3']<1 or not report['no_hit_pass']:sys.exit(1)
    except Exception:
        print(json.dumps({'error':'INVALID_EVALUATION_DATA','not_model_quality':True}));sys.exit(1)
