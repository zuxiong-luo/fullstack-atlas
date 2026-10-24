"""Exercise only this debug-key lab package on a verified x86_64 emulator."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import threading
import time

ROOT=Path(__file__).resolve().parent
PACKAGE='com.atlaslab.delivery'
SERIAL=os.environ.get('ATLAS_LAB_EMULATOR_SERIAL','')
EVENTS=[]
CONDITION=threading.Condition()


def adb(*arguments,check=True,seconds=25):
    result=subprocess.run(['adb','-s',SERIAL,*arguments],capture_output=True,text=True,timeout=seconds)
    if check and result.returncode:raise RuntimeError(result.stdout+result.stderr)
    return result


def wait(name,release,after=0):
    deadline=time.monotonic()+30
    with CONDITION:
        while True:
            for row in EVENTS[after:]:
                if row.get('event')==name and row.get('releaseId')==release:return row
            remaining=deadline-time.monotonic()
            if remaining<=0:raise AssertionError('delivery event missing: '+json.dumps(EVENTS[-8:]))
            CONDITION.wait(remaining)


class Handler(BaseHTTPRequestHandler):
    def setup(self):super().setup();self.connection.settimeout(3)
    def log_message(self,*_):pass
    def do_POST(self):
        size=int(self.headers.get('Content-Length','0'))
        if self.path!='/events' or not 1<=size<=16384:self.send_error(400);return
        value=json.loads(self.rfile.read(size))
        with CONDITION:
            if len(EVENTS)>=64:self.send_error(503);return
            EVENTS.append(value);CONDITION.notify_all()
        self.send_response(200);self.send_header('Content-Length','2');self.end_headers();self.wfile.write(b'{}')


def main():
    if sys.platform!='linux' or os.environ.get('CI')!='true' or not re.fullmatch(r'emulator-\d+',SERIAL):
        raise SystemExit('explicit disposable Linux emulator only')
    if adb('shell','getprop','ro.kernel.qemu').stdout.strip()!='1':raise SystemExit('refuse physical or unidentified device')
    if adb('shell','getprop','ro.product.cpu.abi').stdout.strip()!='x86_64':raise SystemExit('x86_64 artifact only')
    if adb('shell','pm','path',PACKAGE).stdout.strip():raise SystemExit('refuse existing application')
    signal.signal(signal.SIGTERM,lambda *_:(_ for _ in ()).throw(KeyboardInterrupt()))
    output=Path(os.environ['ATLAS_LAB_ARTIFACT_DIR'])
    records=json.loads((output/'build-report.json').read_text())['artifacts']
    assert [r['releaseId'] for r in records]==['lab-v1','lab-v2']
    for row in records:
        for extension in ['apk','map']:
            assert hashlib.sha256((output/(row['releaseId']+'.'+extension)).read_bytes()).hexdigest()==row[extension+'_sha256']
    assert records[0]['certificate_sha256']==records[1]['certificate_sha256']
    server=ThreadingHTTPServer(('127.0.0.1',4355),Handler)
    thread=threading.Thread(target=server.serve_forever);thread.start()
    try:
        print(json.dumps({'emulator':SERIAL,'api':adb('shell','getprop','ro.build.version.sdk').stdout.strip(),
                          'abi':'x86_64','physical_device':False}),flush=True)
        adb('install','--no-streaming',str(output/'lab-v1.apk'),seconds=90)
        adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
        first=wait('delivery_rendered','lab-v1')
        assert first['nativeCode']=='1' and first['created'] is True
        assert first['note']=={'schema':1,'title':'fake note persisted by lab-v1'}
        adb('shell','am','force-stop',PACKAGE)
        cursor=len(EVENTS)
        adb('install','-r','--no-streaming',str(output/'lab-v2.apk'),seconds=90)
        adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
        second=wait('delivery_rendered','lab-v2',after=cursor)
        assert second['nativeCode']=='2' and second['nativeName']=='1.1.0' and second['created'] is False
        assert second['note']==first['note']
        error=wait('controlled_js_error','lab-v2',after=cursor)
        assert error['message']=='ATLAS_CONTROLLED_JS_FAILURE'
        (output/'caught-error.json').write_text(json.dumps(error))
        wrong=subprocess.run(['node',str(ROOT/'symbolicate.mjs'),str(output),'lab-v1'],capture_output=True,text=True,timeout=20)
        assert wrong.returncode!=0 and 'MAP_RELEASE_MISMATCH' in wrong.stderr
        correct=subprocess.run(['node',str(ROOT/'symbolicate.mjs'),str(output),'lab-v2'],capture_output=True,text=True,timeout=20)
        print(correct.stdout+correct.stderr,flush=True)
        assert correct.returncode==0 and 'controlled-error.js' in correct.stdout and 'controlledFailure' in correct.stdout
        print(json.dumps({'case':'signed_upgrade_and_js_symbolication','data_retained':True,'native_version':'2',
                          'same_debug_certificate':True,'wrong_release_map_rejected':True,'native_process_crash':False}),flush=True)
        rejected=adb('install','-r','--no-streaming',str(output/'lab-v1.apk'),check=False,seconds=90)
        assert rejected.returncode!=0 and 'INSTALL_FAILED_VERSION_DOWNGRADE' in rejected.stdout+rejected.stderr
        cursor=len(EVENTS)
        adb('shell','am','force-stop',PACKAGE)
        adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
        retained=wait('delivery_rendered','lab-v2',after=cursor)
        assert retained['nativeCode']=='2' and retained['note']==first['note']
        print(json.dumps({'case':'downgrade_rejected','still_version':2,'fake_data_unchanged':True}),flush=True)
        (output/'runtime-events.json').write_text(json.dumps(EVENTS,indent=2))
    except BaseException:
        print(adb('logcat','-d','-t','120',check=False).stdout[-16000:],flush=True)
        (output/'runtime-events.json').write_text(json.dumps(EVENTS,indent=2))
        raise
    finally:
        try:
            adb('shell','am','force-stop',PACKAGE,check=False)
            if adb('shell','pm','path',PACKAGE).stdout.strip():adb('uninstall',PACKAGE)
            assert not adb('shell','pm','path',PACKAGE).stdout.strip()
        finally:
            server.shutdown();server.server_close();thread.join(timeout=3)
        assert not thread.is_alive()
        print(json.dumps({'cleanup':'own fake app uninstalled and local fixture stopped','physical_device':False}),flush=True)


if __name__=='__main__':main()
