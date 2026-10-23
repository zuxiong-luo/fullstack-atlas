import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:atlas_device/device_controller.dart';
import 'package:atlas_device/main.dart';

class DeferredFirmware implements FirmwarePort {
  final pending = <String, Completer<String>>{};
  @override
  Future<String> read(String id) => (pending[id] = Completer<String>()).future;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'switching device cancels old subscription and rejects wrong or stale readings',
    () async {
      final source = DemoSource(), port = DeferredFirmware();
      final controller = DeviceController(source, port);
      await controller.connect('A');
      source.emit(const Reading('A', 2, 80));
      expect(controller.battery, 80);
      // Deliberately put another device message into A's stream.
      source.controllers['A']!.add(const Reading('B', 3, 10));
      source.emit(const Reading('A', 1, 10));
      expect(controller.battery, 80);
      await controller.connect('B');
      expect(source.controllers['A']!.hasListener, false);
      source.emit(const Reading('A', 4, 1));
      expect(controller.battery, null);
      source.emit(const Reading('B', 1, 65));
      expect(controller.battery, 65);
      controller.dispose();
      await source.close();
    },
  );
  test(
    'late platform result from A cannot overwrite B; dispose invalidates pending result',
    () async {
      final source = DemoSource(), port = DeferredFirmware();
      final controller = DeviceController(source, port);
      await controller.connect('A');
      final old = controller.readFirmware();
      await controller.connect('B');
      port.pending['A']!.complete('A-old');
      await old;
      expect(controller.firmware, '');
      expect(controller.command, 'idle');
      final next = controller.readFirmware();
      controller.dispose();
      port.pending['B']!.complete('B-after-dispose');
      await next;
      expect(controller.firmware, '');
      await source.close();
    },
  );
  test(
    'MethodChannel call contract, denied permission and missing capability',
    () async {
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      final source = DemoSource();
      final controller = DeviceController(source, const ChannelFirmware());
      await controller.connect('A');
      messenger.setMockMethodCallHandler(ChannelFirmware.channel, (call) async {
        expect(call.method, 'readFirmware');
        expect(call.arguments, {'deviceId': 'A'});
        return 'v1';
      });
      await controller.readFirmware();
      expect(controller.firmware, 'v1');
      messenger.setMockMethodCallHandler(ChannelFirmware.channel, (call) async {
        throw PlatformException(code: 'permission_denied');
      });
      await controller.readFirmware();
      expect(controller.command, 'permission_denied');
      messenger.setMockMethodCallHandler(ChannelFirmware.channel, (call) async {
        throw MissingPluginException('test capability absent');
      });
      await controller.readFirmware();
      expect(controller.command, 'unsupported');
      controller.dispose();
      await source.close();
      messenger.setMockMethodCallHandler(ChannelFirmware.channel, null);
    },
  );
  testWidgets(
    'page exposes connection, simulated reading and unsupported platform status',
    (tester) async {
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(ChannelFirmware.channel, (call) async {
        throw MissingPluginException('test capability absent');
      });
      await tester.pumpWidget(const MaterialApp(home: DemoPage()));
      await tester.pump();
      expect(find.textContaining('设备 A / 连接 connecting'), findsOneWidget);
      await tester.tap(find.text('发送一条当前设备遥测'));
      await tester.pump();
      expect(find.textContaining('连接 connected'), findsOneWidget);
      await tester.tap(find.text('读取平台固件'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.byKey(const Key('firmware')), 100);
      expect(
        (tester.widget(find.byKey(const Key('firmware'))) as Text).data,
        contains('命令 unsupported'),
      );
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
      messenger.setMockMethodCallHandler(ChannelFirmware.channel, null);
    },
  );
}
