import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "flutter-engineering",
  "topic": "flutter",
  "title": "Flutter设备页面：从状态所有权到订阅、晚到结果与平台边界",
  "description": "用完整Dart页面解释Widget/Element/RenderObject，取消旧遥测、校验设备代数、隔离平台命令；区分Web与原生验证。",
  "minutes": 48,
  "labMinutes": 35,
  "kind": "tutorial",
  "status": "review",
  "verifiedAt": "2026-10-23",
  "versions": [
    "Flutter 3.41.3 / revision48c32af034",
    "Dart3.11.1",
    "Flutter Web构建；未验证Android/iOS真机"
  ],
  "tags": [
    "Flutter",
    "Dart",
    "Element",
    "StreamSubscription",
    "MethodChannel"
  ],
  "scope": "一个设备状态页面的完整Dart实现：模拟遥测、单页面控制器、设备切换、消息顺序、异步固件归属、MethodChannel能力边界。平台插件/蓝牙/gRPC/真机权限未实现，不声称完成原生设备集成。",
  "prerequisites": [
    "Dart Future/Stream基础",
    "会读取Widget代码，不要求掌握状态库"
  ],
  "questionIds": [
    "cross-platform-models-render",
    "cross-platform-models-stream"
  ],
  "examples": [
    {
      "label": "Flutter完整项目与测试",
      "path": "flutter-engineering.zip"
    },
    {
      "label": "运行与环境限制",
      "path": "flutter-engineering/README.md"
    }
  ],
  "sections": [
    {
      "id": "context",
      "title": "Flutter是什么：配置界面、保留身份、按需完成布局绘制",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "Flutter是跨平台UI框架。业务通常用Dart描述Widget配置，由框架维护Element等长期记录，渲染对象负责布局和绘制相关工作，运行时与宿主环境协作输出画面。它的作用不只是复用按钮样式，还包括一套状态变化到界面更新的过程；平台能力仍由宿主和对应插件提供。"
        },
        {
          "type": "paragraph",
          "text": "先区分三个对象：Widget是不可变的配置；Element维持树中位置与身份，StatefulWidget对应的State由相应Element管理；RenderObject处理布局、绘制等渲染职责。不是每个Widget都新建一个RenderObject，也不是build执行一次就把整个屏幕重新画一遍。"
        },
        {
          "type": "paragraph",
          "text": "本篇不从复杂机器人事故开始，而是搭一个最小设备页：初始选择A、尚无遥测，显示connecting；点击发送模拟遥测后显示connected与电量；切到B时清空A的数据；A的晚到固件结果不得覆盖B。页面明确说明没有蓝牙或gRPC连接，让读者先验证归属，再决定怎样接真实设备。"
        },
        {
          "type": "figure",
          "src": "figures/flutter-engineering/model.svg",
          "title": "三个层次各自保存什么，异步结果从哪里进入界面",
          "alt": "模拟设备源进入控制器，设备代数与消息序号决定是否接受；ChangeNotifier触发局部Widget构建，Element保留身份，RenderObject按需布局绘制。MethodChannel连接平台边界。",
          "caption": "职责与归属示意，不表达真实线程调度耗时或性能比例。"
        },
        {
          "type": "paragraph",
          "text": "工程固定Flutter3.41.3、Dart3.11.1。依赖pubspec.lock，框架revision48c32af034。已安装环境只有macOS与Chrome可用，Android SDK缺失，未运行Android/iOS原生构建或真实固件通信；后面会把已经执行的Dart/Widget/Web验证与未执行的原生验证分开记录。"
        },
        {
          "type": "reference",
          "title": "Flutter架构概览（当前官方文档，本文实验固定3.41.3）",
          "url": "https://docs.flutter.dev/resources/architectural-overview"
        }
      ]
    },
    {
      "id": "state",
      "title": "先确定状态由谁拥有，再选通知方式",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "DeviceController由DemoPage创建，也由它销毁。它保存deviceId、connection、当前遥测sequence/battery、单次命令command和firmware。通信数据进入控制器，页面通过ListenableBuilder订阅；这里用ChangeNotifier只是让数据流短而可见，不依赖GetX或其他状态库，也不据此判定哪个库更快。"
        },
        {
          "type": "table",
          "headers": [
            "状态",
            "含义",
            "为什么不合成一个loading"
          ],
          "rows": [
            [
              "connection",
              "idle/connecting/connected/error/closed",
              "描述遥测订阅与首条数据情况"
            ],
            [
              "command",
              "idle/pending/success/permission_denied/unsupported/failed",
              "描述一次固件能力调用"
            ],
            [
              "deviceId和generation",
              "当前设备与本轮连接归属",
              "同一设备重连也产生新代数"
            ],
            [
              "sequence",
              "当前会话接受过的最新消息编号",
              "拦截重复与倒序数据，不能代替完整协议校验"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "连接上不代表命令成功，固件调用失败也不意味着遥测停止。切换设备时，两种状态都重置，避免B界面继续展示A电量。这个页面只由一个控制器拥有一个订阅；多个页面共享同一设备时，应把连接提升到明确的共享生命周期，而不是复制几个全局变量。"
        },
        {
          "type": "code",
          "language": "dart",
          "filename": "lib/device_controller.dart · 完整文件",
          "kind": "excerpt",
          "purpose": "完整领域数据、端口、平台适配器与控制器。取消、代数、序号、命令结果、错误和dispose路径都在本页可见。",
          "code": "import 'dart:async';\nimport 'package:flutter/foundation.dart';\nimport 'package:flutter/services.dart';\n\nclass Reading {\n  const Reading(this.deviceId, this.sequence, this.battery);\n  final String deviceId;\n  final int sequence;\n  final int battery;\n}\n\nabstract interface class TelemetrySource {\n  Stream<Reading> watch(String deviceId);\n}\n\nabstract interface class FirmwarePort {\n  Future<String> read(String deviceId);\n}\n\nclass UnsupportedFirmware implements FirmwarePort {\n  const UnsupportedFirmware();\n  @override\n  Future<String> read(String deviceId) async {\n    throw MissingPluginException('No web firmware adapter');\n  }\n}\n\nclass ChannelFirmware implements FirmwarePort {\n  const ChannelFirmware();\n  static const channel = MethodChannel('atlas/device');\n  @override\n  Future<String> read(String deviceId) async {\n    final value = await channel.invokeMethod<String>('readFirmware', {\n      'deviceId': deviceId,\n    });\n    if (value == null || value.isEmpty) {\n      throw StateError('Empty firmware response');\n    }\n    return value;\n  }\n}\n\nclass DeviceController extends ChangeNotifier {\n  DeviceController(this.source, this.firmwarePort);\n  final TelemetrySource source;\n  final FirmwarePort firmwarePort;\n  StreamSubscription<Reading>? _subscription;\n  int _generation = 0;\n  bool _closed = false;\n  String deviceId = '';\n  String connection = 'idle';\n  String command = 'idle';\n  String firmware = '';\n  int sequence = -1;\n  int? battery;\n  bool _owns(int generation, String id) =>\n      !_closed && generation == _generation && id == deviceId;\n  void _publish() {\n    if (!_closed) notifyListeners();\n  }\n\n  Future<void> connect(String id) async {\n    if (_closed) return;\n    final generation = ++_generation;\n    final previous = _subscription;\n    _subscription = null;\n    deviceId = id;\n    connection = 'connecting';\n    command = 'idle';\n    firmware = '';\n    sequence = -1;\n    battery = null;\n    _publish();\n    try {\n      await previous?.cancel();\n      if (!_owns(generation, id)) return;\n      _subscription = source\n          .watch(id)\n          .listen(\n            (reading) {\n              if (!_owns(generation, id) ||\n                  reading.deviceId != id ||\n                  reading.sequence <= sequence) {\n                return;\n              }\n              sequence = reading.sequence;\n              battery = reading.battery;\n              connection = 'connected';\n              _publish();\n            },\n            onError: (Object error) {\n              if (_owns(generation, id)) {\n                connection = 'error';\n                _publish();\n              }\n            },\n            onDone: () {\n              if (_owns(generation, id)) {\n                connection = 'closed';\n                _publish();\n              }\n            },\n          );\n    } catch (_) {\n      if (_owns(generation, id)) {\n        connection = 'error';\n        _publish();\n      }\n    }\n  }\n\n  Future<void> readFirmware() async {\n    if (_closed || deviceId.isEmpty || command == 'pending') return;\n    final generation = _generation, id = deviceId;\n    command = 'pending';\n    firmware = '';\n    _publish();\n    try {\n      final value = await firmwarePort.read(id);\n      if (!_owns(generation, id)) return;\n      firmware = value;\n      command = 'success';\n    } on MissingPluginException {\n      if (!_owns(generation, id)) return;\n      command = 'unsupported';\n    } on PlatformException catch (error) {\n      if (!_owns(generation, id)) return;\n      command = error.code == 'permission_denied'\n          ? 'permission_denied'\n          : 'failed';\n    } catch (_) {\n      if (!_owns(generation, id)) return;\n      command = 'failed';\n    }\n    _publish();\n  }\n\n  @override\n  void dispose() {\n    _closed = true;\n    _generation += 1;\n    final subscription = _subscription;\n    _subscription = null;\n    if (subscription != null) {\n      unawaited(\n        subscription.cancel().catchError((Object error) {\n          debugPrint('cancel failed: $error');\n        }),\n      );\n    }\n    super.dispose();\n  }\n}"
        },
        {
          "type": "paragraph",
          "text": "先沿connect(A)走普通路径。generation从0变1，状态改成设备A/connecting，sequence=-1；旧订阅若存在就取消。取消完成后再次检查归属，才调用source.watch(A)。第一条Reading(A,2,80)通过设备和序号检查，sequence变2、电量80、connection变connected，notifyListeners请求依赖它的界面更新。"
        },
        {
          "type": "paragraph",
          "text": "再把相同设备的序号1带入回调：1<=2，所以忽略。把设备B的数据错误放到A流里也忽略，因为reading.deviceId不匹配。这要求协议层已经把消息解码成合法领域数据；真实设备还要校验数值范围、单位、设备认证以及消息序号重置约定。不能把三个if条件当成完整安全协议。"
        }
      ]
    },
    {
      "id": "communication",
      "title": "取消与失效是两件事：订阅停止后仍要防晚到结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "从A切到B时，先让generation变2并立即发布B/connecting，再取消旧订阅。等取消Future完成，代码还要确认自己仍属于当前generation，才建立新流。因为取消本身可能等待；若其间又切到C，较早那次connect(B)不应在取消完成后反过来创建B订阅。"
        },
        {
          "type": "paragraph",
          "text": "数据回调同时检查控制器未销毁、generation相等、deviceId相等；随后才比较消息序号。取消让旧资源停止供给，归属检查则保护已经进入异步链的晚到结果。它们不是二选一，也不能用“在UI里判断mounted”代替全部领域归属。"
        },
        {
          "type": "paragraph",
          "text": "readFirmware展示另一个更明显的窗口：A发起Future，用户切B，A稍后返回v1。方法在调用前捕获A与generation1，返回后_owns不成立，因此不写firmware也不改变B的command。销毁控制器同样把_closed置true并增加代数，尚未结束的Future即使完成，也没有发布资格。"
        },
        {
          "type": "table",
          "headers": [
            "输入顺序",
            "允许更新",
            "拒绝更新"
          ],
          "rows": [
            [
              "A连接 → A(seq2,80)",
              "设备A/connected/80",
              "无"
            ],
            [
              "A(seq2) → A(seq1)",
              "保留seq2",
              "旧序号1"
            ],
            [
              "A固件待定 → 切B → A成功",
              "保留B/idle",
              "A晚到的固件与命令状态"
            ],
            [
              "命令待定 → dispose → 成功",
              "不再通知页面",
              "销毁后的异步写入"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "StreamSubscription.cancel返回Future，dispose本身是同步方法，所以示例发出取消并显式接收取消失败，不把它冒充已经等待完成；_closed与代数先失效，阻止后续发布。若资源释放必须被外层确认，应另提供可await的关闭流程并由拥有者调度。这里没有实现自动重连、可靠告警确认或后台持续连接，不能把局部页面生命周期当整个设备管理服务。"
        }
      ]
    },
    {
      "id": "platform",
      "title": "MethodChannel只定义调用边界，不会自动实现硬件能力",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "ChannelFirmware向atlas/device发送readFirmware与deviceId，要求返回非空字符串。Dart端有一个方法名，并不意味着Android、iOS或Web已经存在同名实现：本工程故意没有注册原生插件；Web页面显式选择UnsupportedFirmware，立即以MissingPluginException表示能力缺失，原生侧ChannelFirmware保留通道契约。页面统一显示unsupported。测试用mock验证通道协议，但没有用mock宣称硬件通信成功。"
        },
        {
          "type": "paragraph",
          "text": "平台返回PlatformException(permission_denied)时，控制器将命令标成permission_denied；其他平台错误变failed。真正的插件要在对应平台检查权限、声明manifest或Info.plist要求、处理用户拒绝与系统版本差异，再调蓝牙/设备SDK。Dart try/catch不能替代系统授权；MethodChannel编码与异步Future也不保证原生实现没有阻塞平台线程。"
        },
        {
          "type": "paragraph",
          "text": "如果操作是启动机器人、开锁或扣费，超时后的重试还要有commandId、结果查询和设备端幂等约定。读固件通常可重复，控制命令却可能产生真实副作用。本文的固件读取只是边界调用，不包含任何可以控制真实设备的命令。"
        },
        {
          "type": "reference",
          "title": "Flutter平台通道",
          "url": "https://docs.flutter.dev/platform-integration/platform-channels"
        }
      ]
    },
    {
      "id": "render",
      "title": "完整页面怎样把控制器接到Widget树",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "dart",
          "filename": "lib/main.dart · 完整文件",
          "kind": "excerpt",
          "purpose": "完整页面和模拟源。两个按钮选择设备，一个按钮手动发送领域数据；模拟源没有网络、定时推送或硬件依赖。",
          "code": "import 'dart:async';\nimport 'package:flutter/material.dart';\nimport 'package:flutter/foundation.dart';\nimport 'device_controller.dart';\n\nvoid main() => runApp(const MaterialApp(home: DemoPage()));\n\nclass DemoSource implements TelemetrySource {\n  final controllers = <String, StreamController<Reading>>{};\n  @override\n  Stream<Reading> watch(String id) =>\n      (controllers[id] ??= StreamController<Reading>.broadcast(\n        sync: true,\n      )).stream;\n  void emit(Reading reading) => controllers[reading.deviceId]?.add(reading);\n  Future<void> close() async {\n    for (final controller in controllers.values) {\n      await controller.close();\n    }\n  }\n}\n\nclass DemoPage extends StatefulWidget {\n  const DemoPage({super.key});\n  @override\n  State<DemoPage> createState() => _DemoPageState();\n}\n\nclass _DemoPageState extends State<DemoPage> {\n  final source = DemoSource();\n  late final controller = DeviceController(\n    source,\n    kIsWeb ? const UnsupportedFirmware() : const ChannelFirmware(),\n  );\n  int sent = 0;\n  @override\n  void initState() {\n    super.initState();\n    unawaited(controller.connect('A'));\n  }\n\n  @override\n  void dispose() {\n    controller.dispose();\n    unawaited(source.close());\n    super.dispose();\n  }\n\n  @override\n  Widget build(BuildContext context) => Scaffold(\n    appBar: AppBar(title: const Text('设备状态与消息归属')),\n    body: Center(\n      child: ConstrainedBox(\n        constraints: const BoxConstraints(maxWidth: 640),\n        child: ListenableBuilder(\n          listenable: controller,\n          builder: (context, child) => ListView(\n            padding: const EdgeInsets.all(20),\n            children: [\n              const Text('模拟遥测，没有连接蓝牙、机器人或gRPC。固件按钮展示平台能力缺失的真实错误边界。'),\n              Wrap(\n                spacing: 12,\n                children: [\n                  for (final id in ['A', 'B'])\n                    FilledButton(\n                      onPressed: () => unawaited(controller.connect(id)),\n                      child: Text('连接 $id'),\n                    ),\n                  OutlinedButton(\n                    onPressed: () {\n                      sent += 1;\n                      source.emit(\n                        Reading(controller.deviceId, sent, 80 - sent % 40),\n                      );\n                    },\n                    child: const Text('发送一条当前设备遥测'),\n                  ),\n                ],\n              ),\n              Text(\n                '设备 ${controller.deviceId} / 连接 ${controller.connection}',\n                key: const Key('connection'),\n              ),\n              Text(\n                '序号 ${controller.sequence} / 电量 ${controller.battery ?? \"未知\"}',\n                key: const Key('reading'),\n              ),\n              FilledButton(\n                onPressed: controller.command == 'pending'\n                    ? null\n                    : () => unawaited(controller.readFirmware()),\n                child: const Text('读取平台固件'),\n              ),\n              Text(\n                '命令 ${controller.command} / 固件 ${controller.firmware}',\n                key: const Key('firmware'),\n              ),\n              const Text(\n                'Web未实现atlas/device，所以预期unsupported；权限拒绝由平台适配器映射，测试另行模拟。',\n              ),\n            ],\n          ),\n        ),\n      ),\n    ),\n  );\n}"
        },
        {
          "type": "paragraph",
          "text": "DemoSource为每个设备维护一个broadcast流，页面发一条就推一条。ListenableBuilder仅订阅当前controller，notifyListeners后builder读取同一份状态生成新Widget配置；Element判断哪些配置可更新，布局与绘制按各自脏标记继续。本文没有采样build/layout/raster耗时，不从减少通知次数推导帧率提升。"
        },
        {
          "type": "paragraph",
          "text": "对于高频遥测，应先明确哪些数据允许合并、哪些必须完整处理。温度趋势可按展示节奏发布最新快照；紧急告警和命令确认却不能为了少rebuild随便丢弃。数据进入业务层的可靠性与UI刷新频率属于不同决策。先识别职责，再讨论局部刷新、绘图或隔离CPU计算。"
        },
        {
          "type": "paragraph",
          "text": "Dart Future并不把同步CPU代码自动并行化。主isolate里的长循环仍可能推迟输入和帧；可分离计算可以考虑独立isolate，并核对数据传递和取消成本。Web与移动端运行时、引擎路径不同，不能拿Chrome上的结果替代Android GPU或低端设备表现。"
        }
      ]
    },
    {
      "id": "delivery",
      "title": "依赖、测试与尚未完成的设备验收",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "yaml",
          "filename": "pubspec.yaml · 完整文件",
          "kind": "excerpt",
          "purpose": "完整依赖声明。Dart约束限定3.11.x，Flutter SDK本身固定3.41.3；pubspec.lock随项目保存。Web工程脚手架在下载中。",
          "code": "name: atlas_device\ndescription: \"Atlas device lifecycle teaching example.\"\npublish_to: 'none'\nversion: 0.1.0+1\n\nenvironment:\n  sdk: \">=3.11.1 <3.12.0\"\n\ndependencies:\n  flutter:\n    sdk: flutter\n\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n  flutter_lints: 6.0.0\n\nflutter:\n  uses-material-design: true"
        },
        {
          "type": "code",
          "language": "dart",
          "filename": "test/device_test.dart · 完整文件",
          "kind": "excerpt",
          "purpose": "完整四项测试。受控Future制造晚到；MethodChannel mock校验方法/输入、权限拒绝和缺失能力；Widget测试检验真实控件与状态文字，不是截图或原生测试。",
          "code": "import 'dart:async';\nimport 'package:flutter/material.dart';\nimport 'package:flutter/services.dart';\nimport 'package:flutter_test/flutter_test.dart';\nimport 'package:atlas_device/device_controller.dart';\nimport 'package:atlas_device/main.dart';\n\nclass DeferredFirmware implements FirmwarePort {\n  final pending = <String, Completer<String>>{};\n  @override\n  Future<String> read(String id) => (pending[id] = Completer<String>()).future;\n}\n\nvoid main() {\n  TestWidgetsFlutterBinding.ensureInitialized();\n  test(\n    'switching device cancels old subscription and rejects wrong or stale readings',\n    () async {\n      final source = DemoSource(), port = DeferredFirmware();\n      final controller = DeviceController(source, port);\n      await controller.connect('A');\n      source.emit(const Reading('A', 2, 80));\n      expect(controller.battery, 80);\n      // Deliberately put another device message into A's stream.\n      source.controllers['A']!.add(const Reading('B', 3, 10));\n      source.emit(const Reading('A', 1, 10));\n      expect(controller.battery, 80);\n      await controller.connect('B');\n      expect(source.controllers['A']!.hasListener, false);\n      source.emit(const Reading('A', 4, 1));\n      expect(controller.battery, null);\n      source.emit(const Reading('B', 1, 65));\n      expect(controller.battery, 65);\n      controller.dispose();\n      await source.close();\n    },\n  );\n  test(\n    'late platform result from A cannot overwrite B; dispose invalidates pending result',\n    () async {\n      final source = DemoSource(), port = DeferredFirmware();\n      final controller = DeviceController(source, port);\n      await controller.connect('A');\n      final old = controller.readFirmware();\n      await controller.connect('B');\n      port.pending['A']!.complete('A-old');\n      await old;\n      expect(controller.firmware, '');\n      expect(controller.command, 'idle');\n      final next = controller.readFirmware();\n      controller.dispose();\n      port.pending['B']!.complete('B-after-dispose');\n      await next;\n      expect(controller.firmware, '');\n      await source.close();\n    },\n  );\n  test(\n    'MethodChannel call contract, denied permission and missing capability',\n    () async {\n      final messenger =\n          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;\n      final source = DemoSource();\n      final controller = DeviceController(source, const ChannelFirmware());\n      await controller.connect('A');\n      messenger.setMockMethodCallHandler(ChannelFirmware.channel, (call) async {\n        expect(call.method, 'readFirmware');\n        expect(call.arguments, {'deviceId': 'A'});\n        return 'v1';\n      });\n      await controller.readFirmware();\n      expect(controller.firmware, 'v1');\n      messenger.setMockMethodCallHandler(ChannelFirmware.channel, (call) async {\n        throw PlatformException(code: 'permission_denied');\n      });\n      await controller.readFirmware();\n      expect(controller.command, 'permission_denied');\n      messenger.setMockMethodCallHandler(ChannelFirmware.channel, (call) async {\n        throw MissingPluginException('test capability absent');\n      });\n      await controller.readFirmware();\n      expect(controller.command, 'unsupported');\n      controller.dispose();\n      await source.close();\n      messenger.setMockMethodCallHandler(ChannelFirmware.channel, null);\n    },\n  );\n  testWidgets(\n    'page exposes connection, simulated reading and unsupported platform status',\n    (tester) async {\n      final messenger =\n          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;\n      messenger.setMockMethodCallHandler(ChannelFirmware.channel, (call) async {\n        throw MissingPluginException('test capability absent');\n      });\n      await tester.pumpWidget(const MaterialApp(home: DemoPage()));\n      await tester.pump();\n      expect(find.textContaining('设备 A / 连接 connecting'), findsOneWidget);\n      await tester.tap(find.text('发送一条当前设备遥测'));\n      await tester.pump();\n      expect(find.textContaining('连接 connected'), findsOneWidget);\n      await tester.tap(find.text('读取平台固件'));\n      await tester.pumpAndSettle();\n      await tester.scrollUntilVisible(find.byKey(const Key('firmware')), 100);\n      expect(\n        (tester.widget(find.byKey(const Key('firmware'))) as Text).data,\n        contains('命令 unsupported'),\n      );\n      await tester.pumpWidget(const SizedBox());\n      await tester.pump();\n      messenger.setMockMethodCallHandler(ChannelFirmware.channel, null);\n    },\n  );\n}"
        },
        {
          "type": "code",
          "language": "sh",
          "filename": "终端",
          "kind": "runnable",
          "purpose": "先确认Flutter3.41.3、Dart3.11.1。没有安装Android/iOS SDK也能运行本Web页面；原生集成不在这些命令验收范围内。",
          "code": "cd examples/flutter-engineering\nflutter --version\nflutter pub get --enforce-lockfile\nflutter test\nflutter analyze\nflutter build web\nflutter run -d chrome --web-port 4312"
        },
        {
          "type": "paragraph",
          "text": "实际本机flutter test四项通过，flutter analyze无问题。平台缺失的Widget测试显式mock MissingPluginException，让框架测试的外部消息通道稳定结束；它证明页面如何展示错误，不证明设备上插件是否注册。Web生产构建已通过，Chrome上的同4项测试也通过，Android SDK缺失，未安装新模拟器或工具链。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "取消了A订阅，为什么还保留generation？",
              "取消可能等待，其他Future也可能继续完成；代数让已过期回调失去发布权。"
            ],
            [
              "build次数增加是否等于全屏重绘？",
              "配置更新、Element复用、布局、绘制和栅格化是不同工作阶段，应分别测量。"
            ],
            [
              "通道mock返回v1，能否说蓝牙已跑通？",
              "不能。只验证Dart与消息协议、状态映射；平台插件、权限和硬件都需实际验收。"
            ],
            [
              "dispose后Future完成怎么办？",
              "先失效控制器和代数，回调_owns失败，不再通知已销毁页面。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "到这里交付的是一个可以阅读和验证的页面状态闭环。下一步接真实设备时，保持同样的端口与所有权，把DemoSource换成实际协议适配器，再逐项验证取消、重连、权限、后台恢复与不可重复命令。框架复用的是组织方法，设备事实需要设备证据。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Flutter3.41.3固定源码",
      "url": "https://github.com/flutter/flutter/tree/3.41.3"
    },
    {
      "title": "Flutter架构概览",
      "url": "https://docs.flutter.dev/resources/architectural-overview"
    },
    {
      "title": "Flutter平台通道",
      "url": "https://docs.flutter.dev/platform-integration/platform-channels"
    }
  ]
};
export default article;
