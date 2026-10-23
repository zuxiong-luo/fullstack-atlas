import asyncio,json,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from store import Store
from service import Service
class NeverRetrieve:
    async def search(self,owner,question):raise AssertionError('Retrieval repeated after durable checkpoint')
async def main():
    path,mode=sys.argv[1:]
    store=Store(path,now=lambda:1000 if mode=='crash' else 1200)
    if mode=='crash':
        def crash(run):os._exit(27)
        await Service(store=store,lease_ms=100,after_retrieved=crash).run('alice','crash-run','lease worker recovery')
    else:
        service=Service(store=store,lease_ms=100,retriever=NeverRetrieve())
        try:print(json.dumps(await service.run('alice','crash-run')))
        finally:await service.close()
asyncio.run(main())
