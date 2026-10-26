# 入门示例实际验证记录

验证于2026-10-26～27；正文与命令对应CPython **3.12.14**、macOS14.5 x86_64。Web依赖全部来自requirements.lock，构建工具来自build.lock。

## 已运行

在本目录、已激活环境中：

```bash
python -m pip install -r requirements.lock
python -m unittest discover -s tests -v
```

**22项通过**。覆盖第一篇完整输出、每个标记段独立运行、常见错误、默认参数新列表、生成器耗尽、实例状态、dataclass、文件恢复与损坏、线程返回顺序、真实spawn进程、异步取消/超时清理、SQLite提交/回滚/重新打开、内存及文件API。真实HTTP测试启动127.0.0.1动态空闲端口，检查health、401、创建和读取后正常关闭；没有占用文章中的固定4191/4192。

另外运行 values.py、collections_demo.py、control_flow.py、functions_demo.py、dataclass_demo.py、files_demo.py、concurrency_demo.py、async_first.py、async_demo.py、storage_demo.py 和 sql_first.py，对照正文输出。并发sleep是本地模拟等待，不证明任何真实服务吞吐量。

## 普通安装产物

```bash
python -m pip install -r build.lock
python -m build --no-isolation --wheel
```

成功生成 `atlas_notes_beginner-0.1.0-py3-none-any.whl`。另建不继承系统包的新venv，按requirements.lock安装依赖及该wheel，清除PYTHONPATH，切换到源码之外的新临时目录：

- `learning_notes.__file__`指向新环境site-packages。
- `learning-notes add`与`list`读回同一数据，标准输出是JSON，INFO在标准错误。
- 重复标题退出2，标准输出为空；没有写入第二条。
- 安装后API的health、401、201检查通过。

这里没有用源码目录的导入成功冒充安装成功。完整ZIP包含教学脚本、测试、锁文件与此记录；wheel仅安装learning_notes包。

## 限制

未在Windows、实体手机、Linux或容器中实跑本套新示例。网页393/320手机视口验证只说明网页排版，不代表Python原生环境验证。SQLite文件与内存API用途不同；学习令牌不是生产账号系统。不测试付费模型、外部网络质量或生产负载。
