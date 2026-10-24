# Python第9章：作者验证与完整交付命令

2026-10-24，status review。不改共享分类index/catalog/types/workflow，保持前五章正文/实现与第六章原有ID。三篇新增正文分别约3420/3720/3980字符叙述（不含代码），不是短提纲。

## 实际环境与锁

macOS14.5 x86_64；sysctl报告Intel Core i7-9750H @2.60GHz，不保证固定调频/独占资源。CPython3.12.14（标准GIL），sqlite3.sqlite_version3.53.1，threadsafety3。

- `chapter07/requirements.lock`：完整Web运行/测试锁，FastAPI0.115.8、Pydantic2.10.6、Starlette0.45.3、Uvicorn0.34.0、HTTPX0.28.1及全部解析传递依赖。
- `chapter09/requirements.lock`：与7相同，供独立sdist验收，不需要读取前章文件。
- `chapter09/build.lock`：build1.2.2.post1、setuptools75.8.0、wheel0.45.1、packaging26.3、pyproject_hooks1.3.3。
- `chapter09/pyproject.toml`声明backend/直接运行依赖/console entry；MANIFEST.in使两锁与verify_install.py进入sdist。构建生成build、egg-info已从examples清除，仅用户源码保留。

## 全课程与安装的精确命令

在`examples/python-course`目录，干净venv：

```sh
python3.12 -m venv .venv-web
.venv-web/bin/python -m pip install -r chapter07/requirements.lock -r chapter09/build.lock
.venv-web/bin/python -m unittest discover -s . -p 'test_*.py' -v
.venv-web/bin/python chapter09/sync_package.py --check
.venv-web/bin/python -m build --no-isolation chapter09 --outdir "$PWD/.release"
mkdir -p .wheelhouse
.venv-web/bin/python -m pip download --only-binary=:all: -r chapter09/requirements.lock -d .wheelhouse
.venv-web/bin/python chapter09/verify_install.py --wheel .release/atlas_notes_course-0.1.0-py3-none-any.whl --wheelhouse .wheelhouse
```

作者实际在ignored work/expansion/python-web-venv新建并安装锁定版本，全范围discover **61/61通过**（原33+第7章8+第8章11+第9章8）。前五章仍只需标准库，独立命令`python -m unittest -v test_course test_chapter04 test_chapter05`；第6章在examples/python-async-services单独CPython3.12.14 discover **9/9通过**，不要求安装Web依赖。不能在未装FastAPI的环境跑新增全范围后把缺依赖当成前五章失败。

第9章8项验证：严格配置/未知键/隐藏repr/失败退出2、有效JSON转义、真实ASGI201/404/413/500请求ID与敏感内容排除、生成快照一致、真实cProfile含snapshot与有限内存范围、拒绝非loopback测量目标。

## 产物闭包实际证据

实际`python -m build --no-isolation chapter09`生成sdist和wheel；build默认也从sdist构建wheel。另外手动安全解包sdist至ignored目录，在解包目录再次`python -m build --wheel --no-isolation`成功，并用sdist携带的verify_install.py对该wheel再次完成独立安装验收。

验证器实际创建新的venv、`pip install --no-index --find-links ... -r requirements.lock wheel`、`pip check`；清除PYTHONPATH/用户site，cwd不含源码；atlas_notes文件来自新venv，没有chapterXX导入。执行已安装console entry（最新验证第二次用python -m atlas_notes），真正loopback动态端口健康→201创建/导入→409重复/422字段/401鉴权→GET2条→SIGINT优雅退出；同一DB再启动GET仍2条，2次退出0，日志有request_id/server_closed且无token/标题。校验版本元数据与__version__一致。临时venv/DB/进程自清理；没用editable install或system-site-packages。

初次完整报告在ignored work/expansion/python9-install-report.json，sdist独立报告python9-sdist-install-report.json；最终复验另存python9-install-final.json。它们是作者工作中间件，文章下载仅含可复现源码，不携带本机wheelhouse或产物。

## 实际测量，禁止跨口径比较

第一次完整安装验收的真实本机样本：HTTP串行并发1、GET/notes两条笔记、预热5次不计、32次含JSON解码，elapsed0.068677s，nearest-rank p50=2.093ms、p95=2.392ms，465.95 requests/s。仅这一轮串行完成率，不是服务器饱和容量，也没有对照优化收益。

另一独立存储负载：128条×2标签、预热5次、20次snapshot，cProfile+tracemalloc同时开启，带观测开销elapsed0.072231s，traced current32467B/peak78138B。真实写出profile并用pstats按cumulative打开，含snapshot。内存仅该Python进程被跟踪分配，非RSS/全部SQLite原生页；与HTTP两条负载不能相减/比较加速。后续复验会有不同值，未挑最好一轮替换首轮数字。

## 内容与图形终检

7/8/9文章全部带examples路径的代码块逐字连续匹配**6+3+9=18/18**；新增三篇独立内容tsc无诊断。三张SVG经XML与1100px Quick Look实际渲染逐张人工查看，修正第7章箭头与说明文字交叉后复验；预览位于ignored work/expansion/python7-9-figures，不进入public。图为职责/状态示意，不伪造性能曲线。

实际浏览PyPA打包教程、setuptools src布局，以及Python3.12 logging/cProfile/tracemalloc文档；区分当前维护官方页与固定实际构建版本。没有站点/手机浏览器验收、物理手机、Linux安装声明、TLS/多租户/生产容量、断电或磁盘故障验收。根代理后续交叉审稿和站点验收前保持review。

独立Data审稿发现并真实复现普通SQLite rowid表TEXT PRIMARY KEY接受多NULL：已在未发布初始v1显式增加NOT NULL，12项第8章/全课61项重跑通过；新增实际两次NULL插入均IntegrityError与PRAGMA notnull=1，正常非空仍可写。原历史拒绝测试扩展为真正按旧草稿SQL建文件后再用新SQL迁移，校验和不一致确实MigrationError，不静默吞差异。第9src快照同步，新sdist/wheel已重新构建并由新venv离线安装再验HTTP/重启通过。已有草稿DB按README选择自有新路径或设计追加迁移/表重建，不自动删除保留数据。核对SQLite官方quirks的PRIMARY KEY NULL条目；原初始v1未对外发布，故本轮修正初始迁移，未来已发布迁移仍不可改。
