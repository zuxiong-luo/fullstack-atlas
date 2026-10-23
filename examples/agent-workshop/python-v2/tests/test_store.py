import asyncio,json,subprocess,sys,threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import pytest
from contracts import ServiceError
from store import Store
from service import Service

def test_two_connections_fence_expired_epoch_and_keep_committed_restart(tmp_path):
    now=[1000];path=str(tmp_path/'state.sqlite');a=Store(path,lambda:now[0]);b=Store(path,lambda:now[0])
    try:
        a.ensure('alice','r','cache');first=a.claim('alice','r',100)
        with pytest.raises(ServiceError,match='RUN_BUSY'):b.claim('alice','r',100)
        a.retrieved(first,[{'id':'cache-guide','title':'t','text':'evidence'}]);now[0]=1200;second=b.claim('alice','r',100)
        assert second['epoch']==first['epoch']+1
        with pytest.raises(ServiceError,match='STALE_RUN'):a.complete(first,{'answer':'old','citations':[]})
        b.complete(second,{'answer':'fresh','citations':['cache-guide']});a.release(first)
        with pytest.raises(ServiceError,match='IDEMPOTENCY_CONFLICT'):a.ensure('alice','r','different')
        a.ensure('alice','after-rollback','cache')
    finally:a.close();b.close()
    reopened=Store(path)
    try:assert reopened.get('alice','r')['answer']=='fresh';assert reopened.get('alice','r')['status']=='completed'
    finally:reopened.close()

def test_parallel_sqlite_claims_have_exactly_one_current_owner(tmp_path):
    path=str(tmp_path/'parallel.sqlite');a=Store(path,lambda:1000);b=Store(path,lambda:1000);a.ensure('alice','r','cache');barrier=threading.Barrier(2)
    def claim(store):
        barrier.wait()
        try:return store.claim('alice','r',100)['epoch']
        except ServiceError as error:return error.code
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(claim,[a,b]))
        assert sorted(results,key=str)==sorted([1,'RUN_BUSY'],key=str)
    finally:a.close();b.close()

def test_actual_process_crashes_after_checkpoint_then_second_process_resumes(tmp_path):
    path=str(tmp_path/'crash.sqlite');fixture=Path(__file__).with_name('crash_fixture.py')
    crash=subprocess.run([sys.executable,str(fixture),path,'crash'],capture_output=True,text=True,timeout=10)
    assert crash.returncode==27,crash.stderr
    store=Store(path)
    try:assert store.get('alice','crash-run')['checkpoint']=='retrieved'
    finally:store.close()
    resumed=subprocess.run([sys.executable,str(fixture),path,'resume'],capture_output=True,text=True,timeout=10)
    assert resumed.returncode==0,resumed.stderr;result=json.loads(resumed.stdout)
    assert result['status']=='completed';assert result['checkpoint']=='done';assert result['citations']==['lease-guide']

def test_failed_model_retry_reuses_checkpoint_then_replay_bypasses_capacity():
    async def check():
        counts={'retrieve':0,'model':0};failure=[True]
        class Retrieval:
            async def search(self,owner,question):counts['retrieve']+=1;return [{'id':'cache-guide','title':'t','text':'e'}]
        class Provider:
            async def generate(self,input):
                counts['model']+=1
                if failure[0]:raise ValueError('controlled')
                return '{"answer":"ok","citations":["cache-guide"]}'
        service=Service(retriever=Retrieval(),provider=Provider(),max_concurrent=1)
        try:
            with pytest.raises(ServiceError,match='UPSTREAM_ERROR'):await service.run('alice','r','cache')
            assert service.store.get('alice','r')['checkpoint']=='retrieved';failure[0]=False
            assert (await service.run('alice','r'))['status']=='completed'
            service.active=1
            assert (await service.run('alice','r','cache'))['status']=='completed'
            assert counts=={'retrieve':1,'model':2}
        finally:await service.close()
    asyncio.run(check())

def test_concurrent_same_key_is_busy_and_model_timeout_preserves_retrieved():
    async def check():
        gate=asyncio.Event();started=asyncio.Event()
        class Provider:
            async def generate(self,input):started.set();await gate.wait();return '{"answer":"ok","citations":["cache-guide"]}'
        service=Service(provider=Provider(),timeout_ms=1000)
        try:
            first=asyncio.create_task(service.run('alice','r','cache'));await started.wait()
            with pytest.raises(ServiceError,match='RUN_BUSY'):await service.run('alice','r','cache')
            gate.set();assert (await first)['status']=='completed'
        finally:gate.set();await service.close()
        other=Service(provider=Provider(),timeout_ms=10);gate.clear()
        try:
            with pytest.raises(ServiceError,match='UPSTREAM_TIMEOUT'):await other.run('alice','timeout','cache')
            assert other.store.get('alice','timeout')['checkpoint']=='retrieved';assert other.store.get('alice','timeout')['lease_until']==0
        finally:gate.set();await other.close()
    asyncio.run(check())
