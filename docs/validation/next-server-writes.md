# next-server-writes 核验记录

2026-10-24，review。macOS14.5 x64，Node22.12.0、Next16.4.2、React/DOM19.3.1、TypeScript5.7.2；webpack生产构建，单worker。

## 执行

`npm run build --prefix examples/next-server-writes` 成功；新增Login与页面反馈后已重建。`npm test --prefix examples/next-server-writes` 最终 **8/8** 真实生产HTTP通过，4323，临时文件和测试凭据隔离。

为节省磁盘，依赖用相同版本既有node_modules；独立清单的npm ci dry-run通过，未声称从新下载逐包重建。正常ZIP安装应npm ci/build/test。

## 用例

1. 演示密码失败、缺会话、篡改会话都401。
2. 两个并发相同owner/key/title只创建一个note，返回同结果。
3. 相同key换内容409；bob无法读取alice资源404，相同key在bob范围可新建。
4. JSON入口跨站403、坏语法400、owner注入422、超字节413。
5. 从真实SSR HTML提取$ACTION_ID，通过普通multipart POST调用Action：成功303、重放相同Location、坏输入/无会话受控拒绝，不是直接import函数的伪框架测试。
6. 文件损坏后API503通用错误、无堆栈或路径，恢复后200。
7. 跨站Action被框架或本例拒绝，笔记数量不变。Next可能在进入自定义函数前500，正文未把它说成统一403。
8. 扫描所有.next/static JS，不含服务端密钥名、实际测试密钥、服务端密码配置名和写入门实现。

## 正文与图形

11块完整examples路径源码均逐字匹配；关键类型、身份、输入、业务、调用端、表单和客户端登录均在正文。独立内容TypeScript检查通过。boundaries.svg XML通过，待实际浏览器/手机渲染。

核对Next官方mutating-data、data-security、Route Handler、redirect及16.4.2固定tag；正文把Server Action识别符和授权分开，把redirect框架控制流放在catch之外，把传输语义与同一个业务函数分开。

## 明确限制

单进程门不协调多实例；等待队列和回执无限制生产策略尚未实现；rename无fsync/断电持久保证。签名会话无撤销，演示环境密码加摘要比较不构成生产密码存储，没有登录防刷；本地HTTP cookie没有Secure，公开环境必须重设计HTTPS/身份/容量。幂等不等于exactly-once。

未做实际浏览器点击、hydration、手机、Vercel、数据库或生产负载验收；HTTP表单测试不冒充以上结果。data、私有.env、.next和node_modules不进入源码下载。共享站点聚合、下载和离线清单由主代理核验。

## 根代理发布前复核（2026-10-24）

正文图形完成网站1280×800及390×844检查，放大与局部滚动可用；图无正文矛盾、箭头遮挡或文字裁切。安全6/11、Python全前五章33、Next4/5/8真实用例通过；本批六套交付ZIP均解压到新目录，Node实际npm ci（Next另生产build），没有借用作者环境。Next路由另在实际浏览器验证计数2经Link保留、整页a重置0。以上补充作者阶段记录，不替代原文列明的浏览器Cookie策略、原生移动设备、托管平台或分布式边界。冻结站点、离线和发布证据另见批次记录。
