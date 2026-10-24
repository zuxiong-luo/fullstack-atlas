# node-performance-memory

Node.js **22.12.0**、原生ESM，无第三方npm依赖；macOS14.5 x64实测。精确引擎与package-lock独立。

## 命令

```sh
cd node-performance-memory
npm ci
npm test
node benchmark.mjs
node --expose-gc snapshot.mjs profiles
```

ZIP解压后进入对应目录；仓库中可`cd examples/node-performance-memory`。`npm test` **6/6通过**。示例不依赖数据库、密钥、UI沙箱或付费服务；源代码下载不包含Node运行时。

## 文件

work.mjs提供同结果同步/切片计算；metrics.mjs收集窗口指标，GC按startTime过滤且事件列表最多128。
server.mjs提供受限工作与窗口控制；harness.mjs创建独立被测服务进程。
load.mjs定义闭环、最近秩分位数、完成/成功吞吐和错误；benchmark.mjs输出原始窗口。
snapshot.mjs在--expose-gc子进程生成合成快照、解析类对象数和已知引用边；test.mjs不拿RSS下降当回收断言。

## 预期与实际证据

实际独立服务器进程、loopback HTTP、ELU/循环直方图/CPU/内存/GC采集。负载有界闭环，默认每模式20请求、并发2；本次两窗口各成功20、错误0，不把样本数字当生产成绩。

实际写出基线/保留/清理三份V8堆快照：AtlasNote数0→128→0；解析引用边确认global holder→notes，保留阶段128条指向实例的元素边，清理后0。观察到真实GC事件（最后记录4条，不保证任意运行恰好同数）。快照测试用临时目录，结束删除，没有读取用户进程或上传文件。

sync和chunked的checksum应一致；chunked让出真实事件循环机会，不保证更高吞吐。benchmark输出随机器变化，不应把一次p95排名当结论。手工profiles保存三份快照，Git和ZIP排除这些生成物；可用浏览器DevTools离线加载做进一步Retainers观察，本轮未冒称手工点过。

## 边界

- 最多100请求、并发8、服务4项在途、迭代1..2000000，目标只允许loopback。演示不是生产压测器。
- p50/p95统计所有尝试，失败另计；闭环不是开放到达负载，有协调遗漏条件。
- 客户端与服务端窗口略有边界差异；无直方图样本返回null，不能读成0ms；ELU不等同全机CPU。
- snapshot解析只覆盖当前Node/V8格式与本地可信样本，不是任意上传解析服务；快照同步耗时并可能需要额外内存。
- profiles可能含进程数据，示例只生成合成对象；不要上传真实秘密快照。释放对象不保证RSS立即回落。
- 没有Linux/容器/远程网络/生产吞吐、火焰图或用户真实进程诊断验收。

正文关键代码与真实文件连续匹配；两张可编辑SVG用Quick Look实际渲染检查。站点手机视口、ZIP干净安装及离线清单由主代理单列，不用CLI测试替代页面验收。
