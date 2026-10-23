import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "cross-platform-models",
  "topic": "flutter",
  "title": "React Native与Flutter：把渲染、事件和设备通信放到同一张图里比较",
  "description": "固定RN0.88.0与Flutter3.41.3，从运行时到宿主挂载逐层比较；用可运行的RN示例解释状态归属、权限和原生能力缺失。",
  "minutes": 46,
  "labMinutes": 30,
  "kind": "tutorial",
  "status": "review",
  "verifiedAt": "2026-10-23",
  "versions": [
    "React Native0.88.0 / React19.3.0 / Expo58.0.17",
    "Flutter3.41.3 / Dart3.11.1",
    "Node24.14.1；RN原生构建与真机未验证"
  ],
  "tags": [
    "React Native",
    "Flutter",
    "Fabric",
    "JSI",
    "权限",
    "生命周期"
  ],
  "scope": "执行/渲染/布局/事件/平台边界比较；RN模拟遥测与可启动Expo工程，实际验证纯JS逻辑与语法。原生AtlasDevice模块未实现，Android/iOS设备与构建缺失明确受阻；没有原生性能对比或生产选型唯一结论。",
  "prerequisites": [
    "React组件/Effect基础或Dart/Widget基础",
    "理解异步回调和取消"
  ],
  "questionIds": [
    "cross-platform-models-render",
    "cross-platform-models-stream"
  ],
  "examples": [
    {
      "label": "RN固定版本最小工程",
      "path": "cross-platform-models.zip"
    },
    {
      "label": "运行、验证与受阻项",
      "path": "cross-platform-models/README.md"
    }
  ],
  "sections": [
    {
      "id": "s14-414901",
      "title": "跨平台解决什么：共享表达，保留宿主差异",
      "paragraphs": [],
      "blocks": [
        {
          "type": "callout",
          "title": "原生与依赖验收尚未完成",
          "text": "逻辑测试通过；RN原生渲染/权限未运行，最新稳定兼容组合仍有15个high依赖审计告警。示例保持审阅稿，不能作为生产部署建议。"
        },
        {
          "type": "paragraph",
          "text": "React Native和Flutter都用于跨平台UI，但“共享业务代码”没有说明画面最终怎样生成、事件由谁处理、系统能力从哪里进入。RN用JavaScript中的React描述界面，渲染器把相应宿主组件协调成平台视图；Flutter用Dart中的Widget描述配置，再由Element、RenderObject和引擎完成界面过程。两者都需要平台集成，代码复用并不消除系统权限、后台策略和硬件差异。"
        },
        {
          "type": "paragraph",
          "text": "本篇把比较固定在同一个小目标：显示当前设备及电量，从A切到B时结束旧订阅，A的晚到固件结果不能覆盖B，平台能力不存在时明确显示unsupported。Flutter完整Dart实现另有专文，本篇完整给出RN侧实现；关键归属逻辑在这里全部展示，读者不必跳过去补代码。"
        },
        {
          "type": "paragraph",
          "text": "RN版本固定0.88.0、React19.3.0，使用Expo58.0.17作为启动容器；SDK58只采用新架构；Flutter比较基准3.41.3/Dart3.11.1。当前机器没有Android设备/SDK，Xcode15.4也不满足SDK58原生要求；未完成RN原生构建、手势、布局或权限验收。下面的JS逻辑测试只能证明状态策略，不能证明原生渲染工作正常。"
        },
        {
          "type": "figure",
          "src": "figures/cross-platform-models/model.svg",
          "title": "同一次状态更新，两条不同的宿主路径",
          "alt": "RN为React元素到C++ShadowTree/Yoga布局再挂载宿主视图；Flutter为Widget经Element/RenderObject布局绘制和引擎输出。两边平台能力都需适配与权限，不能由业务语言绕过。",
          "caption": "职责与归属示意，不表达真实线程调度耗时或性能比例。"
        }
      ]
    },
    {
      "id": "s18-134375",
      "title": "RN更新路径：React协调、ShadowTree布局、宿主挂载",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "以电量80变79为例：JS状态变化请求React更新；组件产生新的宿主描述，Fabric负责相应C++ShadowTree。提交后进行相关布局计算，挂载阶段把差异落实为平台宿主视图更新。Yoga承担布局计算的一部分，最终控件与绘制仍在宿主平台完成；这不是React DOM，也没有浏览器CSS布局参与原生页面。"
        },
        {
          "type": "paragraph",
          "text": "JSI是JS运行时与C++交互的基础接口，Fabric是渲染体系，TurboModules与Codegen属于原生模块集成体系。它们不是同一块东西。不能把新架构的所有交互都写成旧版本“序列化消息通过一条异步bridge”，也不能因为JSI允许某些同步互操作就宣称所有调用没有成本、没有线程约束。"
        },
        {
          "type": "paragraph",
          "text": "渲染、提交和挂载可能涉及不同线程与优先级，宿主视图挂载最终受UI线程规则约束。昂贵JS计算、C++布局、原生视图创建、图片解码与动画都有各自成本。看到掉帧要定位哪一阶段，而不是先归因于桥。视图扁平化还可能消除中间宿主视图，所以不能按每个JSX节点画一对一的原生对象。"
        },
        {
          "type": "reference",
          "title": "RN新架构渲染流水线（官方当前架构说明）",
          "url": "https://reactnative.dev/architecture/render-pipeline"
        },
        {
          "type": "reference",
          "title": "RN0.88.0固定渲染源目录",
          "url": "https://github.com/facebook/react-native/tree/v0.88.0/packages/react-native/ReactCommon/react/renderer"
        }
      ]
    },
    {
      "id": "s15-178526",
      "title": "Flutter更新路径：配置、身份和布局绘制分别发生",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Flutter中controller通知后，依赖它的builder生成新Widget配置。Element根据类型、位置和key等关系维持身份，State属于相应StatefulElement；RenderObject负责布局、绘制等工作。框架通常把约束向下传、尺寸向上返回，由父节点安排孩子位置。不是每个Widget都建立新的RenderObject，也不是每次build都必然做全部布局与绘制。"
        },
        {
          "type": "paragraph",
          "text": "对于普通Flutter原生渲染路径，绘制描述再交引擎进行后续栅格化/合成等工作；不是把每个Flutter按钮直接变成一个平台UIButton或Android Button。需要嵌入平台控件时还有Platform View边界。Web有自己的目标实现，不能把Web实验等同于移动端引擎验收。"
        },
        {
          "type": "table",
          "headers": [
            "层次",
            "React Native0.88.0新架构",
            "Flutter3.41.3"
          ],
          "rows": [
            [
              "业务执行",
              "React组件/Hook在JS运行时执行，示例不测Hermes性能",
              "Dart主isolate执行，异步Future不自动并行CPU"
            ],
            [
              "长期记录",
              "React Fiber与渲染器树记录身份/工作",
              "Element/State和RenderObject各持有对应信息"
            ],
            [
              "布局与画面",
              "C++ShadowTree/Yoga等布局、宿主视图挂载与平台绘制",
              "约束布局、绘制记录、引擎/宿主协作输出"
            ],
            [
              "输入事件",
              "宿主输入通过事件系统送达相应React处理器",
              "宿主/引擎输入、命中测试与手势识别进入回调"
            ],
            [
              "平台能力",
              "原生模块体系/JSI等集成，受系统权限约束",
              "插件/平台通道或FFI等，受系统权限约束"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "这个表比较职责，不把某个框架“一定更快”当结论。大量列表、复杂自绘、既有原生SDK、无障碍要求和团队能力，会改变成本分布。状态库也只解决组织的一部分：订阅泄漏、回调归属与权限拒绝仍要自己定义。"
        }
      ]
    },
    {
      "id": "s16-311666",
      "title": "同一个连接策略：取消旧订阅，拒绝旧结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "session.mjs · 完整文件",
          "kind": "excerpt",
          "purpose": "完整可执行JS状态核心。只有一个页面会话拥有一个订阅；消息已被适配成领域对象，不是完整网络协议解析器。",
          "code": "export class DeviceSession {\n  constructor(source, port, publish) {\n    this.source = source; this.port = port; this.publish = publish;\n    this.generation = 0; this.closed = false; this.cancel = null;\n    this.state = { deviceId: '', connection: 'idle', sequence: -1, battery: null, command: 'idle', firmware: '' };\n  }\n  owns(generation, id) { return !this.closed && generation === this.generation && id === this.state.deviceId; }\n  emit(patch) { this.state = { ...this.state, ...patch }; if (!this.closed) this.publish(this.state); }\n  connect(id) {\n    if (this.closed) return;\n    const generation = ++this.generation;\n    this.cancel?.(); this.cancel = null;\n    this.emit({ deviceId: id, connection: 'connecting', sequence: -1, battery: null, command: 'idle', firmware: '' });\n    this.cancel = this.source.watch(id, reading => {\n      if (!this.owns(generation, id) || reading.deviceId !== id || reading.sequence <= this.state.sequence) return;\n      this.emit({ connection: 'connected', sequence: reading.sequence, battery: reading.battery });\n    });\n  }\n  async readFirmware() {\n    if (this.closed || !this.state.deviceId || this.state.command === 'pending') return;\n    const generation = this.generation, id = this.state.deviceId;\n    this.emit({ command: 'pending', firmware: '' });\n    try {\n      const firmware = await this.port.read(id);\n      if (this.owns(generation, id)) this.emit({ command: 'success', firmware });\n    } catch (error) {\n      if (this.owns(generation, id)) this.emit({ command: ['permission_denied', 'unsupported'].includes(error.code) ? error.code : 'failed' });\n    }\n  }\n  dispose() { this.closed = true; this.generation += 1; this.cancel?.(); this.cancel = null; }\n}\nexport function createDemoSource() {\n  const listeners = new Map();\n  return {\n    watch(id, callback) { listeners.set(id, callback); return () => { if (listeners.get(id) === callback) listeners.delete(id); }; },\n    emit(reading) { listeners.get(reading.deviceId)?.(reading); },\n    listenerCount() { return listeners.size; },\n  };\n}"
        },
        {
          "type": "paragraph",
          "text": "connect(A)建立generation1并清空旧展示。收到A/sequence2/battery80后发布connected；sequence1不再接受。connect(B)先增加代数并取消A监听，再清空B数据。即使A的固件Promise稍后完成，owns同时检查代数、设备和未销毁，不能把A结果写到B。dispose同样使后续回调失效。"
        },
        {
          "type": "paragraph",
          "text": "source的取消函数是同步的教学接口，只管理本机监听器；真实BLE、gRPC或WebSocket关闭可能异步完成。那时要像Flutter控制器一样，在等待关闭后再次检查代数，并处理关闭失败。不要把本例同步Map删除说成所有原生连接都瞬间释放。"
        },
        {
          "type": "paragraph",
          "text": "createDemoSource为一个页面会话设计，每设备只有一份当前监听，不是跨页面共享订阅中心。不同设备在各自会话里可以使用不同序号，切换后sequence重置。真实协议要明确序号范围、回绕、重连会话ID和数据单位；生产代码应在此层之前校验数据，而不是让错误原始消息进入UI。"
        },
        {
          "type": "table",
          "headers": [
            "相同行为规则",
            "RN实际逻辑测试",
            "Flutter对应策略"
          ],
          "rows": [
            [
              "旧序号/旧设备不覆盖",
              "sequence与deviceId检查",
              "Reading + generation/sequence检查"
            ],
            [
              "切换后晚到命令不覆盖",
              "捕获generation与id，完成前owns",
              "_owns检查"
            ],
            [
              "卸载后不再通知",
              "dispose递增代数并取消",
              "dispose失效并发出取消"
            ],
            [
              "能力缺失/拒绝分别展示",
              "unsupported / permission_denied / failed",
              "MissingPluginException / PlatformException分类"
            ]
          ]
        }
      ]
    },
    {
      "id": "platform",
      "title": "设备能力与权限：把边界写出来，不把缺失实现包装成完成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "native-port.js · 完整文件",
          "kind": "excerpt",
          "purpose": "完整RN平台适配边界。NativeModules.AtlasDevice未在本示例实现；缺失时先返回unsupported，不无意义地先弹权限请求。",
          "code": "import { NativeModules, PermissionsAndroid, Platform } from 'react-native';\nfunction error(code) { return Object.assign(new Error(code), { code }); }\nexport const firmwarePort = {\n  async read(deviceId) {\n    const module = NativeModules.AtlasDevice;\n    if (!module?.readFirmware) throw error('unsupported');\n    if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {\n      const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);\n      if (status !== PermissionsAndroid.RESULTS.GRANTED) throw error('permission_denied');\n    }\n    const result = await module.readFirmware(deviceId);\n    if (typeof result !== 'string' || result.length === 0) throw error('invalid_response');\n    return result;\n  },\n};"
        },
        {
          "type": "paragraph",
          "text": "这个适配器先检查原生能力是否存在。若没有AtlasDevice.readFirmware，就抛unsupported；标准Expo Go不包含我们自定义的模块，所以这里应看到能力缺失，而不是伪造固件版本。若未来安装了真实模块，Android31及以上才进入BLUETOOTH_CONNECT申请分支；拒绝后不调用设备操作。"
        },
        {
          "type": "paragraph",
          "text": "NativeModules在这个例子只展示调用契约，不能据此称已经交付Codegen/TurboModule。正式新架构模块应按固定版本实现Codegen/TurboModule契约，测试原生侧权限、返回类型、线程与资源释放。iOS也需要对应能力与配置，本例没有实现iOS蓝牙权限流程。JavaScript里的Platform判断不是系统授权。"
        },
        {
          "type": "paragraph",
          "text": "即使原生方法返回Promise，原生实现仍可能把大量同步工作放在不该阻塞的线程。调用超时也不能证明设备没有执行。对控制指令应使用commandId和设备端确认/查询/幂等约定；本例只读取版本，没有真实控制命令，不对硬件副作用做保证。"
        }
      ]
    },
    {
      "id": "app",
      "title": "完整RN页面、入口与固定依赖",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "App.js · 完整文件",
          "kind": "excerpt",
          "purpose": "完整React Native页面。Effect创建会话并清理，模拟消息从按钮进入；使用RN的View/Text/Button，不是DOM组件。",
          "code": "import React, { useEffect, useRef, useState } from 'react';\nimport { Button, ScrollView, Text, View } from 'react-native';\nimport { DeviceSession, createDemoSource } from './session.mjs';\nimport { firmwarePort } from './native-port.js';\nexport default function App() {\n  const source = useRef(createDemoSource()).current;\n  const current = useRef(null);\n  const sequence = useRef(0);\n  const [state, setState] = useState(null);\n  useEffect(() => {\n    const session = new DeviceSession(source, firmwarePort, setState);\n    current.current = session; session.connect('A');\n    return () => { session.dispose(); if (current.current === session) current.current = null; };\n  }, [source]);\n  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>\n    <Text style={{ fontSize: 24 }}>RN设备状态与消息归属</Text>\n    <Text>模拟遥测。没有实现原生AtlasDevice模块，固件读取应显示unsupported。</Text>\n    <View style={{ gap: 8 }}>\n      {['A', 'B'].map(id => <Button key={id} title={`连接 ${id}`} onPress={() => current.current?.connect(id)} />)}\n      <Button title=\"发送当前设备遥测\" onPress={() => { const session = current.current; if (!session) return; sequence.current += 1; source.emit({ deviceId: session.state.deviceId, sequence: sequence.current, battery: 80 - sequence.current % 40 }); }} />\n    </View>\n    <Text>{state ? `设备 ${state.deviceId} / 连接 ${state.connection} / 序号 ${state.sequence} / 电量 ${state.battery ?? '未知'}` : '初始化中'}</Text>\n    <Button title=\"读取平台固件\" disabled={!state || state.command === 'pending'} onPress={() => current.current?.readFirmware()} />\n    <Text>命令 {state?.command} / 固件 {state?.firmware}</Text>\n  </ScrollView>;\n}"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "index.js · 完整文件",
          "kind": "excerpt",
          "purpose": "Expo入口，把App注册到宿主。",
          "code": "import { registerRootComponent } from 'expo';\nimport App from './App.js';\nregisterRootComponent(App);"
        },
        {
          "type": "code",
          "language": "json",
          "filename": "package.json · 完整文件",
          "kind": "excerpt",
          "purpose": "固定基准与测试命令。仅Node状态测试不需要安装全部RN依赖；实际Expo启动需npm ci及兼容SDK58的客户端/开发构建。",
          "code": "{\n  \"name\": \"atlas-cross-platform\",\n  \"version\": \"1.0.0\",\n  \"private\": true,\n  \"type\": \"module\",\n  \"main\": \"index.js\",\n  \"engines\": {\n    \"node\": \"24.14.1\"\n  },\n  \"scripts\": {\n    \"start\": \"expo start\",\n    \"test\": \"node --test test.mjs\",\n    \"check\": \"node --check session.mjs && node --check test.mjs && node --check native-port.js && node --check index.js && node --check metro.config.cjs && node verify-config.mjs\"\n  },\n  \"dependencies\": {\n    \"expo\": \"58.0.17\",\n    \"react\": \"19.3.0\",\n    \"react-native\": \"0.88.0\"\n  }\n}"
        },
        {
          "type": "code",
          "language": "json",
          "filename": "app.json · 完整文件",
          "kind": "excerpt",
          "purpose": "SDK58已采用新架构，配置不写旧的newArchEnabled开关。Android声明只使构建可能包含权限，不等于系统已批准，也不使自定义模块凭空出现。",
          "code": "{\n  \"expo\": {\n    \"name\": \"Atlas lifecycle comparison\",\n    \"slug\": \"atlas-lifecycle-comparison\",\n    \"version\": \"1.0.0\",\n    \"android\": {\n      \"package\": \"dev.atlas.lifecycle\",\n      \"permissions\": [\n        \"android.permission.BLUETOOTH_CONNECT\"\n      ]\n    },\n    \"ios\": {\n      \"bundleIdentifier\": \"dev.atlas.lifecycle\"\n    }\n  }\n}"
        },
        {
          "type": "code",
          "language": "javascript",
          "filename": "metro.config.cjs · 完整文件",
          "kind": "excerpt",
          "purpose": "默认Metro配置增加mjs扩展，使独立可测试的逻辑模块可以由页面导入。",
          "code": "const { getDefaultConfig } = require('expo/metro-config');\nconst config = getDefaultConfig(__dirname);\nif (!config.resolver.sourceExts.includes('mjs')) config.resolver.sourceExts.push('mjs');\nmodule.exports = config;"
        },
        {
          "type": "paragraph",
          "text": "这里选Expo是为了给标准组件最小页面一个可启动容器，未生成Android/iOS工具链，也未将缺失的硬件插件偷偷替换成成功mock。想接自定义原生模块需要匹配SDK的开发构建或原生工程；Expo Go的版本兼容与发行状态应以实际客户端为准，本机没有完成扫码/模拟器运行。"
        },
        {
          "type": "code",
          "language": "sh",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "本次实际执行的是Node逻辑测试与语法解析、生成lockfile；未执行RN原生渲染、OS权限对话框或性能验收。不要把下一组启动命令当作已在本机跑过。",
          "code": "cd examples/cross-platform-models\nnvm use\n# 无任何npm依赖即可验证这份状态核心\nnode --test test.mjs\n# 如具备兼容Expo SDK58的客户端或原生环境，再启动页面\nnpm ci\nnpm start -- --localhost"
        },
        {
          "type": "paragraph",
          "text": "本机已有Node24.14.1，满足Expo58.0.17的运行时要求；原有Node22.12.0低于它要求的22.13.0分支下限，所以这份RN示例单独固定Node24.14.1，没有修改站点Node版本。兼容React/RN版本从官方Expo包内bundledNativeModules.json核对，记录在COMPATIBILITY.json。"
        },
        {
          "type": "paragraph",
          "text": "依赖锁审计在2026-10-23报告15个high（根问题为braces3.0.3与node-forge1.4.0，沿Expo/Metro依赖链传播）。因此该固定比较工程的依赖审计未通过，不能作为已完成安全验收的生产模板。本文没有运行audit fix --force去任意降级React Native/Expo，也没有把开发服务器开放到公网。修补或升级后需要重新核对SDK兼容与全部验证；纯逻辑测试不证明这些依赖安全。"
        }
      ]
    },
    {
      "id": "s9-244390",
      "title": "如何评价方案：从相同任务与实际证据出发",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "javascript",
          "filename": "test.mjs · 完整文件",
          "kind": "excerpt",
          "purpose": "完整7项Node逻辑测试。它们未导入react-native，不能验收原生视图、Yoga布局、手势、系统权限或真实消息线程。",
          "code": "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { DeviceSession, createDemoSource } from './session.mjs';\nconst deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve=a;reject=b; }); return { promise, resolve, reject }; };\ntest('normal reading, duplicate sequence, wrong device and subscription ownership', () => {\n const source=createDemoSource(), values=[];const session=new DeviceSession(source,{read:async()=>''},value=>values.push(value));\n session.connect('A');source.emit({deviceId:'A',sequence:2,battery:80});source.emit({deviceId:'A',sequence:1,battery:1});\n assert.equal(session.state.battery,80);session.connect('B');assert.equal(source.listenerCount(),1);\n source.emit({deviceId:'A',sequence:3,battery:1});assert.equal(session.state.battery,null);\n source.emit({deviceId:'B',sequence:1,battery:65});assert.equal(session.state.battery,65);\n session.dispose();assert.equal(source.listenerCount(),0);\n});\ntest('late result cannot write into newly selected device',async()=>{\n const request=deferred(),session=new DeviceSession(createDemoSource(),{read:()=>request.promise},()=>{});\n session.connect('A');const pending=session.readFirmware();session.connect('B');request.resolve('A-old');await pending;\n assert.equal(session.state.firmware,'');assert.equal(session.state.command,'idle');session.dispose();\n});\ntest('pending result after dispose cannot publish',async()=>{\n const request=deferred(),values=[],session=new DeviceSession(createDemoSource(),{read:()=>request.promise},value=>values.push(value));\n session.connect('A');const pending=session.readFirmware(),before=values.length;session.dispose();request.resolve('old');await pending;\n assert.equal(values.length,before);\n});\nfor(const code of ['permission_denied','unsupported','network_error'])test('classifies '+code,async()=>{\n const session=new DeviceSession(createDemoSource(),{read:async()=>{throw Object.assign(new Error(code),{code});}},()=>{});\n session.connect('A');await session.readFirmware();assert.equal(session.state.command,code==='network_error'?'failed':code);session.dispose();\n});\ntest('repeated read while pending starts only one call',async()=>{\n const request=deferred();let count=0;const session=new DeviceSession(createDemoSource(),{read:()=>{count+=1;return request.promise;}},()=>{});\n session.connect('A');const first=session.readFirmware();await session.readFirmware();assert.equal(count,1);request.resolve('v1');await first;\n assert.equal(session.state.firmware,'v1');assert.equal(session.state.command,'success');session.dispose();\n});"
        },
        {
          "type": "paragraph",
          "text": "本机实际7项通过：正常/旧序号/设备切换、晚到结果、销毁后结果、权限拒绝、能力缺失、其他错误、重复点击抑制。测试把Promise完成顺序控制在代码里，没有靠网络速度碰运气。Flutter侧Dart/Widget测试验证自己的实现，两组对照相同规则，并非共享一份测试就宣称两平台完全等价。"
        },
        {
          "type": "paragraph",
          "text": "真正选型要拿同一目标设备和同一需求做纵向样本：一页真实列表/图形、一次原生SDK调用、一条权限拒绝路径、一次前后台切换和断线恢复。分别记录开发/发布模式、运行时、设备、屏幕刷新率、内存与各阶段耗时，再讨论成本。没有这些样本时，本文只提供机制比较，不发布性能排名。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "JSI是不是意味着所有原生调用都很便宜？",
              "互操作接口不消除线程、转换和实际工作的成本；同步调用反而可能阻塞。"
            ],
            [
              "Flutter每次build是不是整屏重画？",
              "配置、身份、布局和绘制分阶段，脏范围与渲染对象决定后续工作。"
            ],
            [
              "Node测过session，能否说RN原生界面正常？",
              "不能，它只覆盖业务状态；原生renderer、权限、宿主与设备仍未验证。"
            ],
            [
              "租约/代数检查能代替设备命令幂等吗？",
              "只能拒绝过期结果写入本地，真实命令是否重复执行要由协议和设备端仲裁。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "RN与Flutter都能承载同样的业务不变量，但它们实现界面与平台集成的方式不同。先把数据归属和生命周期做正确，再用原生设备证据判断渲染、通信和维护成本；共享代码的数量只是其中一个维度。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "RN0.88.0固定源码",
      "url": "https://github.com/facebook/react-native/tree/v0.88.0"
    },
    {
      "title": "RN渲染流水线",
      "url": "https://reactnative.dev/architecture/render-pipeline"
    },
    {
      "title": "Flutter架构",
      "url": "https://docs.flutter.dev/resources/architectural-overview"
    }
  ]
};
export default article;
