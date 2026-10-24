# 跨平台离线同步与性能篇独立审校

独立审校人：python_course_finish；2026-10-25。范围为 mobile-offline-sync 与 cross-platform-performance 的正文、示例、图与验证记录。未修改作者实现/正文。当前结论：四项边界已由作者修正，审校人独立干净环境复测14/14与8/8、源码14/14，通过本次实现/概念/图文审校；新版窗口化真实浏览器由根另做，不伪称复测旧毫秒值。

## 已独立复现

- macOS14.5，固定CPython3.12.14；`/Users/luozuxiong/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m unittest discover -s examples/mobile-offline-sync -v`：13/13，5.221秒。
- Node22.12.0；`npm test`（cwd examples/cross-platform-performance）：tsc、esbuild生产构建与5项CPU测试通过。
- 正文全文复读，7+6块真实examples路径代码均为对应源码连续原文。13块初次映射通过。
- 两SVG以独立外层白色方形渲染框保留原始1040×580比例，用Quick Look1200px渲染并实际view_image；预览仅ignored work/expansion。两事务/重放身份/晚ACK/冲突图与实现吻合；四种测量边界图不将rAF叫物理帧，不将近似JS堆叫RSS。未冒称站点或手机验收。

## 发现并由作者修正（现已独立复核关闭）

1. 性能 `visibleRange(1,2000,320,32,0)` 返回end10，已渲染结束320而实际视口到321，公开允许的overscan0会缺1px。默认overscan3掩盖可视缺口，但非整行位置下方缓冲比“各3项”少一项。建议end按ceil((scrollTop+height)/rowHeight)计算，新增非整行与overscan0断言；完整覆盖后默认上界17而非16，需同步正文/test/App原文。根既有浏览器终点13不受影响，历史短窗口测量仍需标清版本。
2. 性能App在站内实验室没有独立index.html的__atlasBoot，当前undefined减法为NaN，JSON变null却仍标签HTML启动计时。需能力检测并明确unsupported，只独立入口测该边界。
3. 性能Worker构造器在try之前，能力缺失或策略拒绝可抛错，留下busy与objectURL。需把创建纳入try/finally，可选资源收口并恢复UI；不能为通过而全局放开策略。
4. 离线HTTP建议明确ProxyHandler({})，不继承环境HTTP_PROXY；HTTPError以with读/关，保持只loopback与重复冲突路径清理边界。现有13项协议数据路径未发现错误清除待办。

## 机制复读结论

离线示例的本地notes+pending单事务、远端正文+回执单事务、固定意图重放、版本条件写、旧ACK不覆盖新稿及新基线新ID、两设备显式冲突决策、单Local单在途约束、账号标签非加密/授权、上传不等于全量拉取均解释准确。测试真实SQLite文件/loopback HTTP、提交后断响应和文件关闭重开；没有把它说成OS断电、移动插件或真机后台能力。

性能采用明确Web代表平台、生产React构建、120步119间隔、同scrollTop和行高、真实Worker8×1MiB、transfer发送端脱离及接收首尾校验、非标准memory能力检测；最近秩8样本p95等于最大值。不将这些结果做跨框架/真机排名。根浏览器原始记录属另一独立证据源，审校人此处没有重复测得同一组毫秒数。

已浏览核对Python3.12 urllib.request（线上维护页3.12.15与实测3.12.14分开）、SQLite官方事务、MDN rAF与Worker构造器/消息语义；官方资料与自建教学协议分开。

## 修后干净环境最终复核

作者2026-10-25重新冻结后，独立读取全部改动并再次复现：

- 固定CPython3.12.14新建临时venv，`pip install --no-index -r examples/mobile-offline-sync/requirements.lock`，实际链接SQLite3.53.1；在示例目录`python -m unittest -v`为14/14（6.086秒）。继承不可达HTTP_PROXY/no_proxy空的新例也真实直连成功；HTTPError响应with关闭。临时venv正常清理。
- 将性能例子源文件复制到独立临时目录，排除node_modules/dist，再`npm ci --ignore-scripts --no-fund`安装12包、audit13包0漏洞；`npm test`生产build、tsc和8/8全部通过。没有依赖作者原node_modules，结束副本删除。
- 新visibleRange非整行overscan0真实返回end11，默认最多17项，正文与测试对应；HTML启动标记缺失明确supported=false；withOwnedWorker对URL/构造/运行统一finally，新构造器抛错、运行异常、正常三路径回收回归均通过，view外finally恢复busy。
- 最新正文mobile7块、performance7块共14块连续原文匹配；新增helper与正文映射准确。图意不依赖最大16这一旧上界，无需为了修数值重画。历史observed.json明确旧版10-24结果；新版改变窗口内容数量，不能把旧短窗口数字冒称修后重新测得。

未发现其他阻塞问题。作者无原生设备环境的限制保留清楚，不把纯核心/DOM实测推广为Flutter/RN原生或真机结果。审校人未操作作者4353浏览器fixture，也未宣称本站手机、离线包或浏览器最终验收；这些由根统一处理。
