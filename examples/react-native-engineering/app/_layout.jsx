import React from 'react';
import {Stack} from 'expo-router';
import {LifecycleProvider} from '../lib/lifecycle';
export default function Layout() {
  return <LifecycleProvider><Stack screenOptions={{animation: 'none'}}>
    <Stack.Screen name="index" options={{title: '本机教学笔记'}}/>
    <Stack.Screen name="note/[id]" options={{title: '笔记与原生能力'}}/>
  </Stack></LifecycleProvider>;
}
