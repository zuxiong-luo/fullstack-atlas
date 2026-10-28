> 历史入门示例：对应的九篇正文已于2026-10-28撤稿。当前重写面向已有Node.js开发经验的读者；本目录不再作为现行Python系列入口。

# Python 从零开始：九篇文章的配套小例子

2026-10-26 重写版。不会 Python 可以从这里开始；不要求先会 JavaScript。前六篇只需要 Python 标准库。第七篇才安装 Web 依赖。每一篇先运行小脚本，再组合笔记本，不用先读懂整个目录。

原 `../chapter01`～`../chapter09` 是较复杂的导入工程，作为学完后的选读。那套数据使用 id/title/tags；本套使用 title/done，数据库文件也不要混用。第六篇的新示例在本目录，原 `python-async-services` 是另外保留的进阶项目。

## 环境与启动

本次实际验证：macOS 14.5 x86_64，CPython **3.12.14**。正文对应 Python 3.12 官方文档；官方维护页目前为 3.12.15，不代表本次换用了该解释器。Windows、Linux、其他版本尚未实跑本套示例。

从仓库根目录进入 `examples/python-course/beginner`。下载 ZIP 后先解压，进入 `python-course/beginner`，再运行下列命令。不要直接双击 Python 文件后等窗口一闪而过。

```bash
python3 --version
python3 -m venv .venv
source .venv/bin/activate
python --version
```

应选中 Python 3.12。Windows 可用 `py -3.12 -m venv .venv`，PowerShell 激活命令为 `.venv\Scripts\Activate.ps1`。这些 Windows 命令是使用方式说明，未作为本次实测记录。

## 按这个顺序练习

| 篇 | 先学什么 | 在本目录运行 | 应看到什么 |
|---|---|---|---|
| 1 | 变量、数字、文字、容器、判断循环 | `python values.py`、`python collections_demo.py`、`python control_flow.py` | 一行一行的值；待完成：学习 Python |
| 2 | def、参数、return、局部变量 | `python functions_demo.py` | 30、未完成标题列表、两份独立标签；生成器输出1和[2,3] |
| 3 | 类、实例、self、方法、组合 | `python -m learning_notes.models` | 第一条已完成、第二条未完成；另一个笔记本仍为空 |
| 3选读 | dataclass | `python dataclass_demo.py` | 字段相等为True，身份相同为False，第二份标签仍为空 |
| 4 | import、文件、JSON、异常 | `python files_demo.py` | 读回笔记、数量1、格式错误的提示；练习文件在临时目录，用完删除 |
| 5 | 顺序、线程、进程 | `python concurrency_demo.py` | 顺序与线程返回同样笔记列表，进程返回[1,4,9]，负编号错误 |
| 6 | async、await、任务 | `python async_first.py`、`python async_demo.py` | 等待前后两行；A/B执行顺序、取消与超时的清理记录 |
| 7 | HTTP与FastAPI | 先安装依赖，再 `python hello_api.py`；停止后 `python api_demo.py` | 4191端口的问候、笔记接口；401/422/400/201 |
| 8 | SQL、提交、回滚、保存 | `python sql_first.py`、`python storage_demo.py` | 内存表的一行；批次冲突回滚后只有原记录，最后数量2 |
| 8接口 | 同一接口改为文件保存 | `python database_api_demo.py practice.db` | 4192端口；重启同一路径仍有数据，同名标题409 |
| 9 | 环境、依赖、日志、测试、安装 | 见下文 | 从另一个目录也能运行安装后的命令 |

第一篇各标记段可以独立复制运行，文章说明每一行输出。后续文章中的函数、类节选依赖前面的定义，**正文标明“节选”时要放回相应文件，不要当独立程序运行**。完整可运行文件在本目录。

## 第七篇以后：安装锁定依赖

```bash
python -m pip install -r requirements.lock
python hello_api.py
```

打开 `http://127.0.0.1:4191/` 或用 `curl -s http://127.0.0.1:4191/`，应得到 `{"message":"你好，Python"}`。按 Ctrl+C 停止后，再运行 `python api_demo.py`，两者不能同时占用4191。

在另一个终端测试笔记接口：

```bash
curl -s http://127.0.0.1:4191/health
curl -s -X POST http://127.0.0.1:4191/notes \
  -H 'Authorization: Bearer study-token' \
  -H 'Content-Type: application/json' \
  -d '{"title":"学习接口"}'
curl -s -H 'Authorization: Bearer study-token' http://127.0.0.1:4191/notes
```

依次应看到 `{"ok":true}`、新笔记和一项列表。省略令牌返回401；缺少title返回422；只有空白的标题返回400。内存版每次启动清空，同一运行实例最多100条，满后409。固定学习令牌只为解释Header检查，**不构成生产账号系统**。监听地址仅为本机。

第八篇改为 `python database_api_demo.py practice.db`，请求端口换成4192；同名标题返回409。这是这一章新增的教学规则，不代表真实笔记产品都不能同名。

## 第九篇：命令与安装

保持环境激活，在本目录：

```bash
python -m learning_notes add --db practice-cli.db --title '学习打包'
python -m learning_notes list --db practice-cli.db
python -m unittest discover -s tests -v
python -m pip install --no-deps .
```

添加后日志写标准错误，标准输出为JSON列表。重复标题返回非零退出状态。安装前已经按锁文件装依赖，因此使用 `--no-deps`；否则不能跳过依赖安装。

换到其他可写目录，仍保持环境激活：

```bash
cd /tmp
learning-notes list --db /tmp/installed-notes-practice.db
```

新数据库应输出 `[]`。源目录外能运行，才证明使用的是安装后的包。此命令还支持add和serve；serve固定监听本机4192。选项 `--db` 优先于 `NOTES_DB` 环境变量，未设置时使用当前目录notes.db。安装不自动搬迁、备份或删除这些数据库。

构建wheel（先回到beginner目录）：

```bash
python -m pip install -r build.lock
python -m build --no-isolation --wheel
```

详见 [VERIFICATION.md](VERIFICATION.md)。所有网络例子只访问本机，不调用付费模型。线程/异步sleep是等待示意，不能用作真实服务性能证据。
