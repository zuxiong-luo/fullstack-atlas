import type {Article} from '../../articleTypes';
const article: Article = {
  "id": "node-capacity",
  "topic": "nodejs",
  "title": "Node.js：事件循环、背压与服务容量",
  "description": "从大文件导出解释为什么异步代码仍会拖慢整个服务，并建立可测量的并发边界。",
  "minutes": 8,
  "tags": [
    "Node.js",
    "背压",
    "流",
    "容量",
    "Worker"
  ],
  "scope": "工程原理与教学案例；示例需根据项目环境补齐依赖与错误处理。",
  "prerequisites": [
    "Promise 与事件循环",
    "HTTP 服务基础"
  ],
  "sections": [
    {
      "id": "s15-423830",
      "title": "异步只是等待方式，不代表无成本",
      "paragraphs": [
        "Node.js 进程中的 JavaScript 通常在事件循环线程上执行；某些系统操作交给内核或工作线程池。一个异步接口调用之后的 JSON 解析、正则处理、排序和模板生成仍可能占用 JavaScript 线程。",
        "服务同时处理很多连接，不等于能够同时执行很多 CPU 密集任务。一次巨大的同步 JSON.stringify 可能阻塞其他用户的轻量接口。定位时同时看事件循环延迟、CPU、内存和下游等待，不能只看平均响应时间。"
      ]
    },
    {
      "id": "s16-457034",
      "title": "把数据当作流，而不是一次装进内存",
      "paragraphs": [
        "假设导出几百万条记录：先把全部行读入数组再生成文件，会把数据、字符串和缓冲区同时留在内存。流式处理让一部分数据完成后就被释放，但前提是生产者尊重消费者速度。",
        "write 返回 false 表示内部缓冲达到背压阈值，应等待 drain 再继续。高水位线不是整个进程的硬内存上限；其他队列、缓存和每个连接的缓冲仍会累积。pipeline 可以组织流的错误传播与结束清理。"
      ],
      "code": "// Node.js ESM 文件示例；不能在本站浏览器 JS 沙箱运行\nimport { createReadStream, createWriteStream } from 'node:fs';\nimport { pipeline } from 'node:stream/promises';\nimport { createGzip } from 'node:zlib';\nawait pipeline(\n  createReadStream('input.log'),\n  createGzip(),\n  createWriteStream('output.log.gz')\n);",
      "language": "js"
    },
    {
      "id": "s15-394781",
      "title": "并发、速率与排队容量是三个限制",
      "paragraphs": [
        "并发上限限制同时占用多少资源，速率限制每单位时间启动多少操作，队列上限限制等待区有多大。只控制并发而让队列无限增长，过载时会表现为内存和等待时长不断上升。",
        "一个稳定系统在稳态条件下可用 Little 定律作粗略容量检查：系统内平均任务数约等于到达率乘平均停留时间。它帮助发现估算不一致，但不代替突发流量测试、尾延迟和资源饱和分析。"
      ]
    },
    {
      "id": "s11-181294",
      "title": "CPU 工作与优雅退出",
      "paragraphs": [
        "CPU 密集的可分离计算可以交给 worker_threads 或专门任务服务，考虑线程启动、数据复制和结果传输成本。不要每个请求都创建无限线程；线程池也要有队列上限和超时预算。",
        "退出时先停止接新请求，再给在途请求有限时间完成，最后关闭连接。客户端断开后无用的导出应尽可能取消；已提交的业务写入则按幂等与恢复规则处理，不能简单随请求断开回滚外部副作用。"
      ]
    },
    {
      "id": "s10-352596",
      "title": "实践：用负载证明改进",
      "paragraphs": [
        "同时发送健康检查和大导出请求，比较一次性聚合与流式方案的 RSS、事件循环延迟及健康接口 p95。保持输入大小与并发一致，避免把“数据变少了”误当实现更高效。",
        "自测：CPU 很低但请求很慢怎么办？检查连接池、DNS、上游超时、数据库锁和排队时间；CPU 高且事件循环延迟高时，再抓 CPU profile。指标用于选择下一步证据，而不是直接猜结论。"
      ]
    }
  ],
  "questionIds": [
    "node-capacity-pressure",
    "node-capacity-cpu"
  ],
  "references": [
    {
      "title": "Node.js：不要阻塞事件循环",
      "url": "https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop"
    },
    {
      "title": "Node.js：Streams",
      "url": "https://nodejs.org/api/stream.html"
    }
  ],
  "status": "overview",
  "kind": "overview"
};
export default article;
