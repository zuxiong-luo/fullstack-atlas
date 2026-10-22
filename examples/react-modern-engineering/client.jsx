import React from 'react';
import {hydrateRoot} from 'react-dom/client';
import {App} from './App.jsx';
const data = JSON.parse(document.getElementById('initial-data').textContent);
// 仅供故障演示：服务端输出 count=0，浏览器故意从 99 开始。
if (new URL(location.href).searchParams.has('mismatch')) data.count = 99;
hydrateRoot(document.getElementById('root'), <App data={data} />, {
  onRecoverableError(error) {
    console.error('hydration-recovery', {requestId: data.requestId, message: error.message});
  }
});
