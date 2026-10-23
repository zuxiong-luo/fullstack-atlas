import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class Reading {
  const Reading(this.deviceId, this.sequence, this.battery);
  final String deviceId;
  final int sequence;
  final int battery;
}

abstract interface class TelemetrySource {
  Stream<Reading> watch(String deviceId);
}

abstract interface class FirmwarePort {
  Future<String> read(String deviceId);
}

class UnsupportedFirmware implements FirmwarePort {
  const UnsupportedFirmware();
  @override
  Future<String> read(String deviceId) async {
    throw MissingPluginException('No web firmware adapter');
  }
}

class ChannelFirmware implements FirmwarePort {
  const ChannelFirmware();
  static const channel = MethodChannel('atlas/device');
  @override
  Future<String> read(String deviceId) async {
    final value = await channel.invokeMethod<String>('readFirmware', {
      'deviceId': deviceId,
    });
    if (value == null || value.isEmpty) {
      throw StateError('Empty firmware response');
    }
    return value;
  }
}

class DeviceController extends ChangeNotifier {
  DeviceController(this.source, this.firmwarePort);
  final TelemetrySource source;
  final FirmwarePort firmwarePort;
  StreamSubscription<Reading>? _subscription;
  int _generation = 0;
  bool _closed = false;
  String deviceId = '';
  String connection = 'idle';
  String command = 'idle';
  String firmware = '';
  int sequence = -1;
  int? battery;
  bool _owns(int generation, String id) =>
      !_closed && generation == _generation && id == deviceId;
  void _publish() {
    if (!_closed) notifyListeners();
  }

  Future<void> connect(String id) async {
    if (_closed) return;
    final generation = ++_generation;
    final previous = _subscription;
    _subscription = null;
    deviceId = id;
    connection = 'connecting';
    command = 'idle';
    firmware = '';
    sequence = -1;
    battery = null;
    _publish();
    try {
      await previous?.cancel();
      if (!_owns(generation, id)) return;
      _subscription = source
          .watch(id)
          .listen(
            (reading) {
              if (!_owns(generation, id) ||
                  reading.deviceId != id ||
                  reading.sequence <= sequence) {
                return;
              }
              sequence = reading.sequence;
              battery = reading.battery;
              connection = 'connected';
              _publish();
            },
            onError: (Object error) {
              if (_owns(generation, id)) {
                connection = 'error';
                _publish();
              }
            },
            onDone: () {
              if (_owns(generation, id)) {
                connection = 'closed';
                _publish();
              }
            },
          );
    } catch (_) {
      if (_owns(generation, id)) {
        connection = 'error';
        _publish();
      }
    }
  }

  Future<void> readFirmware() async {
    if (_closed || deviceId.isEmpty || command == 'pending') return;
    final generation = _generation, id = deviceId;
    command = 'pending';
    firmware = '';
    _publish();
    try {
      final value = await firmwarePort.read(id);
      if (!_owns(generation, id)) return;
      firmware = value;
      command = 'success';
    } on MissingPluginException {
      if (!_owns(generation, id)) return;
      command = 'unsupported';
    } on PlatformException catch (error) {
      if (!_owns(generation, id)) return;
      command = error.code == 'permission_denied'
          ? 'permission_denied'
          : 'failed';
    } catch (_) {
      if (!_owns(generation, id)) return;
      command = 'failed';
    }
    _publish();
  }

  @override
  void dispose() {
    _closed = true;
    _generation += 1;
    final subscription = _subscription;
    _subscription = null;
    if (subscription != null) {
      unawaited(
        subscription.cancel().catchError((Object error) {
          debugPrint('cancel failed: $error');
        }),
      );
    }
    super.dispose();
  }
}
