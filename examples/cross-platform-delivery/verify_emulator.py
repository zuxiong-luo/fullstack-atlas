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
import xml.etree.ElementTree as ET
import zipfile
from uuid import uuid4

ROOT=Path(__file__).resolve().parent
PACKAGE='com.atlaslab.delivery'
SERIAL=os.environ.get('ATLAS_LAB_EMULATOR_SERIAL','')
EVENTS=[]
CONDITION=threading.Condition()


def adb(*arguments,check=True,seconds=25):
    result=subprocess.run(['adb','-s',SERIAL,*arguments],capture_output=True,text=True,timeout=seconds)
    if check and result.returncode:raise RuntimeError(result.stdout+result.stderr)
    return result


def installed():
    return 'package:'+PACKAGE in adb('shell','pm','list','packages',PACKAGE).stdout.splitlines()


def wait(name,release,after=0):
    deadline=time.monotonic()+30
    with CONDITION:
        while True:
            for row in EVENTS[after:]:
                if row.get('event')==name and row.get('releaseId')==release:return row
            remaining=deadline-time.monotonic()
            if remaining<=0:raise AssertionError('delivery event missing: '+json.dumps(EVENTS[-8:]))
            CONDITION.wait(remaining)


class Fixture(ThreadingHTTPServer):
    daemon_threads = False
    block_on_close = True


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


def native_ui_state(path, expected, screenshot):
    deadline=time.monotonic()+12
    while time.monotonic()<deadline:
        adb('shell','uiautomator','dump',path,seconds=8)
        tree=ET.fromstring(adb('shell','cat',path).stdout)
        for node in tree.iter('node'):
            raw=node.get('text','')
            if not raw.startswith('{'):continue
            try:value=json.loads(raw)
            except ValueError:continue
            if all(value.get(key)==item for key,item in expected.items()):
                result=subprocess.run(['adb','-s',SERIAL,'exec-out','screencap','-p'],capture_output=True,timeout=15,check=True)
                assert result.stdout.startswith(b'\x89PNG\r\n\x1a\n')
                screenshot.write_bytes(result.stdout)
                return value
        time.sleep(.15)
    raise AssertionError('native hierarchy state missing: '+json.dumps(expected))


def apk_report_probe(apk):
    with zipfile.ZipFile(apk) as archive:
        bundles=[name for name in archive.namelist() if name.startswith('assets/') and name.endswith(('.bundle','.hbc'))]
        values=[]
        for name in bundles:
            data=archive.read(name)
            values.append({'entry':name,'bytes':len(data),
                           'report_url_literal':b'http://10.0.2.2:4355' in data,
                           'report_marker_literal':b'ATLAS_DELIVERY_LAB' in data})
    print(json.dumps({'case':'retained_apk_bundle_probe','bundles':values}),flush=True)


def startup_diagnostics(output, ui_path):
    # Independent observations of this disposable emulator; never replace the original error.
    result={}
    def capture(key, arguments, limit=8000):
        try:
            value=adb(*arguments,check=False,seconds=8)
            result[key]={'exit':value.returncode,'text':(value.stdout+value.stderr)[-limit:]}
        except Exception as error:
            result[key]={'diagnostic_error':type(error).__name__+': '+str(error)}
    capture('pid',['shell','pidof',PACKAGE],1000)
    capture('focused_activity',['shell','dumpsys','activity','activities'],32000)
    if 'text' in result['focused_activity']:
        result['focused_activity']['text']='\n'.join(line for line in result['focused_activity']['text'].splitlines()
            if PACKAGE in line or any(key in line for key in ['mResumedActivity','topResumedActivity','mFocusedApp']))[-3000:]
    capture('js_and_crash',['logcat','-d','-v','brief','-t','600','ReactNativeJS:V','AndroidRuntime:V','libc:F','*:S'],12000)
    pid=result.get('pid',{}).get('text','').strip()
    if re.fullmatch(r'\d+',pid):
        capture('own_process_log',['logcat','-d','--pid='+pid,'-v','brief','-t','160'],10000)
    request_body=json.dumps({'event':'harness_transport_probe'}).encode()
    request=(b'POST /events HTTP/1.0\r\nHost: 10.0.2.2\r\nContent-Type: application/json\r\nContent-Length: '
             +str(len(request_body)).encode()+b'\r\n\r\n'+request_body)
    try:
        transport=subprocess.run(['adb','-s',SERIAL,'shell','toybox','nc','-w','3','10.0.2.2','4355'],
                                 input=request,capture_output=True,timeout=8)
        result['emulator_transport_probe']={'exit':transport.returncode,
            'response':(transport.stdout+transport.stderr).decode(errors='replace')[:1200]}
    except Exception as error:
        result['emulator_transport_probe']={'diagnostic_error':type(error).__name__+': '+str(error)}
    capture('ui_dump',['shell','uiautomator','dump',ui_path],1000)
    capture('ui_xml',['shell','cat',ui_path],30000)
    raw=result.get('ui_xml',{}).get('text','')
    try:
        result['visible_text']=[node.get('text') for node in ET.fromstring(raw).iter('node') if node.get('text')][:40]
    except (ValueError,ET.ParseError):
        pass
    try:
        image=subprocess.run(['adb','-s',SERIAL,'exec-out','screencap','-p'],capture_output=True,timeout=10,check=True)
        if image.stdout.startswith(b'\x89PNG\r\n\x1a\n'):
            (output/'startup-failure.png').write_bytes(image.stdout)
    except Exception as error:
        result['screenshot_error']=type(error).__name__+': '+str(error)
    (output/'startup-diagnostics.json').write_text(json.dumps(result,indent=2))
    summary={key:value for key,value in result.items() if key not in ['ui_xml','visible_text']}
    summary['visible_text_excerpt']=json.dumps(result.get('visible_text',[]),ensure_ascii=False)[:1800]
    for key in ['js_and_crash','own_process_log','focused_activity']:
        if key in summary and 'text' in summary[key]:
            value=summary[key]['text']
            summary[key]={**summary[key],'text':value[:1800]+('\n...\n'+value[-1500:] if len(value)>1800 else '')}
    print(json.dumps({'case':'independent_startup_diagnostics','observations':summary}),flush=True)


def main():
    if sys.platform!='linux' or os.environ.get('CI')!='true' or not re.fullmatch(r'emulator-\d+',SERIAL):
        raise SystemExit('explicit disposable Linux emulator only')
    if adb('shell','getprop','ro.kernel.qemu').stdout.strip()!='1':raise SystemExit('refuse physical or unidentified device')
    if adb('shell','getprop','ro.product.cpu.abi').stdout.strip()!='x86_64':raise SystemExit('x86_64 artifact only')
    if installed():raise SystemExit('refuse existing application')
    signal.signal(signal.SIGTERM,lambda *_:(_ for _ in ()).throw(KeyboardInterrupt()))
    output=Path(os.environ['ATLAS_LAB_ARTIFACT_DIR'])
    records=json.loads((output/'build-report.json').read_text())['artifacts']
    assert [r['releaseId'] for r in records]==['lab-v1','lab-v2']
    for row in records:
        for extension in ['apk','map']:
            assert hashlib.sha256((output/(row['releaseId']+'.'+extension)).read_bytes()).hexdigest()==row[extension+'_sha256']
    assert records[0]['certificate_sha256']==records[1]['certificate_sha256']
    server=Fixture(('127.0.0.1',4355),Handler)
    thread=threading.Thread(target=server.serve_forever);thread.start()
    ui_path='/sdcard/atlas-lab-'+uuid4().hex+'.xml'
    try:
        print(json.dumps({'emulator':SERIAL,'api':adb('shell','getprop','ro.build.version.sdk').stdout.strip(),
                          'abi':'x86_64','physical_device':False}),flush=True)
        apk_report_probe(output/'lab-v1.apk')
        adb('install','--no-streaming',str(output/'lab-v1.apk'),seconds=90)
        launched=adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
        print(json.dumps({'case':'native_launch_command','stdout':launched.stdout,'stderr':launched.stderr}),flush=True)
        first=wait('delivery_rendered','lab-v1')
        assert first['nativeCode']=='1' and first['created'] is True
        assert first['note']=={'schema':1,'title':'fake note persisted by lab-v1'}
        native_ui_state(ui_path,{'status':'ready','releaseId':'lab-v1','nativeCode':'1'},output/'native-ui-v1.png')
        adb('shell','am','force-stop',PACKAGE)
        cursor=len(EVENTS)
        adb('install','-r','--no-streaming',str(output/'lab-v2.apk'),seconds=90)
        adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
        second=wait('delivery_rendered','lab-v2',after=cursor)
        assert second['nativeCode']=='2' and second['nativeName']=='1.1.0' and second['created'] is False
        assert second['note']==first['note']
        native_ui_state(ui_path,{'status':'ready','releaseId':'lab-v2','nativeCode':'2'},output/'native-ui-v2.png')
        error=wait('controlled_js_error','lab-v2',after=cursor)
        assert error['message']=='ATLAS_CONTROLLED_JS_FAILURE'
        (output/'caught-error.json').write_text(json.dumps(error))
        wrong=subprocess.run(['node',str(ROOT/'symbolicate.mjs'),str(output),'lab-v1'],capture_output=True,text=True,timeout=20)
        assert wrong.returncode!=0 and 'MAP_RELEASE_MISMATCH' in wrong.stderr
        correct=subprocess.run(['node',str(ROOT/'symbolicate.mjs'),str(output),'lab-v2'],capture_output=True,text=True,timeout=20)
        print(correct.stdout+correct.stderr,flush=True)
        assert correct.returncode==0 and 'controlled-error.js' in correct.stdout and 'controlledFailure' in correct.stdout
        print(json.dumps({'case':'signed_upgrade_and_js_symbolication','data_retained':True,'native_version':'2',
                          'same_debug_certificate':True,'native_ui_hierarchy':True,'wrong_release_map_rejected':True,'native_process_crash':False}),flush=True)
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
        (output/'runtime-events.json').write_text(json.dumps(EVENTS,indent=2))
        try:
            startup_diagnostics(output,ui_path)
        except Exception as diagnostic_error:
            print(json.dumps({'diagnostic_error':type(diagnostic_error).__name__+': '+str(diagnostic_error)}),flush=True)
        raise
    finally:
        try:
            adb('shell','am','force-stop',PACKAGE,check=False)
            if installed():adb('uninstall',PACKAGE)
            assert not installed()
            adb('shell','rm','-f',ui_path,check=False)
        finally:
            server.shutdown();server.server_close();thread.join(timeout=3)
        assert not thread.is_alive()
        print(json.dumps({'cleanup':'own fake app uninstalled and local fixture stopped','physical_device':False}),flush=True)


if __name__=='__main__':main()
