# 第4章：包、类型、异常与资源边界

运行基线：CPython **3.12.14**，标准库，无需安装依赖。本次在macOS14.5 x86_64实际运行；3.12官方文档页面维护版3.12.15与本地版本分开。前三章独立入口不变。

从仓库根目录进入 `examples/python-course`；下载包解压后进入 `python-course`。不要直接执行包内 `cli.py`，请用模块入口：

```sh
python3 --version
python3 -m chapter04.notes_tool fixtures/notes.jsonl
python3 -m unittest -v test_chapter04
python3 -m unittest -v test_course test_chapter04
```

`notes_tool`包含 `domain.py`、`errors.py`、`codec.py`、`app.py`、`cli.py`、`__init__.py` 和 `__main__.py`。公共API来自`chapter04.notes_tool`；普通import不读取文件或打印。

输入仍为课程 `fixtures/notes.jsonl` 的三条id/title/tags笔记。正常输出为 `count=3` 的JSON，第一条title为`Python 对象`、tags为`["python","basics"]`，输出顺序为n1、n2、n3，退出0。

```sh
python3 -m chapter04.notes_tool fixtures/bad.jsonl
# stdout为空；stderr含 import failed: fixtures/bad.jsonl: line 2；退出2
python3 -m chapter04.notes_tool fixtures/duplicate.jsonl
# stderr含行号与duplicate id；退出2
python3 -m chapter04.notes_tool missing.jsonl
# stderr含文件错误；退出2
```

异常策略：NoteError保护领域规则，ImportFailure加上物理行号并保留`__cause__`；CLI只处理可预期输入/文件错误。类型注解不替代运行时校验，程序缺陷如TypeError不会被笼统吞掉。

资源策略：`read_notebook(Path(...))`拥有文件，在with内完成消费；`build_notebook(lines)`只借用输入，不关闭调用者的流。导入成功后才返回聚合Notebook，坏输入不返回/打印半成品；这不是数据库事务，也不回滚外部副作用。

容量：4096是完整行读入后Unicode字符校验，包含换行，不是字节读取硬上限；Notebook保存全部结果，内存随笔记数量增长。本章不开放不可信上传服务。

6项独立测试已通过，连同前三章17项为23项，覆盖真实-m子进程、普通导入无输出、类型与校验、异常链/物理行号、成功失败关闭拥有资源、保持借用资源、程序错误传播和字符限制。未做静态类型检查器、Windows/Linux、浏览器或手机验收。
