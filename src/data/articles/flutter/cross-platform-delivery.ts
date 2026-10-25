import type { Article } from '../../articleTypes';

const article: Article = {
  "id": "cross-platform-delivery",
  "topic": "flutter",
  "title": "跨平台交付：构建、签名、配置、升级与崩溃定位",
  "description": "以独立Android假笔记应用串起固定配置、Debug签名、双版本升级、持久数据与Hermes错误栈对应工件，明确跨平台交付边界。",
  "minutes": 90,
  "labMinutes": 50,
  "tags": [
    "跨平台",
    "Android",
    "构建",
    "签名",
    "升级",
    "错误定位"
  ],
  "scope": "Android x86_64单代表ABI，compileAPI37.0/target36/run36；本机JS/配置/资源已验，APK构建及API36 x86_64模拟器同证书升级/原生UI/数据保留/JS符号化/拒绝降级/清理完整通过。无实体手机/iOS/生产签名/商店/OTA实测。",
  "prerequisites": [
    "会阅读React函数组件、Promise与基础终端命令",
    "理解跨平台适配边界；Android实验独立下载，不要求先运行其他篇示例"
  ],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "Node24.14.1 / Expo58.0.19 / RN0.88.0 / React19.3.0",
    "template58.0.28 / metro-symbolicate0.87.1 / JDK17 / AGP9.2.1",
    "JS6/6、无SDK清理3/3、Android导出通过；APK及API36 x86_64模拟器完整验收通过（a834681/run40144174318）"
  ],
  "verifiedAt": "2026-10-25",
  "questionIds": [],
  "examples": [
    {
      "label": "完整独立工程ZIP",
      "path": "cross-platform-delivery.zip"
    },
    {
      "label": "版本、CI运行与验收范围",
      "path": "cross-platform-delivery/README.md"
    }
  ],
  "references": [
    {
      "title": "Expo58 Application：原生版本身份",
      "url": "https://docs.expo.dev/versions/v58.0.0/sdk/application/"
    },
    {
      "title": "Android：应用版本与降级保护",
      "url": "https://developer.android.com/studio/publish/versioning"
    },
    {
      "title": "Android：应用签名",
      "url": "https://developer.android.com/studio/publish/app-signing"
    },
    {
      "title": "Expo：构建与商店工件",
      "url": "https://docs.expo.dev/deploy/build-project/"
    },
    {
      "title": "RN官方发布调试概念参考；本例实现锁RN0.88",
      "url": "https://reactnative.dev/docs/debugging-release-builds"
    },
    {
      "title": "Expo58 FileSystem",
      "url": "https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/"
    },
    {
      "title": "Android AGP9.2兼容要求",
      "url": "https://developer.android.com/build/releases/agp-9-2-0-release-notes"
    },
    {
      "title": "实际API36模拟器完整验收：a834681",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40144174318/job/121021896614"
    }
  ],
  "sections": [
    {
      "id": "chain",
      "title": "交付要回答“这一份应用”由什么构成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "跨平台框架可以共享业务代码，交付却仍有平台自己的边界。Android有包名、版本号、ABI、签名证书和安装规则；iOS有bundle身份、构建号、签名与配置描述文件；Web通常把脚本和资源交给浏览器，缓存与服务端版本参与切换。桌面分发又有各自的安装器和签名机制。不能用一次JS导出成功替代这些不同平台的验证，也不能因为源码相同就把一个平台的升级结论外推给全部平台。"
        },
        {
          "type": "paragraph",
          "text": "本篇选择一条能独立运行的Android代表链：构建两个带内嵌JS的APK，以同一个教学证书升级，检查应用文档保留，再把捕获的JS错误栈对应回那一版源代码。两版都只处理本地假笔记，不接入账号和服务端。工程与前篇主题相连但代码独立；读者无需先启动导航示例，也不会借用另一个工程生成的二进制。"
        },
        {
          "type": "paragraph",
          "text": "实验的release配置让Hermes与资源随包安装，不依赖开发Metro服务器；证书仍是模板公开的Android Debug证书。它能用于一次性模拟器安装实验，却不具备生产签名可信度或商店上传条件。Android API36 x86_64是运行代表环境，编译平台API37.0、target36、包的版本号和笔记schema各有用途，不能合称为一个“应用版本”。"
        },
        {
          "type": "figure",
          "src": "/figures/cross-platform-delivery/artifacts.svg",
          "title": "源码、二进制、数据与错误栈各自的身份",
          "alt": "固定配置生成v1和v2的APK及map；同证书升级保留schema1假文档；v2错误必须选择v2对应map，错误版本先拒绝。",
          "caption": "图中升级只证明未变schema的假数据兼容；用公开Debug证书，不涉及生产签名与远程更新。"
        }
      ]
    },
    {
      "id": "identity",
      "title": "把公开配置写成可检查的契约",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "versionName给人阅读，versionCode参与Android升级与降级判断；releaseId是本例归档工件与错误事件的标识。三者建立固定映射：lab-v1对应code1/name1.0.0，lab-v2对应code2/name1.1.0。schema仍为1，表示本地文档格式没有改变。只改变JS常量而没有重建原生包时，显示出的字符串并不能证明设备已安装那一个版本。"
        },
        {
          "type": "code",
          "code": "const KEYS=['channel','releaseId','schema','versionCode','versionName'];\nfunction profile(value) {\n  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).sort().join(',')!==KEYS.join(',')) throw new Error('PROFILE_KEYS');\n  if (!['lab-v1','lab-v2'].includes(value.releaseId) || value.channel!=='local-lab' || value.schema!==1) throw new Error('PROFILE_SCOPE');\n  const expected=value.releaseId==='lab-v1'?{code:1,name:'1.0.0'}:{code:2,name:'1.1.0'};\n  if (value.versionCode!==expected.code || value.versionName!==expected.name) throw new Error('PROFILE_VERSION');\n  return Object.freeze({...value});\n}\nmodule.exports={profile};",
          "filename": "examples/cross-platform-delivery/profile.cjs",
          "purpose": "完整有限公开配置校验；未知字段、错版本、非本地渠道都在构建前拒绝。",
          "language": "javascript",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "const fs=require('node:fs');\nconst path=require('node:path');\nconst {profile}=require('./profile.cjs');\nmodule.exports=({config})=>{\n  const release=profile(JSON.parse(fs.readFileSync(path.join(__dirname,'build-profile.json'),'utf8')));\n  return {...config,version:release.versionName,android:{...config.android,versionCode:release.versionCode},\n    extra:{releaseId:release.releaseId,channel:release.channel}};\n};",
          "filename": "examples/cross-platform-delivery/app.config.cjs",
          "purpose": "实际Expo配置入口，将已校验的版本映射进原生Android配置。",
          "language": "javascript",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "profile只接收五个有限字段，没有服务端token或签名密码位置。把值写进前端构建变量并不会让它成为秘密：它可能进入JS、原生资源或source map。真正的生产凭据要由相应的受控签名流程管理；本例不要求读者创建密钥、开发者账号或上传任何商店。配置失败应在长时间原生编译之前暴露，因此构建脚本先故意组合lab-v1与code2，要求真实npm run check失败，再进入两个合法版本的构建。"
        },
        {
          "type": "reference",
          "title": "Android官方版本说明",
          "url": "https://developer.android.com/studio/publish/versioning",
          "note": "更高versionCode表示更新版本；它和面向用户的versionName分开。"
        }
      ]
    },
    {
      "id": "native",
      "title": "从原生包读取版本，避免把开发容器当成交付包",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Expo Application提供原生二进制里的build version与application version。应用启动时将它们和随包profile比较，只有二者一致才读写假笔记。在Expo Go等通用容器里运行JS时，原生版本身份属于容器，未必属于这个工程；守卫会返回NOT_THIS_STANDALONE_BUILD，而不是把容器启动记成独立APK验收。"
        },
        {
          "type": "code",
          "code": "import React from 'react';\nimport {View, Text, Button} from 'react-native';\nimport * as Application from 'expo-application';\nimport release from './build-profile.json';\nimport {existingOrSeeded} from './lib/notes';\nimport {controlledFailure} from './lib/controlled-error';\nimport {labBase, report} from './lib/report';\nexport default function App() {\n  const [state,setState]=React.useState({status:'loading'}),[error,setError]=React.useState(null);\n  function capture() {\n    try {controlledFailure();}\n    catch (caught) {\n      const stack=String(caught.stack).slice(0,12000);\n      setError({message:caught.message,stack});\n      report('controlled_js_error',{releaseId:release.releaseId,message:caught.message,stack});\n    }\n  }\n  React.useEffect(()=>{\n    let mounted=true;\n    (async()=>{\n      try {\n        const nativeCode=Application.nativeBuildVersion,nativeName=Application.nativeApplicationVersion;\n        if(nativeCode!==String(release.versionCode)||nativeName!==release.versionName)throw new Error('NOT_THIS_STANDALONE_BUILD');\n        const saved=await existingOrSeeded(release.releaseId);\n        const result={status:'ready',releaseId:release.releaseId,nativeCode,nativeName,...saved};\n        if(mounted)setState(result);\n      } catch(caught) {if(mounted)setState({status:'error',code:caught.message});}\n    })();\n    return()=>{mounted=false;};\n  },[]);\n  React.useEffect(()=>{\n    if(state.status==='ready'){\n      report('delivery_rendered',state);\n      if(labBase&&release.releaseId==='lab-v2')capture();\n    } else if(state.status==='error')report('delivery_error',state);\n  },[state]);\n  return <View style={{padding:24,gap:16}}><Text>仅本地假数据交付实验，无生产签名或商店上传。</Text>\n    <Text testID=\"delivery-state\">{JSON.stringify(state)}</Text><Button title=\"捕获一个教学JS错误并保留栈\" onPress={capture}/>\n    <Text>{error?JSON.stringify(error):'尚未触发错误；捕获后应用仍运行。'}</Text>\n  </View>;\n}",
          "filename": "examples/cross-platform-delivery/App.jsx",
          "purpose": "完整应用入口：校验原生身份、载入假笔记、报告提交状态，并捕获一个受控JS错误。",
          "language": "jsx",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "这里的report只在编译了专用本机实验URL时启用，事件队列有容量和超时，不接收生产账号。delivery_rendered从React effect发出，证明应用进程执行到了提交后的逻辑；它本身不是屏幕像素证据。模拟器脚本会另读原生UI层级里的JSON Text，并保存屏幕PNG。两个观察层相互补充，不能把自己上报“成功”当成完整安装、显示和数据验收。"
        },
        {
          "type": "reference",
          "title": "Expo58 Application固定版本文档",
          "url": "https://docs.expo.dev/versions/v58.0.0/sdk/application/",
          "note": "Android nativeBuildVersion返回字符串，映射原生versionCode；不能拿Web的null或开发容器身份作本包版本。"
        }
      ]
    },
    {
      "id": "data",
      "title": "同证书升级与本地数据兼容，需要分别观察",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "相同包名并不自动意味着可以升级：Android还检查签名与版本关系。构建报告记录两版证书摘要，并要求它们相同；安装时使用install -r让系统走替换安装路径。脚本在安装前拒绝已有同包名应用，避免覆盖读者或其他实验留下的状态；只允许在明确的一次性模拟器中新建自己的假包。"
        },
        {
          "type": "code",
          "code": "import {File, Paths} from 'expo-file-system';\nexport async function existingOrSeeded(releaseId) {\n  const file=new File(Paths.document,'atlas-delivery-fake-note.json');\n  let created=false;\n  if (!file.exists) {\n    file.write(JSON.stringify({schema:1,title:'fake note persisted by '+releaseId}));\n    created=true;\n  }\n  const note=JSON.parse(await file.text());\n  if (note.schema!==1 || typeof note.title!=='string' || note.title.length>120) throw new Error('UNSUPPORTED_LOCAL_SCHEMA');\n  return {note,created};\n}",
          "filename": "examples/cross-platform-delivery/lib/notes.js",
          "purpose": "完整持久假文档：v1首次创建，v2读回原文；未知schema失败，不覆盖旧文件。",
          "language": "javascript",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "假笔记放在应用document目录，第一次创建的标题包含lab-v1。升级后必须看到nativeCode2、created=false，同时笔记标题仍来自v1。这个断言比“v2能打开”更具体：它能区分读到旧数据与重新生成看似相同的新数据。不过schema始终是1，没有执行任何数据迁移，所以不能声称证明了任意升级或降级安全。若未来改变schema，应先设计前后兼容与迁移失败策略，并保存可恢复的数据。"
        },
        {
          "type": "paragraph",
          "text": "实验最后尝试不带降级许可安装v1，必须得到INSTALL_FAILED_VERSION_DOWNGRADE，再重新启动确认仍是code2和旧假笔记。任意非零安装结果并不算这个负例通过，因为连接断开、存储不足也会失败。卸载则是不同操作，会清掉本包的假数据；它只用于实验结束清理，不能当作生产回滚方案。"
        }
      ]
    },
    {
      "id": "build",
      "title": "固定工具链，在私有目录构建两份可追溯工件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Node24.14.1、Expo58.0.19、RN0.88.0、React19.3.0以及原生依赖按完整package-lock安装，原生工程由固定template58.0.28的本地tar生成。AGP9.2.1与Gradle9.4.1来自这套锁，JDK17、build-tools37.0.0、NDK27.1.12297006和CMake3.30.5由一次性Linux CI预装。脚本不在用户macOS上安装SDK，也不随意降低compileSdk绕过原生库的要求。"
        },
        {
          "type": "code",
          "code": "{\"name\":\"atlas-cross-platform-delivery\",\"version\":\"1.0.0\",\"private\":true,\"type\":\"module\",\"main\":\"index.js\",\"engines\":{\"node\":\"24.14.1\"},\"scripts\":{\"start\":\"expo start\",\"test\":\"node --test test.mjs\",\"check\":\"node verify-config.mjs\",\"export:android\":\"expo export --platform android --source-maps --output-dir dist\"},\"dependencies\":{\"expo\":\"58.0.19\",\"react\":\"19.3.0\",\"react-dom\":\"19.3.0\",\"react-native\":\"0.88.0\",\"expo-file-system\":\"58.0.11\",\"expo-application\":\"58.1.2\"},\"devDependencies\":{\"expo-template-bare-minimum\":\"58.0.28\",\"metro-symbolicate\":\"0.87.1\"}}",
          "filename": "examples/cross-platform-delivery/package.json",
          "purpose": "完整入口和精确依赖；npm ci使用下载包中已有的传递锁。",
          "language": "json",
          "kind": "runnable"
        },
        {
          "type": "code",
          "filename": "终端",
          "code": "npm ci --ignore-scripts --no-fund\nnpm test\nnpm run check\nnpm run export:android",
          "purpose": "本目录使用Node24.14.1；source-maps导出只验证JS/资源链，尚未安装APK。",
          "kind": "runnable",
          "language": "bash"
        },
        {
          "type": "code",
          "code": "\"\"\"Two local fake-data builds; public template debug key, never store signing.\"\"\"\nimport hashlib\nimport json\nimport os\nfrom pathlib import Path\nimport re\nimport shutil\nimport signal\nimport subprocess\nimport sys\nimport tempfile\n\nROOT=Path(__file__).resolve().parent\nPROFILES=[{'releaseId':'lab-v1','versionCode':1,'versionName':'1.0.0','schema':1,'channel':'local-lab'},\n          {'releaseId':'lab-v2','versionCode':2,'versionName':'1.1.0','schema':1,'channel':'local-lab'}]\n\n\ndef run(arguments, cwd, *, env=None, seconds=120, check=True):\n    # Own a session, not a timeout wrapper: interrupting Python must reap its command tree.\n    process = subprocess.Popen(arguments, cwd=cwd, env=env, text=True,\n                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT,\n                               start_new_session=True)\n    def stop_group(sig):\n        try:\n            os.killpg(process.pid, sig)\n        except ProcessLookupError:\n            pass\n    try:\n        output, _ = process.communicate(timeout=seconds)\n    except BaseException:\n        stop_group(signal.SIGTERM)\n        try:\n            output, _ = process.communicate(timeout=5)\n        except subprocess.TimeoutExpired:\n            stop_group(signal.SIGKILL)\n            output, _ = process.communicate(timeout=5)\n        finally:\n            # A leader can exit before a descendant that no longer owns the output pipe.\n            stop_group(signal.SIGKILL)\n            process.wait(timeout=5)\n        print(output, flush=True)\n        raise\n    else:\n        # Successful commands also cannot leave a background member of this owned group.\n        stop_group(signal.SIGKILL)\n    print(output, flush=True)\n    result = subprocess.CompletedProcess(arguments, process.returncode, output)\n    if check and result.returncode:\n        raise RuntimeError('lab command failed: '+arguments[0]+' exit '+str(result.returncode))\n    return result\n\n\ndef main():\n    if sys.platform!='linux' or os.environ.get('CI')!='true':\n        raise SystemExit('disposable Linux CI required; no host SDK mutation')\n    signal.signal(signal.SIGTERM,lambda *_:(_ for _ in ()).throw(KeyboardInterrupt()))\n    sdk=Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT'])\n    for relative in ['platforms/android-37.0','build-tools/37.0.0','ndk/27.1.12297006','cmake/3.30.5']:\n        if not (sdk/relative).is_dir():raise RuntimeError('CI must preinstall '+relative)\n    output=Path(os.environ['ATLAS_LAB_ARTIFACT_DIR']).resolve()\n    if output.exists() and any(output.iterdir()):raise RuntimeError('new or empty artifact directory required')\n    output.mkdir(parents=True,exist_ok=True)\n    with tempfile.TemporaryDirectory(prefix='atlas-lab-delivery-build-') as temporary:\n        work=Path(temporary);project=work/'project'\n        shutil.copytree(ROOT,project,ignore=shutil.ignore_patterns('node_modules','android','ios','.expo','dist','__pycache__','*.apk','*.aab'))\n        environment=os.environ|{'CI':'true','EXPO_NO_TELEMETRY':'1','NODE_OPTIONS':'--max-old-space-size=2048',\n          'GRADLE_USER_HOME':str(work/'gradle'),'EXPO_PUBLIC_LAB_REPORT_URL':'http://10.0.2.2:4355'}\n        run(['node','--version'],project);run(['java','-version'],project)\n        run(['npm','ci','--ignore-scripts','--no-fund','--audit=false'],project,env=environment,seconds=180)\n        run(['npm','test'],project,env=environment)\n        profile=project/'build-profile.json'\n        profile.write_text(json.dumps(PROFILES[0]|{'versionCode':2}))\n        bad=run(['npm','run','check'],project,env=environment,check=False)\n        assert bad.returncode!=0\n        print(json.dumps({'case':'bad_configuration_rejected_before_build','exit':bad.returncode}),flush=True)\n        packed=run(['npm','pack','./node_modules/expo-template-bare-minimum','--ignore-scripts','--json','--pack-destination',str(work)],project,env=environment).stdout\n        archive=work/json.loads(packed[packed.find('[\\n'):])[0]['filename']\n        records=[]\n        for release in PROFILES:\n            profile.write_text(json.dumps(release))\n            run(['npm','run','check'],project,env=environment)\n            run(['node','node_modules/expo/bin/cli','prebuild','--platform','android','--no-install',\n                 '--template',str(archive),'--skip-dependency-update','react,react-native'],project,env=environment,seconds=180)\n            gradle=project/'android/app/build.gradle'\n            assert 'signingConfig signingConfigs.debug' in gradle.read_text()\n            manifest=project/'android/app/src/main/AndroidManifest.xml'\n            text=manifest.read_text()\n            if 'android:usesCleartextTraffic=' not in text:text=text.replace('<application ','<application android:usesCleartextTraffic=\"true\" ',1)\n            else:text=re.sub(r'android:usesCleartextTraffic=\"[^\"]*\"','android:usesCleartextTraffic=\"true\"',text)\n            manifest.write_text(text)\n            run(['./gradlew',':app:assembleRelease','--no-daemon','--max-workers=2','-PreactNativeArchitectures=x86_64',\n                 '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m'],project/'android',env=environment,seconds=1500)\n            apk=project/'android/app/build/outputs/apk/release/app-release.apk'\n            source_map=project/'android/app/build/generated/sourcemaps/react/release/index.android.bundle.map'\n            assert source_map.is_file() and 'controlled-error.js' in source_map.read_text()\n            certificate=run([str(sdk/'build-tools/37.0.0/apksigner'),'verify','--verbose','--print-certs',str(apk)],project).stdout\n            assert 'CN=Android Debug' in certificate\n            digest=re.search(r'certificate SHA-256 digest: ([0-9a-f]+)',certificate).group(1)\n            record=release|{'abi':'x86_64','apk_sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),\n                            'map_sha256':hashlib.sha256(source_map.read_bytes()).hexdigest(),'certificate_sha256':digest}\n            for source,extension in [(apk,'apk'),(source_map,'map')]:shutil.copy2(source,output/(release['releaseId']+'.'+extension))\n            records.append(record);print(json.dumps({'case':'built_signed_pair_member',**record}),flush=True)\n        assert records[0]['certificate_sha256']==records[1]['certificate_sha256']\n        assert records[0]['apk_sha256']!=records[1]['apk_sha256']\n        (output/'build-report.json').write_text(json.dumps({'artifacts':records},indent=2))\n    print(json.dumps({'cleanup':'private native project and Gradle home removed','artifact_dir':str(output)}),flush=True)\n\n\nif __name__=='__main__':main()",
          "filename": "examples/cross-platform-delivery/build_android.py",
          "purpose": "完整隔离构建脚本：先失败配置，再双版本构建、Debug证书核对、APK/map校验及私有目录清理。",
          "language": "python",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "输出目录必须新建或空，防止把上一轮APK与本轮map混在一起。两个版本共用本轮私有Gradle home以复用下载，但它不进入用户全局缓存。编译命令用release变体和单一x86_64 ABI；这项范围是为了让代表实验可运行，不能推导其他ABI已经编译。HTTP明文许可也只写入私有生成manifest，服务端只承载本机假事件。"
        },
        {
          "type": "paragraph",
          "text": "初次CI的SDK安装名android-37不存在，查询官方包索引后确认精确名称为platforms;android-37.0。只修包名和目录预检，不创建symlink、不改变原生约束。安装阶段失败与应用编译失败属于不同层；目前精确SDK安装已成功，b35dee2快照的两版APK、组合map与Debug证书检查已在隔离CI通过，9280模拟器步骤曾失败但首错未完整保留；5f53573明确为首次启动等待事件为空；a834681复用同一9280 APK/map，加harness诊断后完整模拟器链通过。这两轮失败的原因尚未确定，不能归因Metro。"
        }
      ]
    },
    {
      "id": "stack",
      "title": "错误栈必须和产生它的那一版map配对",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "release构建经过Metro打包与Hermes处理后，运行栈的位置通常不能直接当成原始JS文件行号。source map保存变换前后的映射；本例保留Gradle输出的Hermes组合map，并将其SHA256与对应APK摘要一起归档。若应用代码、压缩结果或编译输入变化，拿另一份map得到的行号可能似是而非，不能因为符号化工具退出0就确信定位正确。"
        },
        {
          "type": "code",
          "code": "export function controlledFailure() {\n  // A caught teaching error, not a native process crash or a production report.\n  throw new Error('ATLAS_CONTROLLED_JS_FAILURE');\n}",
          "filename": "examples/cross-platform-delivery/lib/controlled-error.js",
          "purpose": "完整受控故障：命名函数抛JS Error，由App捕获，应用继续运行。",
          "language": "javascript",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {join} from 'node:path';\nexport async function verifyArtifact(directory,releaseId) {\n  assert.ok(['lab-v1','lab-v2'].includes(releaseId),'finite release identity');\n  const records=JSON.parse(await readFile(join(directory,'build-report.json'),'utf8')).artifacts;\n  const record=records.find(row=>row.releaseId===releaseId);assert.ok(record,'release record required');\n  for(const extension of ['apk','map']){\n    const bytes=await readFile(join(directory,releaseId+'.'+extension));\n    assert.equal(createHash('sha256').update(bytes).digest('hex'),record[extension+'_sha256'],'artifact checksum '+extension);\n  }\n  return record;\n}",
          "filename": "examples/cross-platform-delivery/verify-artifact.mjs",
          "purpose": "完整工件误配检查：release选择有限，APK和map都按实际字节校验。",
          "language": "javascript",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';\nimport {verifyArtifact} from './verify-artifact.mjs';\nconst require=createRequire(import.meta.url),[directory,selectedRelease]=process.argv.slice(2);\nconst error=JSON.parse(await readFile(join(directory,'caught-error.json'),'utf8'));\nassert.equal(error.releaseId,selectedRelease,'MAP_RELEASE_MISMATCH');\nawait verifyArtifact(directory,selectedRelease);\nconst result=execFileSync(process.execPath,[require.resolve('metro-symbolicate'),join(directory,selectedRelease+'.map')],{input:error.stack,encoding:'utf8',timeout:15000});\nassert.ok(result.includes('controlled-error.js')&&result.includes('controlledFailure'),'original controlled function and source required');\nawait writeFile(join(directory,'symbolicated.txt'),result);\nconsole.log(result);",
          "filename": "examples/cross-platform-delivery/symbolicate.mjs",
          "purpose": "完整符号化调用：先校验事件release与工件，再将真实栈交给锁定Metro工具。",
          "language": "javascript",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "自动化先用v2错误事件选择v1，要求在MAP_RELEASE_MISMATCH处拒绝；随后选择v2，要求结果包含controlledFailure与controlled-error.js。错版本的负例是在元数据层阻止误用，并不意味着算法能自动辨认任意错误map。SHA256同样用于防工件意外混放；如果攻击者能同时改包、map和报告，它不提供独立的真实性担保。"
        },
        {
          "type": "paragraph",
          "text": "这个错误被JS try/catch捕获，进程没有崩溃，正文因此只验证JS错误定位链。Android native崩溃需要对应原生符号与tombstone，iOS原生崩溃涉及匹配的dSYM等工件；本实验没有生成或验证它们。source map可能携带源码和路径，真实项目应决定访问与保留策略，本例仅含公开教学代码。"
        }
      ]
    },
    {
      "id": "execute",
      "title": "让正常、失败、清理成为一条有截止时间的实验",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "filename": "终端",
          "code": "CI=true ATLAS_LAB_EMULATOR_SERIAL=emulator-5554 \\\nATLAS_LAB_ARTIFACT_DIR=\"$RUNNER_TEMP/atlas-delivery-artifacts\" \\\nbash ./verify-android.sh",
          "purpose": "在本示例根目录执行（ZIP解压后进入cross-platform-delivery）；一次性Linux runner，专用API36 x86_64模拟器。加ATLAS_LAB_BUILD_ONLY=1只证明构建，不执行下面的安装链。",
          "kind": "runnable",
          "language": "bash"
        },
        {
          "type": "paragraph",
          "text": "构建入口为每个命令创建自有进程组，内部截止或外部TERM先终止该组，再有限等待并KILL、回收。独立审稿实际复现了旧版GNU timeout嵌套结构会留下子进程，修后用忽略TERM的自有安全子进程验证内部超时与外部信号两条路径。清理不能只终止超时包装器后就宣布完成，也不能把SIGKILL或主机断电纳入finally保证。"
        },
        {
          "type": "paragraph",
          "text": "模拟器入口先检查Linux/CI、明确emulator序号、qemu标识与ABI，再安装自己的新包。HTTP报告夹具仅loopback，连接有3秒超时、事件有有限容量；关闭时停接入并等待非daemon请求线程退出。部分POST回归确认server_close确实收口请求线程。ADB、UI层级和事件等待各有超时，依赖条件被满足才推进，不能用sleep一段时间作为成功证据。"
        },
        {
          "type": "paragraph",
          "text": "结束时只force-stop和卸载本轮新建的com.atlaslab.delivery，删除自己的UI XML，关闭夹具线程；指定artifact目录保留APK、map、报告、错误栈和截图。build-only不会假称安装、升级或符号化已通过。若已有同轮工件，可依README单独执行模拟器入口，仍需同样的隔离守卫和锁依赖。"
        }
      ]
    },
    {
      "id": "limits",
      "title": "按验证层次阅读当前结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "本机已通过6项配置与hash纯JS测试、精确依赖检查、Android Metro/Hermes及source-map导出，并完成两套构建器的3项无SDK清理回归。纯JS的hash样例是有限字节契约，不是有效APK。旧快照b35dee2已实际完成双版本APK/map/证书构建；a834681/run40144174318在API36 x86_64模拟器完整通过同证书升级、原生UI层级、旧文档保留、真实JS栈符号化、错map拒绝、拒绝降级及清理。它复用9280原APK/map，App和构建输入未改，只加入独立harness诊断。9280模拟器步骤失败但首错未完整保留，5f53573明确为首次启动EVENTS为空；失败原因仍未证明，不能把成功归因为修复了Metro。"
        },
        {
          "type": "reference",
          "title": "API36实际模拟器验收记录",
          "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40144174318/job/121021896614",
          "note": "a834681复用9280工件；只证明该单一代表环境，不把模拟器写成实体手机。"
        },
        {
          "type": "paragraph",
          "text": "当前npm audit仍有6项high，涉及node-forge、Zod及Expo CLI/模板上游链；完整报告随工程保留，没有用不兼容major override清空告警。模板公开Debug证书也没有生产安全意义。工程没有商店上传、远程热更新或生产密钥操作；不能把这个本地升级实验称为OTA回滚验收。"
        },
        {
          "type": "paragraph",
          "text": "读者应能把一次交付分解成公开配置、原生身份、证书、工件摘要、本地数据格式和错误符号之间的对应关系，再对每一层索取实际证据。迁移到iOS、Web或桌面时可以沿用这套提问方式，但必须替换该平台的工具和验收条件，重新获得构建与运行结果。"
        }
      ]
    }
  ]
};

export default article;
