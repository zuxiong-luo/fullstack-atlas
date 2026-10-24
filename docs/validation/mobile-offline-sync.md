# mobile-offline-sync 验证记录

2026-10-24；作者自验待独立审校。段落约4268字符，7块正文源码连续映射，id/topic沿curricula，不修改分类index。

## 环境与命令

macOS14.5，CPython3.12.14，其链接SQLite3.53.1，无第三方Python依赖。requirements.lock明确标准库/运行时前提，pyproject要求3.12，.python-version固定3.12.14。

```sh
work/expansion/python-web-venv/bin/python -m unittest discover -s examples/mobile-offline-sync -v
```

实际13/13通过；另建立全新临时venv、--no-index安装空requirements.lock，从示例目录执行unittest，结果同13项，结束删除venv（完整最终结果由该命令本轮收尾确认）。没有将系统Python3.14的SQLite冒充目标环境。

## 真实行为

- 实际SQLite文件，notes+pending同一BEGIN IMMEDIATE事务；在写正文后受控抛错，事务回滚为hello且无待办。
- 中文正文HTTP往返保存你好/version2；HTTP是ThreadingHTTPServer loopback随机端口，无用户数据库/生产服务。
- 真实停止监听后连接拒绝，queued和本地稿保留。
- 远端真实COMMIT后关闭连接不发送ACK，客户端offline；关闭重开本地文件/HTTP服务后原op_id重放，版本保持2，不多递增。
- 在响应读取与本地ACK之间真实edit second，旧ACK不清新稿；新基线2+新id再提交得到second/version3。
- 两份本地SQLite模拟设备A/B独立编辑，B先提交，A收到409并保留双副本；明确保留本地新id→version3，另一例明确采用远端后清pending。
- 401、坏ACK保留待办；同id不同payload拒绝；重入guard拒绝；账号文件不匹配、NULL主键拒绝/foreign_keys开启；未发送编辑合并且新id。
- 所有服务线程、连接、临时目录在finally/teardown关闭清理。故障是协议屏障/关闭连接，不用sleep猜执行点。

## 开发故障与修正

首轮12项中账户不匹配报错被ProgrammingError覆盖：__init在事务内部关闭DB，退出上下文才ROLLBACK。已改为让异常先退出事务再在外层close，新增guard后13/13通过。未隐藏首轮失败。

## 图文与依据

7块源码连续匹配：schema、transaction、edit、sync_one完整、remote apply、ack、conflict/resolve。SVG XML通过，QuickLook实际渲染人工查看，两个事务/可能丢ACK/新稿/显式冲突方向一致无明显溢出。未自称浏览器/手机验收，图与文章渲染由根另验。

查阅SQLite事务/冲突/外键、Python3.12 sqlite3、Flutter offline-first官方指引；Python在线文档现3.12.15维护页与实际3.12.14环境区分。实现为本仓库教学协议，不是Flutter官方示例照搬。

## 限制

一个已存在笔记n1、单账号文件、单Local实例单在途同步，允许发送与ACK之间同实例UI edit。不支持多进程/多个Local共文件同步。local账号标签非加密或服务器授权；随机Bearer只是夹具。无全量/增量拉取、删除墓碑、自动合并CRDT、原生SQLite插件/后台执行/Android iOS真机/断电证明。存储重开不冒充OS进程被杀。外部副作用无exactly-once保证，回执永久保留未做归档。下载/离线资料与解释器安装分开。

## 2026-10-25独立审稿后修正

审稿建议显式隔离环境代理与关闭HTTPError：sync_one现使用build_opener(ProxyHandler({}))，HTTPError以with关闭。新增故意不可达HTTP_PROXY、清空no_proxy的真实loopback同步仍成功，现14/14。上一节全新venv13项为修前真实记录；此次标准库小修改复跑使用同固定3.12.14解释器，不冒称再次建立新venv。
