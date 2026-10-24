# 专题扩充第二批：发布核对

2026-10-24。安全2、Next3、Python4/5，共7篇；站点56篇，原40篇身份保留。

实现提交4e663f7，随后ea021a67e36c07c4df6860cf1c112d5c5c88cbc1排除了误入源checkout的3个本地node_modules软链接，工作环境链接保留；ZIP一直排除依赖且干净安装通过。这个后续清理不修改任何运行源码或构建产物。

Pages实际成功：[40095088385](https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40095088385)。线上主脚本与已通过38/38和完整构建的Git树快照逐字节一致。

```json
{
  "asset": "assets/index-B-CtpMXR.js",
  "sha256": "72d7f606d48f18f7ca3b7fe487a84772ab1dbb375af4acc6020bafbb65d48400",
  "version": "b446e8d4ba5434ce",
  "files": 719,
  "bytes": 16135636,
  "archives": [
    {
      "name": "https-tls",
      "entries": 10,
      "bytesMatch": true
    },
    {
      "name": "sessions-lifecycle",
      "entries": 13,
      "bytesMatch": true
    },
    {
      "name": "python-course",
      "entries": 38,
      "bytesMatch": true
    },
    {
      "name": "next-routing",
      "entries": 26,
      "bytesMatch": true
    },
    {
      "name": "next-data-cache",
      "entries": 27,
      "bytesMatch": true
    },
    {
      "name": "next-server-writes",
      "entries": 31,
      "bytesMatch": true
    }
  ]
}
```

全部六套线上ZIP目录集合、每个文件字节均与验收快照一致；忽略容器时间戳和目录顺序，不忽略源码差异。719项离线资源、容量一致。实际关闭来源服务后的刷新、新文/图/高亮证据见 expansion-batch-02-browser.md。

GitHub当前Pages工作流仍有旧Action Node20目标和ubuntu-latest迁移提示；当前构建部署成功。这不是应用Node运行失败；后续维护可独立固定runner并升级相应官方Actions，不混入本轮正文改动。

限制继续保留：安全夹具不是浏览器跨站SameSite/Secure实测；Next本地服务不是托管多实例验证；390px手机视口不是Android/iOS真机。源码缓存不安装服务端依赖。
