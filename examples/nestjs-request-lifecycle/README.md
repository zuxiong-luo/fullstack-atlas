# nestjs-request-lifecycle

本章租户笔记服务的独立阶段入口。虚构数据tenant-a/alice、tenant-a/bob、tenant-b/bob；演示固定令牌不具备签发/过期/撤销能力，不是生产认证。

## 环境与安装

Node.js **24.14.1**，NestJS **12.2.0**，TypeScript **5.7.2**，RxJS **7.8.2**。

```sh
npm ci --ignore-scripts
npm test
npm run build
npm start
```

每个ZIP包含自己的源文件、package-lock和测试，不依赖相邻章。HTTP服务打印随机loopback端口；网站的固定4173端口不受影响。Ctrl-C关闭自己的演示。

## 手动输入

POST /notes，Authorization: Bearer alice-demo，Content-Type: application/json，正文 {"title":"first"}。数字title400、演示令牌错误403、title=crash500。

## 实测结果

2026-10-25，macOS14.5，Node24.14.1。`npm test`成功：**1/1真实HTTP测试**。

201/400/403/500/201，最终stored=2；非法字段和异常无额外内存写入，未知错误不返回私有消息。

## 范围与限制

只验证Express适配器、当前锁定版本、自有loopback环境；没有生产流量、真实身份平台、真实密钥、TLS、编排滚动发布或任意外部系统exactly-once证据。网页和离线包包含源码，服务端项目依赖仍需在本地安装。
