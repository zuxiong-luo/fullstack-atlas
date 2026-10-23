import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'device_controller.dart';

void main() => runApp(const MaterialApp(home: DemoPage()));

class DemoSource implements TelemetrySource {
  final controllers = <String, StreamController<Reading>>{};
  @override
  Stream<Reading> watch(String id) =>
      (controllers[id] ??= StreamController<Reading>.broadcast(
        sync: true,
      )).stream;
  void emit(Reading reading) => controllers[reading.deviceId]?.add(reading);
  Future<void> close() async {
    for (final controller in controllers.values) {
      await controller.close();
    }
  }
}

class DemoPage extends StatefulWidget {
  const DemoPage({super.key});
  @override
  State<DemoPage> createState() => _DemoPageState();
}

class _DemoPageState extends State<DemoPage> {
  final source = DemoSource();
  late final controller = DeviceController(
    source,
    kIsWeb ? const UnsupportedFirmware() : const ChannelFirmware(),
  );
  int sent = 0;
  @override
  void initState() {
    super.initState();
    unawaited(controller.connect('A'));
  }

  @override
  void dispose() {
    controller.dispose();
    unawaited(source.close());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('设备状态与消息归属')),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: ListenableBuilder(
          listenable: controller,
          builder: (context, child) => ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const Text('模拟遥测，没有连接蓝牙、机器人或gRPC。固件按钮展示平台能力缺失的真实错误边界。'),
              Wrap(
                spacing: 12,
                children: [
                  for (final id in ['A', 'B'])
                    FilledButton(
                      onPressed: () => unawaited(controller.connect(id)),
                      child: Text('连接 $id'),
                    ),
                  OutlinedButton(
                    onPressed: () {
                      sent += 1;
                      source.emit(
                        Reading(controller.deviceId, sent, 80 - sent % 40),
                      );
                    },
                    child: const Text('发送一条当前设备遥测'),
                  ),
                ],
              ),
              Text(
                '设备 ${controller.deviceId} / 连接 ${controller.connection}',
                key: const Key('connection'),
              ),
              Text(
                '序号 ${controller.sequence} / 电量 ${controller.battery ?? "未知"}',
                key: const Key('reading'),
              ),
              FilledButton(
                onPressed: controller.command == 'pending'
                    ? null
                    : () => unawaited(controller.readFirmware()),
                child: const Text('读取平台固件'),
              ),
              Text(
                '命令 ${controller.command} / 固件 ${controller.firmware}',
                key: const Key('firmware'),
              ),
              const Text(
                'Web未实现atlas/device，所以预期unsupported；权限拒绝由平台适配器映射，测试另行模拟。',
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
