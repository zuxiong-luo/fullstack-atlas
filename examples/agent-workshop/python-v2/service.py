"""Chapter gates and bounded orchestration. Default provider is deterministic mock."""
import asyncio
import inspect
import json
from contracts import ServiceError,fail,parse_answer
from retrieval import KeywordRetriever
from providers import MockProvider,invoke
from store import Store,public_run
class Service:
    def __init__(self,*,chapter=8,store=None,provider=None,retriever=None,timeout_ms=3000,lease_ms=10000,max_concurrent=2,max_context_chars=12000,max_model_calls=1,after_retrieved=None):
        for name,value,low,high in [('chapter',chapter,2,8),('timeout_ms',timeout_ms,1,60000),('lease_ms',lease_ms,1,120000),('max_concurrent',max_concurrent,1,100),('max_context_chars',max_context_chars,1,1000000),('max_model_calls',max_model_calls,0,100)]:
            if type(value) is not int or not low<=value<=high:raise ValueError('Invalid '+name)
        self.chapter,self.store,self.provider,self.retriever=chapter,store or Store(),provider or MockProvider(),retriever or KeywordRetriever()
        self.timeout_ms,self.lease_ms=timeout_ms,lease_ms
        self.max_concurrent,self.max_context_chars,self.max_model_calls=max_concurrent,max_context_chars,max_model_calls
        self.after_retrieved=after_retrieved;self.active=0;self.background=set()
    async def _in_slot(self,operation):
        if self.chapter<8:return await operation(self._track)
        if self.active>=self.max_concurrent:fail(503,'SERVICE_BUSY')
        self.active+=1;holds=[]
        def hold(task):holds.append(task);self._track(task)
        try:return await operation(hold)
        finally:
            pending={task for task in holds if not task.done()}
            if not pending:self.active-=1
            else:
                # Timeout may return before a cancellation-resistant provider settles.
                def settled(task):
                    pending.discard(task)
                    if not pending:self.active-=1
                for task in tuple(pending):task.add_done_callback(settled)
    def _track(self,task):
        self.background.add(task)
        def finish(completed):
            self.background.discard(completed)
            if not completed.cancelled():completed.exception()  # consume late errors
        task.add_done_callback(finish)
    async def _respond(self,question,evidence,hold):
        context_chars=len(question)+sum(len(item[k]) for item in evidence for k in ('id','title','text'))
        if self.chapter>=8 and context_chars>self.max_context_chars:fail(400,'CONTEXT_TOO_LARGE')
        if not evidence:return {'answer':'没有找到可引用的资料。','citations':[],'evidence':[],'metrics':{'retrieved':0,'model_calls':0,'context_chars':context_chars}}
        if self.chapter>=8 and self.max_model_calls<1:fail(400,'MODEL_BUDGET_EXCEEDED')
        raw=await invoke(self.provider,{'question':question,'evidence':evidence},self.timeout_ms,hold)
        return {**parse_answer(raw,evidence),'evidence':evidence,'metrics':{'retrieved':len(evidence),'model_calls':1,'context_chars':context_chars}}
    async def answer(self,owner,question):
        async def work(hold):return await self._respond(question,await self.retriever.search(owner,question),hold)
        return await self._in_slot(work)
    async def run(self,owner,id,question=None):
        initial=self.store.get(owner,id) if question is None else self.store.ensure(owner,id,question)
        if not initial:fail(404,'RUN_NOT_FOUND')
        if initial['status']=='completed':return public_run(initial)
        async def work(hold):
            claim=self.store.claim(owner,id,self.lease_ms)
            if claim['status']=='completed':return public_run(claim)
            try:
                if claim['checkpoint']=='retrieved':evidence=json.loads(claim['evidence'])
                else:
                    evidence=await self.retriever.search(owner,claim['question']);self.store.retrieved(claim,evidence)
                    if self.after_retrieved:
                        value=self.after_retrieved(self.store.get(owner,id))
                        if inspect.isawaitable(value):await value
                result=await self._respond(claim['question'],evidence,hold);self.store.complete(claim,result)
                return public_run(self.store.get(owner,id))
            finally:self.store.release(claim)
        return await self._in_slot(work)
    async def close(self):
        tasks=tuple(self.background)
        for task in tasks:task.cancel()
        if tasks:await asyncio.wait(tasks,timeout=.2)
        # Late provider tasks never write SQLite; only a fenced run could commit.
        self.store.close()
