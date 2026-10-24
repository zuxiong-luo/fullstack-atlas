# 第9章：离开源码目录运行的笔记分发包

本章是第8章同步持久化服务的可安装快照，不包含第7章非耐久后台任务协议。src/atlas_notes已包含完整模型/领域对象/数据库/HTTP实现，不从课程chapterXX导入。sync_package.py从第4/7/8章生成六个模块，明确改相对import与服务标题/去掉旧env入口；--check拒绝漂移。旧章源码不改，配置、日志、CLI与测量模块为本章新增。

CPython3.12.14、SQLite3.53.1；runtime+测试/测量依赖requirements.lock与第7章相同。构建工具独立build.lock。pyproject.toml使用src布局、requires-python>=3.12,<3.13，固定setuptools75.8.0/wheel0.45.1；发行名atlas-notes-course，import名atlas_notes，入口atlas-notes。这三个名字用途不同。

## 从课程根构建

```sh
python3.12 -m venv .venv-web
.venv-web/bin/python -m pip install -r chapter07/requirements.lock -r chapter09/build.lock
.venv-web/bin/python chapter09/sync_package.py --check
.venv-web/bin/python -m build --no-isolation chapter09 --outdir "$PWD/.release"
# 安装锁依赖后安装产物，不使用editable：
.venv-web/bin/python -m pip install --no-deps .release/atlas_notes_course-0.1.0-py3-none-any.whl
```

构建前先同步检查，不自动把过期生成物当作最新实现。--no-isolation使用已安装并固定的build.lock；默认隔离构建时pyproject backend仍固定，但frontend另需安装。

## 配置和真实启动

从一个无源码的新目录执行已安装命令（下面两个入口任选一个）：

```sh
ATLAS_DB=/absolute/path/to/your/new/notes.sqlite3 ATLAS_TOKEN=local-demo-token-2026 atlas-notes
# 或python -m atlas_notes；默认127.0.0.1:8019，单worker。
```

ATLAS_DB必须绝对路径，token只允许16..128个ASCII字母数字下划线短横；token在repr隐藏，不写日志。ATLAS_POOL_SIZE1..4，默认2；ATLAS_PORT0..65535，默认8019（0由内核分配供验收）。未知ATLAS_配置键直接失败，配置失败JSON+退出2，不回显值。迁移/应用启动失败退出3。listener_bound日志不等于业务ready，仍要实际GET /health。

保留第8章GET/POST notes与POST imports（201同步提交），共享Bearer仍只供本地单权限实验。请求日志只记自产request_id、method、路由模板、status、elapsed_ms，不写header/token/query/raw path/body。X-Request-ID随响应返回。默认uvicorn access log关闭；JSON日志为本应用事件，不承诺第三方错误日志也全部JSON。进程停止关闭池与socket；强杀不能保证finally。

## 干净安装验收

```sh
mkdir -p .wheelhouse
.venv-web/bin/python -m pip download --only-binary=:all: -r chapter09/requirements.lock -d .wheelhouse
.venv-web/bin/python chapter09/verify_install.py \
  --wheel .release/atlas_notes_course-0.1.0-py3-none-any.whl --wheelhouse .wheelhouse
```

验证器新建独立venv，从wheelhouse离线安装完整锁和wheel；清除PYTHONPATH，cwd为独立临时目录，真实启动已安装atlas-notes，等待健康、认证/创建/冲突/422/查询，停止重启同一DB后笔记仍在，检查关联日志无token/标题。临时环境/DB全部自清理。下载wheelhouse需要网络；验证器安装阶段--no-index，不以源码目录/全局依赖成功掩盖缺包。可另外从sdist解包构建wheel验证源分发闭包，作者实测命令/结果在验证记录。

课程根全部单元/集成测试：`python -m unittest discover -s . -p 'test_*.py' -v`；前五章标准库独立33项命令`python -m unittest -v test_course test_chapter04 test_chapter05`不受Web依赖影响。第6章仍在独立examples/python-async-services。

## 本机测量与分析

先在已启动的8019服务中放入2条笔记，再运行：

```sh
ATLAS_TOKEN=local-demo-token-2026 python -m atlas_notes.measure --samples 32
python -m atlas_notes.profile_storage --output /absolute/path/to/storage.prof
python -m pstats /absolute/path/to/storage.prof
# pstats交互：sort cumulative；stats 15；quit
```

HTTP样本是同一连接客户端串行GET/notes，含HTTP收发与JSON解码，预热5次不计入，p50/p95为nearest-rank，吞吐仅为该并发1负载的完成率，不是服务器容量上限。服务日志elapsed_ms包含依赖/路由/发送路径，与客户端延迟口径不同，不能相减成精确网络耗时。

profile_storage在独立临时SQLite里放128条×2标签，预热5次后做20次snapshot，写真实cProfile文件并记录tracemalloc current/peak。带分析器的elapsed包含观测开销；tracemalloc只跟踪该Python进程分配，不是RSS，也不含全部SQLite原生页。两个实验负载不同，不拿数字互比提速。没有跨环境性能收益、生产容量或手机结果。

独立sdist解包后已经包含src快照、pyproject与锁文件，可在该目录安装build.lock并执行`python -m build --no-isolation`；它不再需要课程前章，也不从sdist运行课程侧sync_package.py。MANIFEST.in把requirements.lock/build.lock/verify_install.py带入源分发，wheel只带可运行包和元数据。课程ZIP仍保留生成器供作者核对连续性。

审稿前草稿的v1现已显式声明id TEXT NOT NULL PRIMARY KEY：SQLite普通rowid表的TEXT PRIMARY KEY本身仍可能允许多个NULL，不能套用其他数据库的直觉。该初始迁移尚未发布，修正后checksum改变；已有早期草稿DB会明确拒绝启动，不吞校验差异。只作实验且无保留数据时，停止服务并选择自己新建的另一个空路径；有真实保留数据时应设计追加迁移/表重建与NULL数据处置，不能自动删文件或伪造历史。
