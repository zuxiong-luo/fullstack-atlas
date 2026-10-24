# Python 笔记导入课程：第1～3章

本目录保留三份可以独立运行的阶段入口。三个阶段处理同样的 `id`、`title`、`tags`，依次学习语言基础、函数与迭代、对象模型。脚本只读取指定本地文件并写到标准输出，没有数据库或网络服务。

## 环境与文件

- Python **3.12.x**，本次实际验证 **CPython 3.12.14**，macOS 14.5 x86_64，2026-10-24。
- 只用标准库，无需 pip 安装或服务配置。`pyproject.toml` 声明 `>=3.12,<3.13`，不意味着已经在所有3.12补丁版或其他系统测试。
- 正文核对 Python 3.12 系列官方文档，页面当前维护版为 **3.12.15**；这不是本次测试解释器版本。
- 从仓库根目录 `cd examples/python-course`；下载 `python-course.zip` 的读者解压后进入 `python-course` 即可。

```text
python-course/
  .python-version
  pyproject.toml
  README.md
  chapter01/import_notes.py
  chapter02/import_notes.py
  chapter03/import_notes.py
  fixtures/notes.json
  fixtures/notes.jsonl
  fixtures/bad.jsonl
  fixtures/duplicate.jsonl
  test_course.py
```

三份脚本有意独立，避免学习某章还必须先运行前一章；它们重复的业务规则会在后续包与边界章节收拢。当前成果到第3章，后续模块、并发、FastAPI、数据访问和交付不在此包中。

## 输入契约

每条记录恰有三个字段：`id`、`title` 为非空字符串，`tags` 为字符串列表，允许空列表。ID、标题去掉两端空白；标签去空白、转小写、保序去重。拒绝额外字段、空白字符串和重复的规范化ID。

`notes.json` 是一个含三条记录的 JSON 数组；`notes.jsonl` 每个非空物理行是一条完整 JSON，内容为：

```jsonl
{"id":"n1","title":"  Python 对象  ","tags":["Python"," Basics ","python"]}
{"id":"n2","title":"生成器与迭代","tags":["Python","iterator"]}
{"id":"n3","title":"HTTP 请求","tags":["web"]}
```

JSONL 中的空行跳过但仍计入报错行号。`bad.jsonl` 第一行合法、第二行是破损 JSON；`duplicate.jsonl` 两条ID规范化后相同。不要把JSON数组直接交给第2/3章。

## 正常运行

以下 `python3` 必须指向 Python 3.12。先运行版本命令，若系统默认不是3.12，请替换为已安装解释器的绝对路径。

```sh
python3 --version
python3 chapter01/import_notes.py fixtures/notes.json
python3 chapter02/import_notes.py fixtures/notes.jsonl python
python3 chapter03/import_notes.py fixtures/notes.jsonl
python3 -m unittest -v test_course
```

第1与第3章返回同样的 JSON 值，格式空白不作要求：

```json
{"count":3,"notes":[{"id":"n1","title":"Python 对象","tags":["python","basics"]},{"id":"n2","title":"生成器与迭代","tags":["python","iterator"]},{"id":"n3","title":"HTTP 请求","tags":["web"]}]}
```

第2章只选含 `python` 标签的记录，输出两行，各为一个对象：

```jsonl
{"id":"n1","title":"Python 对象","tags":["python","basics"]}
{"id":"n2","title":"生成器与迭代","tags":["python","iterator"]}
```

命令正常退出码为0；错误写stderr，预期失败退出码为2。不要把所有终端内容都当作stdout。完整unittest包含真实CLI子进程断言，17/17通过；可以单独选 `test_course.Foundations`、`test_course.Iteration`、`test_course.Objects` 或 `test_course.CLI`。

## 失败与部分输出

```sh
python3 chapter02/import_notes.py fixtures/bad.jsonl python
# stdout: 已有n1的一行JSON；stderr: stream failed: line 2: ...；退出码2
python3 chapter03/import_notes.py fixtures/bad.jsonl
# stdout: 空；stderr: model import failed: line 2: ...；退出码2
python3 chapter02/import_notes.py fixtures/duplicate.jsonl python
# stderr含duplicate id；退出码2；前面可能已有stdout
```

第1章可复制 `fixtures/notes.json` 为自己的测试文件，将第一条 `tags` 改成字符串，得到 `tags must be a list`；将第二条 `id` 改成 `" n1 "`，得到 `duplicate id: n1`。这些输入变体也由unittest直接构造并验证，无需更改课程原始样本。

第2章创建生成器时尚未读入，推进时才执行函数体，`max_chars` 值检查也推迟到首次推进。遇到坏行时可能已经写出前面的输出。管道调用者必须同时检查退出码，不能用“输出文件非空”代表整批成功。

第3章先组装本地Notebook，完成后返回并输出；失败前不返回/打印部分结果。这个性质不等于数据库事务，也不回滚已经发生的外部副作用。这里没有外部写入。

## 容量与资源边界

- 第1章全量解析JSON数组并保存结果；第3章逐行解析但仍保存全部Note与索引，输出时还会创建列表和JSON字符串。
- 第2章按需读取、不聚合结果列表，但`seen`占O(已消费唯一ID数)空间，下游自行`list(...)`又会聚合选中结果；提前停止消费时，尾部未读取数据尚未校验。
- 第2/3章的4096限制是**完整行读入后的Unicode字符数校验**，含行尾换行。它不是底层字节读取限制或峰值内存硬上限；不要直接作为不可信上传服务的保护。
- 打开文件的CLI用`with`拥有资源，并在块内消费；读取函数借用文件，不把依赖已关闭文件的懒迭代器交出去。
- Notebook是单线程可变容器，遍历时不允许修改成员数量。`frozen=True`只限制Note常规属性赋值，稳定值还依靠字符串与字符串tuple的字段约束。

## 资料与验证范围

- [Python3.12函数参数与默认值](https://docs.python.org/3.12/tutorial/controlflow.html#more-on-defining-functions)
- [Python3.12作用域、迭代器和生成器](https://docs.python.org/3.12/tutorial/classes.html)
- [Python3.12 dataclass](https://docs.python.org/3.12/library/dataclasses.html)
- [Python3.12对象协议](https://docs.python.org/3.12/reference/datamodel.html)

已验证：CPython3.12.14上的17项标准库测试与真实CLI，包括流式部分输出、实例隔离、值相等/身份、运行时校验。没有性能收益结论。未验证：Windows/Linux与其他补丁版本、浏览器/手机视觉呈现、生产规模内存限制、真实数据库或HTTP服务。
