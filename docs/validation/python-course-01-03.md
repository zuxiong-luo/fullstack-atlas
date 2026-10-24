# Python课程第1～3章交付与验证

核验日期：2026-10-24。状态：三篇均为 `review`。复用前任已完成的三个阶段脚本、fixtures、17项unittest与第1章正文；没有从头更换案例，没有提交或推送。

## 内容与交付

- 第1章 `python-language-foundations`：保留正文，复读语言/容器/CLI推导，补原始输入、就近资料、ZIP入口与核验日期。两段主脚本连续原文已恢复精确空行；叙述约3949字符，不含代码。
- 第2章 `python-functions-iteration`：约4353字符叙述，完整标准化/JSONL生成器/闭包筛选/CLI；解释默认值、参数绑定、作用域、迭代器耗尽、首次推进异常、文件生命周期与已发生部分输出。
- 第3章 `python-object-model`：约4916字符叙述，完整Note/parse_note/Notebook/导入与CLI；区分实例状态、值相等、对象身份、业务ID、哈希、组合与容器所有权。
- `src/data/articles/python/index.ts` 导出 `pythonExpansionArticles`，未改共享类型/目录模型。
- `examples/python-course/README.md`：阶段文件图、环境、完整输入输出、正常与失败命令、资源/容量边界及验证限制。第1章JSON数组，第2/3章JSONL，同一套笔记字段。
- 三张 `public/figures/python-{对应id}/flow.svg` 是可编辑源文件，正文有alt、caption与教学简化标记。第1章展示名字共享/重新绑定，第2章展示消费推进与yield返回，第3章展示独立字典与共享稳定值。
- 下载元数据均为 `python-course.zip`、`python-course/README.md`，无 `examples/` 前缀。下载实际打包、站点集成与浏览器验收由主代理统一负责，本记录不冒称已完成。

## 环境与命令

解释器：`/Users/luozuxiong/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`。实际 `sys.version`：CPython **3.12.14**（Clang22.1.3），`platform`：macOS14.5 x86_64。标准库，无第三方安装。

在 `examples/python-course` 执行：

```sh
/Users/luozuxiong/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest -v test_course
```

结果：**17/17通过**，0.689s（一次运行的日志耗时，不是性能基准）。含真实CLI子进程，分别断言stdout/stderr/退出码；坏JSONL第2章已输出一条后失败，第3章失败stdout为空。

在仓库根目录执行：

```sh
./node_modules/.bin/tsc --noEmit --module esnext --target ES2022 --moduleResolution bundler --skipLibCheck src/data/articles/python/index.ts
```

结果：退出0，无类型诊断。此命令针对三篇数据与导出，不替代全站构建。

静态逐字检查：解析三个TS中的文章对象，对所有带 `filename` 的代码块逐一与真实文件做连续子串比较；按章拼接主脚本块，要求**等于完整源文件**；原始JSON/JSONL块亦匹配。三篇共13个带真实文件名代码块均通过。检查下载元数据、图形存在与SVG XML均通过。发现第1章两段间少一个空行，已补齐后重新检查。

图形人工检查：使用macOS `qlmanage -t -s 1000` 实际渲染三张SVG，并通过view_image逐张查看1000px预览，确认文字、箭头、引用关系与边界提示可读、无裁切。仅验收用PNG已删除，public保留SVG。第1张末段改用 `import_notes` 标注数组逐条处理职责。**这不是站点渲染或手机验收**。

## 事实来源（实际浏览核对）

2026-10-24打开并核对下列Python官方3.12文档；页面标题当前显示维护版**3.12.15**，与实测解释器3.12.14分开标记：

- https://docs.python.org/3.12/tutorial/controlflow.html ：函数、关键字参数与默认值。
- https://docs.python.org/3.12/tutorial/classes.html ：名字/对象、作用域、实例与类状态、迭代器、生成器。
- https://docs.python.org/3.12/library/dataclasses.html ：字段注解、生成方法、frozen、eq/hash约定。
- https://docs.python.org/3.12/reference/expressions.html#generator-iterator-methods ：生成器推进/暂停/结束。
- https://docs.python.org/3.12/reference/datamodel.html#object.__hash__ ：对象、可变性、哈希与特殊方法。
- https://docs.python.org/3.12/tutorial/datastructures.html ：容器与原地修改。
- https://docs.python.org/3.12/tutorial/inputoutput.html#reading-and-writing-files ：文件迭代与资源生命周期。

正文在相关段落设置reference块，末尾汇总链接；项目代码与关键路径没有交给外链补齐。

## 审稿修正与限制

独立作者的17项复现及正文复读见 `docs/validation/review-python-01-03.md`，已收到“未发现阻断问题”反馈。下列四点在正文、README均明确：

1. `len(line)>4096` 是完整行读入之后的Unicode字符校验，包含换行，不是底层字节读取或峰值内存硬上限。
2. 第2章`seen`随已消费唯一ID数增长，下游聚合也会增加内存；第1/3章保存全量结果。提前停止消费的尾部未校验。
3. 第3章不返回/打印半成品只描述当前函数与CLI，不等于数据库事务或回滚外部副作用。
4. 生成器函数体内`max_chars`值检查发生在首次推进；参数绑定错误如位置传入关键字专用参数仍会在调用时失败。

未做：全站构建/ZIP下载与离线打开验收、浏览器与手机视觉检查、Windows/Linux、其他补丁版本、生产规模容量与性能测试。无性能提速、服务上线或数据库原子性声明。下一轮Python4～5与其他后续章节不在本次交付范围。
