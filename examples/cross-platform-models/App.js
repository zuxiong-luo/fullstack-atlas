import React, { useEffect, useRef, useState } from 'react';
import { Button, ScrollView, Text, View } from 'react-native';
import { DeviceSession, createDemoSource } from './session.mjs';
import { firmwarePort } from './native-port.js';
export default function App() {
  const source = useRef(createDemoSource()).current;
  const current = useRef(null);
  const sequence = useRef(0);
  const [state, setState] = useState(null);
  useEffect(() => {
    const session = new DeviceSession(source, firmwarePort, setState);
    current.current = session; session.connect('A');
    return () => { session.dispose(); if (current.current === session) current.current = null; };
  }, [source]);
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
    <Text style={{ fontSize: 24 }}>RN设备状态与消息归属</Text>
    <Text>模拟遥测。没有实现原生AtlasDevice模块，固件读取应显示unsupported。</Text>
    <View style={{ gap: 8 }}>
      {['A', 'B'].map(id => <Button key={id} title={`连接 ${id}`} onPress={() => current.current?.connect(id)} />)}
      <Button title="发送当前设备遥测" onPress={() => { const session = current.current; if (!session) return; sequence.current += 1; source.emit({ deviceId: session.state.deviceId, sequence: sequence.current, battery: 80 - sequence.current % 40 }); }} />
    </View>
    <Text>{state ? `设备 ${state.deviceId} / 连接 ${state.connection} / 序号 ${state.sequence} / 电量 ${state.battery ?? '未知'}` : '初始化中'}</Text>
    <Button title="读取平台固件" disabled={!state || state.command === 'pending'} onPress={() => current.current?.readFirmware()} />
    <Text>命令 {state?.command} / 固件 {state?.firmware}</Text>
  </ScrollView>;
}
