import type { Article } from '../../articleTypes';

const article: Article = {
  "id": "react-native-engineering",
  "topic": "flutter",
  "title": "React Native 应用工程：导航、生命周期与原生能力",
  "description": "以Android代表环境连接文件路由、前后台资格、加载代际与原生文件/权限失败，交付可隔离构建及模拟器自动验收入口。",
  "minutes": 80,
  "labMinutes": 50,
  "tags": [
    "React Native",
    "Expo",
    "导航",
    "生命周期",
    "原生能力"
  ],
  "scope": "Android API36 x86_64模拟器代表链；compileAPI37.0/target36。JS、预生成、Metro、APK与9280模拟器完整验收已通过；不覆盖实体手机/iOS。",
  "prerequisites": [
    "会阅读React函数组件、Promise与基础终端命令",
    "理解跨平台适配边界；Android实验独立下载，不要求先运行其他篇示例"
  ],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "Node24.14.1 / Expo58.0.19 / RN0.88.0 / React19.3.0",
    "Expo官方bundled与template58.0.28固定",
    "CPU12/12、清理3/3、配置/Metro、API36模拟器完整通过（9280/run40142096678）"
  ],
  "verifiedAt": "2026-10-25",
  "questionIds": [],
  "examples": [
    {
      "label": "完整独立工程ZIP",
      "path": "react-native-engineering.zip"
    },
    {
      "label": "版本、CI运行与验收范围",
      "path": "react-native-engineering/README.md"
    }
  ],
  "references": [
    {
      "title": "Expo SDK58：版本与平台要求",
      "url": "https://docs.expo.dev/versions/v58.0.0/"
    },
    {
      "title": "React Native0.88：AppState锁定源码",
      "url": "https://github.com/react/react-native/blob/v0.88.0/packages/react-native/Libraries/AppState/AppState.js"
    },
    {
      "title": "Expo58 Router：文件路由",
      "url": "https://docs.expo.dev/versions/v58.0.0/sdk/router/"
    },
    {
      "title": "Expo58 FileSystem：应用文件接口",
      "url": "https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/"
    },
    {
      "title": "Expo58 Location：权限与原生配置",
      "url": "https://docs.expo.dev/versions/v58.0.0/sdk/location/"
    },
    {
      "title": "Android AGP9.2：兼容版本",
      "url": "https://developer.android.com/build/releases/agp-9-2-0-release-notes"
    },
    {
      "title": "Google官方SDK包索引",
      "url": "https://dl.google.com/android/repository/repository2-3.xml"
    },
    {
      "title": "实际API36模拟器完整验收：9280ec3",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40142096678/job/121016561255"
    }
  ],
  "sections": [
    {
      "id": "objects",
      "title": "RN应用工程先区分页面、应用与原生操作的寿命",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "React Native应用使用React描述界面，再通过原生运行时和组件完成平台工作。应用工程关注的是把这些部分组织成可启动、可离开、可恢复、可解释失败的程序，而不只是把一个按钮画出来。导航决定当前展示哪个屏幕；应用生命周期反映它是否在前台；原生调用又可能在页面离开后才返回。这三种寿命经常重叠，但不能当成同一个开关。"
        },
        {
          "type": "paragraph",
          "text": "例如用户打开笔记n1时开始加载，随即回到列表再打开n2。n1的请求可能仍在返回，旧组件也可能仍被导航栈保留；若只看组件有没有卸载，就可能让过期结果参与当前界面。另一方面，应用进入后台不一定退出进程，导航焦点也可能仍在n2。需要把“页面有焦点”和“AppState为active”组合成当前是否允许启动工作的条件。"
        },
        {
          "type": "paragraph",
          "text": "本篇交付两页假笔记n1/n2，文件路由负责列表与详情，状态控制器负责一次加载的归属，平台端口负责原生文件操作和定位授权。定位实验只申请权限，不读取位置。代表环境明确为Android API36 x86_64模拟器；编译使用API37.0、target36，两者不等同运行系统版本。iOS和实体手机没有验收，不把桌面视口称作手机。"
        },
        {
          "type": "paragraph",
          "text": "当前锁Node24.14.1、Expo58.0.19、React19.3.0与RN0.88.0，并按Expo官方包内bundledNativeModules固定Router、FileSystem、Location和其他原生依赖。作者本机已实际运行12项JS回归、配置核对、Android工程预生成和Metro/Hermes导出；隔离CI的9280冻结源码已完成release APK和API36 x86_64模拟器完整验收。"
        }
      ]
    },
    {
      "id": "routes",
      "title": "路由描述业务位置，不把页面参数直接变成系统路径",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "文件路由将文件结构映射成导航位置：app/index.jsx是列表，app/note/[id].jsx接收笔记编号。详情页通过noteId白名单只接受n1或n2；数组、未知值和路径形式的字符串都会被拒绝。编号用来选业务对象，并不授予读取任意文件的能力。导航保留页面时，组件仍可能存在，因此useFocusEffect负责观察这个屏幕是否处于导航焦点。"
        },
        {
          "type": "code",
          "code": "import React from 'react';\nimport {Stack} from 'expo-router';\nimport {LifecycleProvider} from '../lib/lifecycle';\nexport default function Layout() {\n  return <LifecycleProvider><Stack screenOptions={{animation: 'none'}}>\n    <Stack.Screen name=\"index\" options={{title: '本机教学笔记'}}/>\n    <Stack.Screen name=\"note/[id]\" options={{title: '笔记与原生能力'}}/>\n  </Stack></LifecycleProvider>;\n}",
          "filename": "examples/react-native-engineering/app/_layout.jsx",
          "purpose": "完整导航布局，实际页面与生命周期Provider都在本工程中。",
          "language": "jsx",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "import React from 'react';\nimport {View, Text, Button} from 'react-native';\nimport {router} from 'expo-router';\nimport {report} from '../lib/report';\nexport default function Notes() {\n  React.useEffect(() => {report('list_mounted');}, []);\n  return <View style={{padding:24, gap:16}}><Text>全部是假数据。离开页面、进入后台与原生调用分别处理。</Text>\n    <Button title=\"打开教学笔记 n1\" onPress={() => router.push('/note/n1')}/>\n    <Button title=\"打开教学笔记 n2\" onPress={() => router.push('/note/n2')}/>\n  </View>;\n}",
          "filename": "examples/react-native-engineering/app/index.jsx",
          "purpose": "完整列表输入：仅两条本机假数据路由，不连接真实账号。",
          "language": "jsx",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "SDK58的Router已经有自己的导航入口，本例从expo-router导入Stack、router和useFocusEffect，不混入另一套外部导航包的上下文。useLocalSearchParams提供的是路由输入，不能因为URL由自己的按钮生成就省掉验证；同一应用也可能通过深链接进入。自动化使用专用scheme进入自己的模拟器应用，普通用户仍可从列表按钮操作。"
        },
        {
          "type": "reference",
          "title": "Expo58 Router版本文档",
          "url": "https://docs.expo.dev/versions/v58.0.0/sdk/router/",
          "note": "文件路由、Stack与焦点回调按同一SDK解释，不把Web URL与原生Activity生命周期混在一起。"
        }
      ]
    },
    {
      "id": "session",
      "title": "取消等待与撤销结果归属，是两条不同的防线",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "AbortController可以请求取消支持它的操作，但原生API可能没有取消接口，某些任务也已经提交。更可靠的界面规则是给每次启动分配一代归属：新任务开始或页面暂停时递增generation，回调只有仍属于当前代且active时才能发布。这样，即使底层忽略abort、稍后成功，旧结果仍会被丢弃。它保护的是发布资格，不保证已发生的网络写入或原生副作用被撤回。"
        },
        {
          "type": "code",
          "code": "export function noteId(value) {\n  if (typeof value !== 'string' || !['n1', 'n2'].includes(value)) throw new RangeError('unknown teaching note');\n  return value;\n}\n\nexport function createSession(load, publish) {\n  let generation = 0, active = false, controller;\n  function pause(notify = true) {\n    active = false;\n    generation += 1;\n    controller?.abort();\n    controller = undefined;\n    if (notify) publish({status: 'paused'});\n  }\n  function start(value) {\n    const id = noteId(value);\n    pause(false);\n    active = true;\n    controller = new AbortController();\n    const owned = controller, current = generation;\n    publish({status: 'loading', id});\n    // A capability may ignore AbortSignal: the generation check still owns publication.\n    const completion = Promise.resolve().then(() => load(id, owned.signal)).then(\n      note => {\n        if (!active || current !== generation) return 'discarded';\n        publish({status: 'ready', id, note});\n        return 'published';\n      },\n      error => {\n        if (!active || current !== generation) return 'discarded';\n        publish({status: 'error', id, code: error?.name === 'AbortError' ? 'cancelled' : 'load-failed'});\n        return 'failed';\n      },\n    );\n    return completion;\n  }\n  return {start, pause, dispose: () => pause(false)};\n}\n\nexport function observeAppState(source, publish) {\n  const subscription = source.addEventListener('change', publish);\n  // Subscribe before rereading: a render-time null snapshot may already be active.\n  publish(source.currentState);\n  return () => subscription.remove();\n}\n\nexport function createCapabilitySession(publish, observe = () => {}) {\n  let eligible = false, generation = 0, running = false;\n  function setEligible(value) {\n    const changed = eligible !== value;\n    eligible = value;\n    if (!value || changed) {generation += 1;running = false;publish({status:'idle'});}\n  }\n  function dispose() {eligible=false;generation+=1;running=false;}\n  function run(kind, operation) {\n    if (!eligible) return Promise.resolve('ineligible');\n    if (running) return Promise.resolve('busy');\n    const current = ++generation;\n    running = true;publish({status:'running',kind});observe('capability_started',{kind});\n    const finish = result => {\n      const accepted = eligible && current === generation;\n      observe('capability_result',{kind,...result,accepted});\n      if (accepted) {running=false;publish(result);}\n      return accepted ? 'published' : 'discarded';\n    };\n    return Promise.resolve().then(operation).then(finish, () => finish({status:'error'}));\n  }\n  return {setEligible, run, dispose};\n}\n\nlet directoryOperation = 0;\nexport function ownedDirectoryName(clock = Date.now) {\n  return 'atlas-rn-lab-' + clock() + '-' + (++directoryOperation);\n}\nexport async function withOwnedDirectory(create, use) {\n  const directory = create();\n  try {return await use(directory);}\n  finally {if (directory.exists) directory.delete();}\n}",
          "filename": "examples/react-native-engineering/lib/session.mjs",
          "purpose": "完整业务编号、加载代际与AppState观察核心；Node测试可直接运行，原生端复用同一实现。",
          "language": "javascript",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "start先使旧代失效，并为本次操作保存独立的AbortSignal。这个保存很重要：Promise会稍后执行，若届时再从共享controller变量取signal，就可能错拿下一代的控制器。成功和失败两条分支都检查归属；dispose不再发布状态，避免把组件清理本身变成一次对旧界面的更新。下一次start仍可在之前失败后正常恢复。"
        },
        {
          "type": "paragraph",
          "text": "AppState.currentState初始也可能为空，render到effect订阅之间还可能已经变成active。observeAppState先订阅change，再读一次最新快照；CPU回归专门模拟“初始null、订阅时已active、没有补发事件”的窗口。只在render读取一次，再假定一定会收到下一条事件，可能让页面永久等待一个已经发生过的状态。"
        }
      ]
    },
    {
      "id": "ownership",
      "title": "把导航焦点与前后台条件落实到完整详情页",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "/figures/react-native-engineering/lifetime.svg",
          "title": "两种资格与一代结果归属",
          "alt": "路由focus与AppState active共同允许加载；暂停立即使旧代失效，abort尽力取消；原生结果晚到只记录并丢弃UI发布。",
          "caption": "图中没有把屏幕失焦当成组件必然卸载，也没有把abort画成原生事务回滚。Android通知抽屉等blur/focus事件不在本例覆盖范围。"
        },
        {
          "type": "code",
          "code": "import React from 'react';\nimport {AppState} from 'react-native';\nimport {report} from './report';\nimport {observeAppState} from './session.mjs';\nexport const Lifecycle = React.createContext(null);\nexport function LifecycleProvider({children}) {\n  const [state, setState] = React.useState(AppState.currentState);\n  React.useEffect(() => {\n    return observeAppState(AppState, next => {\n      setState(next);report('app_state', {state:next});\n    });\n  }, []);\n  return <Lifecycle.Provider value={state}>{children}</Lifecycle.Provider>;\n}",
          "filename": "examples/react-native-engineering/lib/lifecycle.jsx",
          "purpose": "完整AppState订阅Provider，订阅后同步最新状态，卸载时remove。",
          "language": "jsx",
          "kind": "runnable"
        },
        {
          "type": "code",
          "code": "import React from 'react';\nimport {View, Text, Button} from 'react-native';\nimport {router, useLocalSearchParams, useFocusEffect} from 'expo-router';\nimport {Lifecycle} from '../../lib/lifecycle';\nimport {createSession, createCapabilitySession, noteId} from '../../lib/session.mjs';\nimport {loadNote, nativeFiles, requestLocationPermission} from '../../lib/native-port';\nimport {labBase, report} from '../../lib/report';\nexport default function Note() {\n  const parameters = useLocalSearchParams();\n  const [focused, setFocused] = React.useState(false), [state, setState] = React.useState({status:'paused'});\n  const [capability, setCapability] = React.useState({status:'idle'});\n  const appState = React.useContext(Lifecycle), eligible = focused && appState === 'active';\n  const scenarioRan = React.useRef('');\n  const capabilities = React.useMemo(() => createCapabilitySession(setCapability, report), []);\n  const session = React.useMemo(() => createSession(loadNote, value => {\n    setState(value);report('note_state', {status:value.status, id:value.id ?? null});\n  }), []);\n  React.useEffect(() => {report('note_rendered', {status:state.status, id:state.id ?? null});}, [state]);\n  let id;\n  try {id = noteId(parameters.id);} catch {id = null;}\n  useFocusEffect(React.useCallback(() => {\n    setFocused(true);report('screen_focus', {id});\n    return () => {\n      capabilities.dispose();session.dispose();\n      setFocused(false);report('screen_blur', {id});\n    };\n  }, [id, session, capabilities]));\n  React.useEffect(() => {\n    capabilities.setEligible(Boolean(eligible && id));\n    if (eligible && id) session.start(id);\n    else {session.pause();report('note_paused', {id});}\n    return () => {session.dispose();capabilities.dispose();};\n  }, [session, capabilities, eligible, id]);\n  function run(kind) {\n    return capabilities.run(kind, () => kind === 'files' ? nativeFiles(id) : requestLocationPermission());\n  }\n  React.useEffect(() => {\n    const scenario = parameters.case;\n    if (!labBase || !eligible || !id || !['files','permission'].includes(scenario)) return;\n    const key = id + ':' + scenario;\n    if (scenarioRan.current === key) return;\n    scenarioRan.current = key;\n    void run(scenario);\n  }, [eligible, id, parameters.case]);\n  if (!id) return <View><Text>未知教学笔记，未开始任何原生操作。</Text></View>;\n  return <View style={{padding:24, gap:16}}><Text>页面 {id}；AppState {String(appState)}；focus {String(focused)}</Text>\n    <Text testID=\"note-state\">{JSON.stringify(state)}</Text><Text testID=\"native-state\">{JSON.stringify(capability)}</Text>\n    <Button title=\"本机文件往返与缺文件失败\" disabled={!eligible || capability.status==='running'} onPress={() => run('files')}/>\n    <Button title=\"请求前台定位授权（不读取位置）\" disabled={!eligible || capability.status==='running'} onPress={() => run('permission')}/>\n    <Button title=\"回到列表\" onPress={() => router.replace('/')}/>\n  </View>;\n}",
          "filename": "examples/react-native-engineering/app/note/[id].jsx",
          "purpose": "完整关键页面：路由验证、焦点清理、active条件、加载结果和原生按钮；自动化case只有本地实验构建才启用。",
          "language": "jsx",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "页面保持挂载但失去导航焦点时，cleanup立即dispose加载代际，原生调用代次也失效。AppState不是active时不启动新加载，并把能力按钮恢复到idle；这是丢弃旧UI结果后的界面恢复，不能宣称底层原生调用已停止。页面重新满足资格时创建新加载，旧失败不会永久锁住按钮。原生结果会记录accepted，只有仍属于当前页面代次才更新界面。"
        },
        {
          "type": "paragraph",
          "text": "这里监听的是AppState.change和路由focus。Android拉下通知抽屉等交互失焦可能使用另一个AppState.blur/focus事件，未必改变active；本篇没有实现这组扩展策略。若产品要求任何交互失焦都暂停敏感操作，应补上明确的事件和恢复条件，再独立测试，不能仅把active这个单词理解成全部交互场景。"
        }
      ]
    },
    {
      "id": "native",
      "title": "原生能力要能表达成功、拒绝、缺失与调用失败",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "平台端口是业务代码接触原生能力的窄入口。这里FileSystem处理应用自己的cache子目录，Location只请求前台定位授权。权限拒绝不是程序异常，也不意味着用户以后一定还能再次被弹窗；返回的status、granted与canAskAgain应保留给界面决策。模块未在原生二进制中安装、系统能力不支持和权限未授予，也应分开解释，不能统称“网络失败”。"
        },
        {
          "type": "code",
          "code": "import {Platform} from 'react-native';\nimport {Directory, File, Paths} from 'expo-file-system';\nimport * as Location from 'expo-location';\nimport {labBase} from './report';\nimport {noteId, ownedDirectoryName, withOwnedDirectory} from './session.mjs';\n\nexport async function loadNote(value, signal) {\n  const id = noteId(value);\n  if (!labBase) return {id, title: '只在本机展示的教学笔记 ' + id};\n  const response = await fetch(labBase + '/gate?id=' + id, {signal});\n  if (!response.ok) throw new Error('fixture HTTP status');\n  return response.json();\n}\n\nexport async function nativeFiles(value) {\n  const id = noteId(value);\n  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return {status: 'unsupported'};\n  return withOwnedDirectory(() => {\n    const directory = new Directory(Paths.cache, ownedDirectoryName());\n    directory.create({intermediates: true}); // Refuse an existing directory.\n    return directory;\n  }, async directory => {\n    const file = new File(directory, id + '.json');\n    file.write(JSON.stringify({id, title: 'fake note'}));\n    const result = JSON.parse(await file.text());\n    if (result.id !== id || result.title !== 'fake note') throw new Error('round trip mismatch');\n    let missingRejected = false;\n    try {await new File(directory, 'never-created.json').text();}\n    catch {missingRejected = true;}\n    if (!missingRejected) throw new Error('expected native missing-file rejection');\n    return {status: 'ok', roundTrip: true, missingRejected};\n  });\n}\n\nexport async function requestLocationPermission() {\n  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return {status: 'unsupported'};\n  // This demonstration asks only for authorization. It never reads a location.\n  const result = await Location.requestForegroundPermissionsAsync();\n  return {status: result.status, granted: result.granted, canAskAgain: result.canAskAgain};\n}",
          "filename": "examples/react-native-engineering/lib/native-port.js",
          "purpose": "完整原生端口：白名单ID、受控加载、真实File往返/缺文件拒绝与仅申请授权。",
          "language": "javascript",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "文件实验每次调用创建自己拥有的独立cache子目录，创建时拒绝已存在的同名目录；无论读取成功还是缺文件失败，finally只删除该调用的目录。这样，旧原生操作晚结束也不会删除另一代正在使用的目录。它没有访问相册或用户文档，不是持久离线库；系统可回收cache，进程被强杀时也不能保证finally完成。持久化同步协议可见移动端离线数据专题，另行设计事务、重放与冲突，而不是把这个临时文件当作数据库。"
        },
        {
          "type": "paragraph",
          "text": "缺文件路径是受控的never-created.json，正常调用先写读fake note，再要求这个读取真实拒绝。测试因此能证明原生异常路径，不靠让一个JS mock抛错冒充原生调用。定位授权脚本同样要求从模拟器系统弹窗拒绝，不通过伪造结果跳过系统权限；该原生路径已在本次模拟器CI实际通过。模拟器不是实体设备，本例更没有读取真实GPS数据。"
        },
        {
          "type": "reference",
          "title": "Expo58 FileSystem",
          "url": "https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/",
          "note": "目录、文件与应用cache的原生接口。"
        },
        {
          "type": "reference",
          "title": "Expo58 Location",
          "url": "https://docs.expo.dev/versions/v58.0.0/sdk/location/",
          "note": "请求权限与原生配置需要共同匹配；配置插件变更通常要求重建二进制。"
        }
      ]
    },
    {
      "id": "build",
      "title": "固定JS与原生工具链，构建证据按层记录",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "package-lock锁住依赖解析，Expo的bundledNativeModules说明这套SDK预期的原生版本，二者要一起核对。初次安装自动选到ReactDOM19.3.1，而本SDK React固定19.3.0；gesture-handler也自动超出Expo给出的~3.3范围。我们明确锁回19.3.0与3.3.0，再核对精确版本与peer关系，没有用忽略peer告警的方式把冲突藏起来。"
        },
        {
          "type": "code",
          "code": "{\n  \"name\": \"atlas-react-native-engineering\",\n  \"version\": \"1.0.0\",\n  \"private\": true,\n  \"type\": \"module\",\n  \"main\": \"expo-router/entry\",\n  \"engines\": {\n    \"node\": \"24.14.1\"\n  },\n  \"scripts\": {\n    \"start\": \"expo start\",\n    \"test\": \"node --test test.mjs\",\n    \"check\": \"node verify-config.mjs\",\n    \"export:android\": \"expo export --platform android --output-dir dist\"\n  },\n  \"dependencies\": {\n    \"expo\": \"58.0.19\",\n    \"expo-router\": \"58.0.26\",\n    \"expo-file-system\": \"58.0.11\",\n    \"expo-location\": \"58.0.19\",\n    \"expo-constants\": \"58.0.13\",\n    \"expo-linking\": \"58.0.14\",\n    \"expo-status-bar\": \"58.0.4\",\n    \"react\": \"19.3.0\",\n    \"react-native\": \"0.88.0\",\n    \"react-native-safe-area-context\": \"5.10.1\",\n    \"react-native-screens\": \"4.30.0\",\n    \"react-dom\": \"19.3.0\",\n    \"react-native-gesture-handler\": \"3.3.0\",\n    \"react-native-reanimated\": \"4.7.1\",\n    \"react-native-worklets\": \"0.13.0\"\n  },\n  \"devDependencies\": {\n    \"expo-template-bare-minimum\": \"58.0.28\"\n  }\n}",
          "filename": "examples/react-native-engineering/package.json",
          "purpose": "完整依赖与运行入口；完整传递锁及固定模板在下载工程中。",
          "language": "json",
          "kind": "runnable"
        },
        {
          "type": "code",
          "filename": "终端",
          "code": "npm ci --ignore-scripts --no-fund\nnpm test\nnpm run check\nnpm run export:android",
          "purpose": "在本目录使用Node24.14.1；前两项核心/配置不等于原生运行，最后为Android JS/Hermes资源导出。",
          "kind": "runnable",
          "language": "bash"
        },
        {
          "type": "paragraph",
          "text": "预生成工程把配置插件展开成Android目录；Metro导出只证明JS模块和Hermes工件能够生成；Gradle编译、APK签名检查、安装与实际运行又是后续几层。隔离入口使用固定模板的本地tar，在私有目录预生成，构建x86_64的release配置以便内嵌JS，但仍使用模板公用Android Debug证书。它没有生产签名或商店上传资格。"
        },
        {
          "type": "code",
          "filename": "终端",
          "code": "CI=true ATLAS_LAB_EMULATOR_SERIAL=emulator-5554 \\\nATLAS_LAB_ARTIFACT_DIR=\"$RUNNER_TEMP/atlas-rn-artifacts\" \\\nbash ./verify-android.sh",
          "purpose": "在本示例根目录执行（ZIP解压后进入react-native-engineering）；仅一次性Linux runner与明确的API36 x86_64模拟器。SDK37.0/buildtools37.0.0/NDK/CMake/JDK17由CI预装，脚本不修改用户宿主SDK。",
          "kind": "runnable",
          "language": "bash"
        },
        {
          "type": "paragraph",
          "text": "首轮CI在SDK安装阶段发现官方仓库不存在platforms;android-37。独立读取Google repository2-3.xml后确认精确包名为android-37.0，仅修安装名与目录预检；没有改compileSdk约束，也没有给SDK目录造symlink。这个失败发生在编译之前，不能被写成RN应用已经编译失败或原生验收通过。"
        },
        {
          "type": "reference",
          "title": "AGP9.2官方兼容表",
          "url": "https://developer.android.com/build/releases/agp-9-2-0-release-notes",
          "note": "JDK17、Gradle9.4.1与API37.0支持；运行API36和编译平台分开记录。"
        }
      ]
    },
    {
      "id": "evidence",
      "title": "正常、失败和清理，都要有对应的观察条件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "12项CPU回归覆盖业务ID、成功、错误、暂停abort、忽略取消的晚成功、晚失败、失败后恢复、初始AppState窗口、能力暂停重试、独有资源交错清理与直接resume快照。它们证明状态核心，不能证明原生组件实际显示。模拟器脚本另外用HTTP gate确认旧请求已进入，路由blur后释放它，再等待n2的React effect提交记录，另读原生UI层级JSON并保存PNG；这些步骤已在9280模拟器CI实际通过。HOME和重新启动Activity观察真正的background/active及暂停恢复。条件有截止时间，轮询并不以睡够秒数代替成功。"
        },
        {
          "type": "paragraph",
          "text": "原生文件、系统权限弹窗、签名与APK安装各有独立断言。脚本在任何安装之前要求Linux CI、明确emulator序号、qemu=1与x86_64，并拒绝已有同包名应用；finally只卸载自己新装的假数据包、删除自己的UI dump，在锁内放行新旧gate并等待非daemon请求线程关闭。构建器使用自有进程组，超时或TERM先TERM、有限等待后KILL并回收；新增3项无SDK回归实际覆盖内部超时、外部TERM和部分POST线程收口。构建临时目录与保留的APK报告分开，强杀和主机故障不在用户态清理保证之内。"
        },
        {
          "type": "paragraph",
          "text": "目前本机实际已通过12项、配置锁、私有预生成和1172模块的Android Metro/Hermes导出，9280ec3/run40142096678在API36 x86_64模拟器完整通过导航晚结果丢弃、原生UI、background/resume、原生文件往返/缺文件拒绝、系统定位授权拒绝及清理。运行源码与冻结9280完全一致。npm audit仍有6项high，报告保留node-forge签名校验与Zod受限集合等上游链告警；没有用不兼容major override或降旧Expo清空报告。实验不接入生产证书签名服务、不接收任意不可信schema，但依赖审计仍未通过，不能标成生产可用。"
        },
        {
          "type": "paragraph",
          "text": "这次文件事件为ok、roundTrip=true、missingRejected=true、accepted=true；权限事件实际为denied、granted=false、canAskAgain=true、accepted=false，location_read=false。权限弹窗过程使当前资格变化后，结果仍可记录但不再归属于旧UI；因此本次证明系统拒绝分支和过期结果丢弃，不能声称旧页面最终显示了denied。"
        },
        {
          "type": "reference",
          "title": "API36实际模拟器验收",
          "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40142096678/job/121016561255",
          "note": "9280完整构建及运行通过；公开页需fresh读取，先前缓存中的In progress不是失败证据。"
        },
        {
          "type": "paragraph",
          "text": "读完应能解释一份结果为什么属于当前页面，区分权限拒绝与能力失败，独立运行状态核心与受限Android实验。下一步交付篇会把同一个笔记主题推进到构建身份、同证书升级、保留数据和错误栈对应的source map。应用能在开发环境打开，只是交付证据链的开头。"
        }
      ]
    }
  ]
};

export default article;
