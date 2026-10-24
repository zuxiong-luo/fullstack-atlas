"""Two local fake-data builds; public template debug key, never store signing."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parent
PROFILES=[{'releaseId':'lab-v1','versionCode':1,'versionName':'1.0.0','schema':1,'channel':'local-lab'},
          {'releaseId':'lab-v2','versionCode':2,'versionName':'1.1.0','schema':1,'channel':'local-lab'}]


def run(arguments,cwd,*,env=None,seconds=120,check=True):
    result=subprocess.run(['timeout','--signal=TERM','--kill-after=30s',str(seconds)+'s',*arguments],
                          cwd=cwd,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    print(result.stdout,flush=True)
    if check and result.returncode:
        raise RuntimeError('lab command failed: '+arguments[0]+' exit '+str(result.returncode))
    return result


def main():
    if sys.platform!='linux' or os.environ.get('CI')!='true':
        raise SystemExit('disposable Linux CI required; no host SDK mutation')
    signal.signal(signal.SIGTERM,lambda *_:(_ for _ in ()).throw(KeyboardInterrupt()))
    sdk=Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT'])
    for relative in ['platforms/android-37.0','build-tools/37.0.0','ndk/27.1.12297006','cmake/3.30.5']:
        if not (sdk/relative).is_dir():raise RuntimeError('CI must preinstall '+relative)
    output=Path(os.environ['ATLAS_LAB_ARTIFACT_DIR']).resolve()
    if output.exists() and any(output.iterdir()):raise RuntimeError('new or empty artifact directory required')
    output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='atlas-lab-delivery-build-') as temporary:
        work=Path(temporary);project=work/'project'
        shutil.copytree(ROOT,project,ignore=shutil.ignore_patterns('node_modules','android','ios','.expo','dist','__pycache__','*.apk','*.aab'))
        environment=os.environ|{'CI':'true','EXPO_NO_TELEMETRY':'1','NODE_OPTIONS':'--max-old-space-size=2048',
          'GRADLE_USER_HOME':str(work/'gradle'),'EXPO_PUBLIC_LAB_REPORT_URL':'http://10.0.2.2:4355'}
        run(['node','--version'],project);run(['java','-version'],project)
        run(['npm','ci','--ignore-scripts','--no-fund','--audit=false'],project,env=environment,seconds=180)
        run(['npm','test'],project,env=environment)
        profile=project/'build-profile.json'
        profile.write_text(json.dumps(PROFILES[0]|{'versionCode':2}))
        bad=run(['npm','run','check'],project,env=environment,check=False)
        assert bad.returncode!=0
        print(json.dumps({'case':'bad_configuration_rejected_before_build','exit':bad.returncode}),flush=True)
        packed=run(['npm','pack','./node_modules/expo-template-bare-minimum','--ignore-scripts','--json','--pack-destination',str(work)],project,env=environment).stdout
        archive=work/json.loads(packed[packed.find('[\n'):])[0]['filename']
        records=[]
        for release in PROFILES:
            profile.write_text(json.dumps(release))
            run(['npm','run','check'],project,env=environment)
            run(['node','node_modules/expo/bin/cli','prebuild','--platform','android','--no-install',
                 '--template',str(archive),'--skip-dependency-update','react,react-native'],project,env=environment,seconds=180)
            gradle=project/'android/app/build.gradle'
            assert 'signingConfig signingConfigs.debug' in gradle.read_text()
            manifest=project/'android/app/src/main/AndroidManifest.xml'
            text=manifest.read_text()
            if 'android:usesCleartextTraffic=' not in text:text=text.replace('<application ','<application android:usesCleartextTraffic="true" ',1)
            else:text=re.sub(r'android:usesCleartextTraffic="[^"]*"','android:usesCleartextTraffic="true"',text)
            manifest.write_text(text)
            run(['./gradlew',':app:assembleRelease','--no-daemon','--max-workers=2','-PreactNativeArchitectures=x86_64',
                 '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m'],project/'android',env=environment,seconds=1500)
            apk=project/'android/app/build/outputs/apk/release/app-release.apk'
            source_map=project/'android/app/build/generated/sourcemaps/react/release/index.android.bundle.map'
            assert source_map.is_file() and 'controlled-error.js' in source_map.read_text()
            certificate=run([str(sdk/'build-tools/37.0.0/apksigner'),'verify','--verbose','--print-certs',str(apk)],project).stdout
            assert 'CN=Android Debug' in certificate
            digest=re.search(r'certificate SHA-256 digest: ([0-9a-f]+)',certificate).group(1)
            record=release|{'abi':'x86_64','apk_sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),
                            'map_sha256':hashlib.sha256(source_map.read_bytes()).hexdigest(),'certificate_sha256':digest}
            for source,extension in [(apk,'apk'),(source_map,'map')]:shutil.copy2(source,output/(release['releaseId']+'.'+extension))
            records.append(record);print(json.dumps({'case':'built_signed_pair_member',**record}),flush=True)
        assert records[0]['certificate_sha256']==records[1]['certificate_sha256']
        assert records[0]['apk_sha256']!=records[1]['apk_sha256']
        (output/'build-report.json').write_text(json.dumps({'artifacts':records},indent=2))
    print(json.dumps({'cleanup':'private native project and Gradle home removed','artifact_dir':str(output)}),flush=True)


if __name__=='__main__':main()
