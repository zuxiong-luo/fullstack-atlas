# Server Actions 与 Route Handlers 的可信写入

固定 Node **22.12.0**、Next **16.4.2**、React/React DOM **19.3.1**、TypeScript **5.7.2**。本机 loopback 单进程教学工程，无数据库、外部身份商和付费服务。

## 启动

```sh
cd examples/next-server-writes
nvm use
npm ci
cp .env.example .env.local
# 保持 Origin 为 http://127.0.0.1:4323，设置本地密钥与演示密码
npm run build
npm test
npm start
```

ZIP 解压后进入同名目录。测试自行启动/关闭 **4323**，注入独立凭据和 mkdtemp 文件，先等测试结束再启动人工服务。页面 http://127.0.0.1:4323 提供登录表单；使用 .env.local 配置的 alice/bob 演示密码。

.env.example 是公开教学占位值，不是真实凭据。环境密码加定长摘要比较不是生产密码存储；公开账号应使用适当的身份服务或慢密码哈希与防刷。本地 HTTP cookie 不带 Secure，公开服务必须 HTTPS 并配置安全属性。

## 手动正常路径

1. 登录 alice，创建标题为“first”的笔记，服务端生成 owner/id。
2. 登录 bob，自己的列表看不到 alice 笔记。
3. 登录表单只负责提交凭据；会话签名密钥、写门和数据文件没有交给客户端。

JSON 入口可用 cookie jar 复现：

```sh
curl -i -c /tmp/atlas-demo-cookie.txt -X POST http://127.0.0.1:4323/api/session \
 -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:4323' \
 --data '{"user":"alice","password":"alice-local-password-only"}'
curl -i -b /tmp/atlas-demo-cookie.txt -X POST http://127.0.0.1:4323/api/notes \
 -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:4323' \
 --data '{"title":"first","key":"demo-key-001"}'
```

密码需要与你的 .env.local 匹配。相同 cookie/key/title 重发返回同一个 id；同 key 改 title 返回409；bob 使用相同 key 是不同范围。额外 owner 字段422，跨用户资源404，缺会话401，跨站 API403，坏语法400，超1024字节413。

## 真实 Action 与验证

`npm test` 先要求已有生产构建，**8/8** 通过。除 JSON API 外，测试读取 SSR 表单中的真实 `$ACTION_ID_...`，以 multipart POST 提交，验证303、重复位置、坏输入和未登录；没有只 import 函数来假装通过框架。跨站 Action 可能由 Next 在自定义函数前拒绝成500，断言拒绝且没有写入，不宣称它与 API403 完全相同。

其他用例覆盖会话篡改、并发同键只生一条、冲突和用户隔离、字节/字段/Origin、存储损坏恢复，以及客户端 .next/static 无密钥和存储实现。

## 文件归属

- auth.ts / input.ts / errors.ts：身份、输入与受控失败。
- store.ts：owner/key 回执，串行门，笔记与回执同文件替换。
- API routes 与 app/actions.ts：不同传输，共用业务函数。
- app/page.tsx / Login.tsx：表单、结果提示与客户端交互。
- test/harness.mjs：生产服务启动与总会执行的清理。

## 明确限制

同进程 Promise 门不协调多个实例；文件 rename 不保证断电持久，也没有 fsync、数据库事务或完整恢复日志。等待队列、回执没有生产容量和清理策略。签名会话没有主动撤销，登录没有防刷。幂等不等于 exactly-once，也不阻止攻击者每次换 key。

macOS 14.5 x64 生产构建与真实 HTTP 已验；依赖本地复用且独立锁清单 dry-run 通过。未宣称全新网络安装、人工浏览器/手机、托管平台或真实数据库验收。ZIP 不含 node_modules、.next、data、私有 .env。离线源码下载不等于浏览器能启动服务。

## 发布前独立复核（2026-10-24）

根代理从交付ZIP解压到新目录，实际执行 npm ci --ignore-scripts、npm run build、npm test，8/8通过，未使用作者node_modules软链接。网站正文及图形已在1280×800与390×844视口检查；这不是Android/iOS真机或托管平台验收。服务端行为由真实HTTP用例验证，未声称浏览器缓存/身份策略全部验收。
