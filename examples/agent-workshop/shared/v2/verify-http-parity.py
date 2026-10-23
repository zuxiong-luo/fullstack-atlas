"""Run both real loopback servers against shared cases; no external model calls.
Run from any directory: python verify-http-parity.py --python /path/to/python-v2/.venv/bin/python
Requires npm run build in typescript-v2 and installed Python dependencies.
"""
import argparse,json,os,socket,subprocess,tempfile,time,urllib.request,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));return sock.getsockname()[1]
def request(port,method,path,token=None,body=None):
    headers={'Content-Type':'application/json'} if body is not None else {}
    if token:headers['Authorization']='Bearer '+token
    req=urllib.request.Request(f'http://127.0.0.1:{port}'+path,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=8) as response:return response.status,json.load(response)
    except urllib.error.HTTPError as error:return error.code,json.load(error)
def normalized(value):
    if isinstance(value,dict):return {k:normalized(v) for k,v in value.items() if k!='message'}
    if isinstance(value,list):return [normalized(v) for v in value]
    return value
def run(python):
    fixtures=json.loads((ROOT/'shared/v2/http-cases.json').read_text());report=[]
    with tempfile.TemporaryDirectory(prefix='atlas-parity-') as scratch:
        for chapter in range(2,9):
            processes=[];ports=[]
            try:
                for language,command in [('python-v2',[python,'server.py']),('typescript-v2',['node','--experimental-sqlite','dist/src/server.js'])]:
                    port=free_port();ports.append(port)
                    env={**os.environ,'CHAPTER':str(chapter),'PORT':str(port),'MODEL_PROVIDER':'mock','SQLITE_PATH':f'{scratch}/{chapter}-python.sqlite','DATABASE_PATH':f'{scratch}/{chapter}-typescript.sqlite'}
                    log=open(f'{scratch}/{chapter}-{language}.log','w')
                    process=subprocess.Popen(command,cwd=ROOT/language,env=env,stdout=log,stderr=log);processes.append((process,log))
                    deadline=time.monotonic()+15
                    while True:
                        if process.poll() is not None:raise RuntimeError(f'{language} exited during startup')
                        try:
                            if request(port,'GET','/health')==(200,{'status':'ok','chapter':chapter}):break
                        except (OSError,ValueError):pass
                        if time.monotonic()>deadline:raise RuntimeError(f'{language} startup timeout')
                        time.sleep(.05)
                count=0
                for fixture in fixtures:
                    if fixture['chapter']>chapter:continue
                    for step in fixture['steps']:
                        outputs=[request(port,step['method'],step['path'],step.get('token'),step.get('body')) for port in ports]
                        for status,data in outputs:
                            assert status==step['status'],(fixture['id'],status,data)
                            if 'code' in step:assert data['error']['code']==step['code'],fixture['id']
                            for path,expected in step.get('expect',{}).items():
                                actual=data
                                for key in path.split('.'):actual=actual[key]
                                assert actual==expected,(fixture['id'],path,actual,expected)
                        assert outputs[0][0]==outputs[1][0] and normalized(outputs[0][1])==normalized(outputs[1][1]),(fixture['id'],'parity mismatch',outputs)
                        count+=1
                report.append({'chapter':chapter,'matching_http_steps':count})
            finally:
                for process,log in processes:
                    if process.poll() is None:
                        process.terminate()
                        try:process.wait(timeout=5)
                        except subprocess.TimeoutExpired:process.kill();process.wait()
                    log.close()
    print(json.dumps({'kind':'real_loopback_http_parity','results':report,'external_model_calls':0},indent=2))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--python',default=str(ROOT/'python-v2/.venv/bin/python'));run(parser.parse_args().python)
