import React from 'react';
import {View, Text, Button} from 'react-native';
import {router} from 'expo-router';
import {report} from '../lib/report';
export default function Notes() {
  React.useEffect(() => {report('list_mounted');}, []);
  return <View style={{padding:24, gap:16}}><Text>全部是假数据。离开页面、进入后台与原生调用分别处理。</Text>
    <Button title="打开教学笔记 n1" onPress={() => router.push('/note/n1')}/>
    <Button title="打开教学笔记 n2" onPress={() => router.push('/note/n2')}/>
  </View>;
}
