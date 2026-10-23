import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
function error(code) { return Object.assign(new Error(code), { code }); }
export const firmwarePort = {
  async read(deviceId) {
    const module = NativeModules.AtlasDevice;
    if (!module?.readFirmware) throw error('unsupported');
    if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
      const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      if (status !== PermissionsAndroid.RESULTS.GRANTED) throw error('permission_denied');
    }
    const result = await module.readFirmware(deviceId);
    if (typeof result !== 'string' || result.length === 0) throw error('invalid_response');
    return result;
  },
};
