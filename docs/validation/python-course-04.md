# Python第4章：模块与边界验证

日期2026-10-24；文章`python-modules-boundaries`状态review。前三章正文/源码/测试未改，新增独立chapter04包、6项测试、分章README、可编辑SVG；工作树index和课程README增加第四章入口。

实际环境：macOS14.5 x86_64、CPython3.12.14，标准库。官方3.12文档当前页面维护版3.12.15，未混为实测版本。实际浏览核对modules、typing、contextlib、errors官方页面；正文就近reference并汇总链接。

在examples/python-course运行：

```sh
/Users/luozuxiong/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest -v test_course test_chapter04
```

结果**23/23通过**（原17项完整保留+新增6项）。真实子进程通过`python -m chapter04.notes_tool`检查正常3条、坏行stderr/退出2/stdout空，以及普通import无输出。另验证注解不替代运行时校验、JSONDecodeError/NoteError的直接原因链、重复ID物理行号、成功失败均关闭拥有资源而借用流保持打开、程序TypeError不被CLI吞掉、字符限制与导出容器独立。

文章约3727字符叙述，不含代码。7个带真实filename的代码块均为所对应模块**完整文件原文**，逐字检查相等。定向`tsc --noEmit --module esnext --target ES2022 --moduleResolution bundler --skipLibCheck src/data/articles/python/index.ts`无诊断。此检查验证文章数据类型，不是Python静态检查器。

`modules.svg`经XML解析与Quick Look实际渲染，通过view_image查看1000px预览，文字与箭头完整、资源拥有权同正文一致。验收PNG在ignored work/expansion/python04，public只保留SVG源文件。

已知边界：聚合Notebook内存随输入增长；4096是完整行读入后字符校验，非底层字节读取硬限制；with依赖正常控制流退出，非断电保证；整批返回非数据库事务。没有运行mypy等检查器，没有跨OS、全站浏览器/手机、ZIP下载或生产容量验收。第一批发布应使用主代理已冻结的前三章暂存快照，第四章在复审完成前不混入第一批ZIP。

## 根代理发布前复核（2026-10-24）

正文图形完成网站1280×800及390×844检查，放大与局部滚动可用；图无正文矛盾、箭头遮挡或文字裁切。安全6/11、Python全前五章33、Next4/5/8真实用例通过；本批六套交付ZIP均解压到新目录，Node实际npm ci（Next另生产build），没有借用作者环境。Next路由另在实际浏览器验证计数2经Link保留、整页a重置0。以上补充作者阶段记录，不替代原文列明的浏览器Cookie策略、原生移动设备、托管平台或分布式边界。冻结站点、离线和发布证据另见批次记录。
