"""Only a verified disposable Android emulator; never a physical device."""
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
import xml.etree.ElementTree as ET
from uuid import uuid4

PACKAGE = 'com.atlaslab.rnengineering'
SERIAL = os.environ.get('ATLAS_LAB_EMULATOR_SERIAL', '')
CONDITION = threading.Condition()
EVENTS, GATES = [], []
AUTO_RELEASE = False


def adb(*arguments, check=True, seconds=20):
    result = subprocess.run(['adb', '-s', SERIAL, *arguments], capture_output=True, text=True, timeout=seconds)
    if check and result.returncode:
        raise RuntimeError('adb failed: '+result.stdout+result.stderr)
    return result.stdout


def record(event):
    with CONDITION:
        if len(EVENTS) >= 256:
            raise RuntimeError('finite event capacity exceeded')
        EVENTS.append(event)
        CONDITION.notify_all()


def wait(predicate, after=0, seconds=25):
    deadline = time.monotonic()+seconds
    with CONDITION:
        while True:
            for index in range(after, len(EVENTS)):
                if predicate(EVENTS[index]):
                    return index+1, EVENTS[index]
            remaining=deadline-time.monotonic()
            if remaining <= 0:
                raise AssertionError('event not observed: '+json.dumps(EVENTS[-16:]))
            CONDITION.wait(remaining)


def event(name, **fields):
    return lambda row: row.get('event') == name and all(row.get(k) == v for k,v in fields.items())


class Fixture(ThreadingHTTPServer):
    permits = threading.BoundedSemaphore(8)
    def process_request(self, request, address):
        if not self.permits.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request,address)
        except BaseException:
            self.permits.release()
            raise
    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request,address)
        finally:
            self.permits.release()


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup(); self.connection.settimeout(3)
    def log_message(self,*_):
        pass
    def reply(self,status,value):
        payload=json.dumps(value).encode()
        try:
            self.send_response(status); self.send_header('Content-Length',str(len(payload)))
            self.send_header('Content-Type','application/json');self.end_headers()
            self.wfile.write(payload)
        except (BrokenPipeError,ConnectionResetError):
            pass
    def do_POST(self):
        size=int(self.headers.get('Content-Length','0'))
        if self.path!='/events' or not 1<=size<=4096:
            self.reply(400,{'error':'finite lab reports only'});return
        value=json.loads(self.rfile.read(size))
        if not isinstance(value,dict) or not isinstance(value.get('event'),str):
            self.reply(400,{'error':'record required'});return
        record(value); self.reply(200,{'accepted':True})
    def do_GET(self):
        if self.path not in ['/gate?id=n1','/gate?id=n2']:
            self.reply(404,{});return
        gate=threading.Event()
        with CONDITION:
            index=len(GATES)
            if index>=32:
                self.reply(503,{});return
            GATES.append(gate)
            if AUTO_RELEASE:
                gate.set()
        note=self.path[-2:]
        record({'event':'gate_received','id':note,'gate':index})
        released=gate.wait(12)
        self.reply(200 if released else 503,{'id':note,'title':'fake note '+note})
        record({'event':'gate_released','gate':index})


def link(path):
    adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','atlasrnlab:///'+path,'-p',PACKAGE)


def deny_permission_dialog(path):
    deadline=time.monotonic()+12
    while time.monotonic()<deadline:
        adb('shell','uiautomator','dump',path,seconds=8)
        xml=adb('shell','cat',path)
        tree=ET.fromstring(xml)
        for node in tree.iter('node'):
            resource=node.get('resource-id','')
            if resource.endswith(':id/permission_deny_button'):
                bounds=re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',node.get('bounds',''))
                if not bounds:
                    raise AssertionError('permission button bounds missing')
                left,top,right,bottom=map(int,bounds.groups())
                adb('shell','input','tap',str((left+right)//2),str((top+bottom)//2))
                return
        time.sleep(.15)  # Polls actual dialog; duration alone is never success.
    raise AssertionError('Android permission deny control never appeared')


def main():
    global AUTO_RELEASE
    if sys.platform!='linux' or os.environ.get('CI')!='true' or not re.fullmatch(r'emulator-\d+',SERIAL):
        raise SystemExit('explicit disposable Linux emulator only')
    if adb('shell','getprop','ro.kernel.qemu').strip()!='1':
        raise SystemExit('refuse a physical or unidentified device')
    if adb('shell','getprop','ro.product.cpu.abi').strip()!='x86_64':
        raise SystemExit('this artifact targets x86_64 emulator only')
    if adb('shell','pm','path',PACKAGE).strip():
        raise SystemExit('refuse to overwrite an existing lab application')
    signal.signal(signal.SIGTERM,lambda *_:(_ for _ in ()).throw(KeyboardInterrupt()))
    artifact=Path(os.environ['ATLAS_LAB_ARTIFACT_DIR'])
    apk=artifact/'atlas-rn-lab.apk'
    expected=json.loads((artifact/'build-report.json').read_text())['apk_sha256']
    assert hashlib.sha256(apk.read_bytes()).hexdigest()==expected
    server=Fixture(('127.0.0.1',4354),Handler)
    thread=threading.Thread(target=server.serve_forever);thread.start()
    ui_path='/sdcard/atlas-lab-'+uuid4().hex+'.xml'
    try:
        print(json.dumps({'emulator':SERIAL,'api':adb('shell','getprop','ro.build.version.sdk').strip(),
                          'abi':'x86_64','physical_device':False}),flush=True)
        adb('install','--no-streaming',str(apk),seconds=90)
        adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
        wait(event('list_mounted'))
        cursor=len(EVENTS)
        link('note/n1')
        _,held=wait(event('gate_received',id='n1'),after=cursor)
        link('')
        cursor,_=wait(event('screen_blur',id='n1'),after=cursor)
        GATES[held['gate']].set()
        wait(event('gate_released',gate=held['gate']))
        link('note/n2')
        _,fresh=wait(event('gate_received',id='n2'),after=cursor)
        GATES[fresh['gate']].set()
        wait(event('note_rendered',status='ready',id='n2'),after=cursor)
        assert not any(event('note_rendered',status='ready',id='n1')(row) for row in EVENTS[cursor:])
        print(json.dumps({'case':'native_navigation_and_late_result','old':'discarded','current':'n2'}),flush=True)
        cursor=len(EVENTS)
        adb('shell','input','keyevent','KEYCODE_HOME')
        wait(event('app_state',state='background'),after=cursor)
        wait(event('note_paused',id='n2'),after=cursor)
        with CONDITION:
            AUTO_RELEASE=True
        cursor=len(EVENTS)
        adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
        wait(event('app_state',state='active'),after=cursor)
        wait(event('note_rendered',status='ready',id='n2'),after=cursor)
        print(json.dumps({'case':'native_appstate','background_paused':True,'resume_loaded':True}),flush=True)
        cursor=len(EVENTS);link('note/n2?case=files')
        _,files=wait(event('capability_result',kind='files'),after=cursor)
        assert files['status']=='ok' and files['roundTrip'] and files['missingRejected']
        print(json.dumps({'case':'actual_native_files','result':files}),flush=True)
        cursor=len(EVENTS);link('note/n2?case=permission')
        wait(event('capability_started',kind='permission'),after=cursor)
        deny_permission_dialog(ui_path)
        _,permission=wait(event('capability_result',kind='permission'),after=cursor)
        assert permission['status']=='denied' and permission['granted'] is False
        print(json.dumps({'case':'actual_android_permission_denied','result':permission,'location_read':False}),flush=True)
        (artifact/'runtime-events.json').write_text(json.dumps(EVENTS,ensure_ascii=False,indent=2))
    except BaseException:
        print(adb('logcat','-d','-t','120',check=False)[-16000:],flush=True)
        (artifact/'runtime-events.json').write_text(json.dumps(EVENTS,ensure_ascii=False,indent=2))
        raise
    finally:
        for gate in GATES:
            gate.set()
        try:
            adb('shell','am','force-stop',PACKAGE,check=False)
            if adb('shell','pm','path',PACKAGE).strip():
                adb('uninstall',PACKAGE)
            assert not adb('shell','pm','path',PACKAGE).strip()
            adb('shell','rm','-f',ui_path,check=False)
        finally:
            server.shutdown();server.server_close();thread.join(timeout=3)
        assert not thread.is_alive()
        print(json.dumps({'cleanup':'own fake app uninstalled, fixture threads stopped','physical_device':False}),flush=True)


if __name__=='__main__':
    main()
