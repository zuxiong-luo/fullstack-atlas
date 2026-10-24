"""Build a debug-key-signed, bundled Android lab APK in a disposable copy."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent


def run(arguments, cwd, *, env=None, seconds=120):
    result = subprocess.run(['timeout', '--signal=TERM', '--kill-after=30s', str(seconds)+'s', *arguments],
                            cwd=cwd, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    print(result.stdout, flush=True)
    if result.returncode:
        raise RuntimeError('lab command failed: '+arguments[0]+' exit '+str(result.returncode))
    return result.stdout


def main():
    if sys.platform != 'linux' or os.environ.get('CI') != 'true':
        raise SystemExit('disposable Linux CI required; no SDK mutation on this host')
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    sdk = Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT'])
    for relative in ['platforms/android-37.0', 'build-tools/37.0.0', 'ndk/27.1.12297006', 'cmake/3.30.5']:
        if not (sdk/relative).is_dir():
            raise RuntimeError('CI must preinstall SDK component: '+relative)
    output = Path(os.environ['ATLAS_LAB_ARTIFACT_DIR']).resolve()
    if output.exists() and any(output.iterdir()):
        raise RuntimeError('artifact directory must be new or empty')
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='atlas-lab-rn-build-') as temporary:
        work = Path(temporary); project = work/'project'
        shutil.copytree(ROOT, project, ignore=shutil.ignore_patterns('node_modules','android','ios','.expo','dist','__pycache__','*.apk','*.aab'))
        environment = os.environ | {'CI':'true','EXPO_NO_TELEMETRY':'1','NODE_OPTIONS':'--max-old-space-size=2048',
            'GRADLE_USER_HOME':str(work/'gradle'),'EXPO_PUBLIC_LAB_REPORT_URL':'http://10.0.2.2:4354'}
        run(['node','--version'], project)
        run(['java','-version'], project)
        run(['npm','ci','--ignore-scripts','--no-fund','--audit=false'], project, env=environment, seconds=180)
        run(['npm','run','check'], project, env=environment)
        run(['npm','test'], project, env=environment)
        packed = run(['npm','pack','./node_modules/expo-template-bare-minimum','--ignore-scripts','--json','--pack-destination',str(work)], project, env=environment)
        # npm warnings are written to stdout by the combined stream, so locate the JSON array.
        start = packed.find('[\n')
        archive = work/json.loads(packed[start:])[0]['filename']
        run(['node','node_modules/expo/bin/cli','prebuild','--platform','android','--no-install',
             '--template',str(archive),'--skip-dependency-update','react,react-native'], project, env=environment, seconds=180)
        gradle = project/'android/app/build.gradle'
        if 'signingConfig signingConfigs.debug' not in gradle.read_text():
            raise RuntimeError('only the public template debug signing key is allowed')
        manifest = project/'android/app/src/main/AndroidManifest.xml'
        text = manifest.read_text()
        if 'android:usesCleartextTraffic=' not in text:
            text=text.replace('<application ', '<application android:usesCleartextTraffic="true" ',1)
        else:
            import re
            text=re.sub(r'android:usesCleartextTraffic="[^"]*"','android:usesCleartextTraffic="true"',text)
        manifest.write_text(text)  # Only the disposable lab package reaches the loopback fixture.
        run(['./gradlew',':app:assembleRelease','--no-daemon','--max-workers=2',
             '-PreactNativeArchitectures=x86_64','-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m'],
             project/'android',env=environment,seconds=1500)
        apk = project/'android/app/build/outputs/apk/release/app-release.apk'
        shutil.copy2(apk,output/'atlas-rn-lab.apk')
        certificate = run([str(sdk/'build-tools/37.0.0/apksigner'),'verify','--verbose','--print-certs',str(apk)],project)
        if 'CN=Android Debug' not in certificate:
            raise RuntimeError('expected public Android Debug certificate, never production signing')
        report={'apk_sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'bytes':apk.stat().st_size,
                'abi':'x86_64','variant':'release bundle signed with public debug key',
                'node':'24.14.1','expo':'58.0.19','react_native':'0.88.0','certificate':certificate}
        (output/'build-report.json').write_text(json.dumps(report,indent=2))
        print(json.dumps(report),flush=True)
    print(json.dumps({'cleanup':'private native project and Gradle home removed','artifact_dir':str(output)}),flush=True)


if __name__ == '__main__':
    main()
