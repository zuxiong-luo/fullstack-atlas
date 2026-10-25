# 离线资源导航修复独立审查

2026-10-25。审稿人 expansion_data，只读审查主代理对 scripts/sw.js、独立示例副本、正文和回归测试的修改；没有改源文件或共享工作流。结论：实际资源优先、仅应用入口允许shell回退的修复方向与本站hash路由契约一致，当前必要自动检查通过；浏览器下载管理器与最终发布仍由主代理现场验收，不用VM代替。

## 故障与证据边界

主代理现场发现：离线点击ZIP后浏览器下载工具超时，重置工具并检查tab inventory时，新tab35虽然保留ZIP路径，页面内容却是Fullstack Atlas首页；源站已关闭，curl返回7。此处是主代理真实浏览器观察，本审稿人没有冒称重新点击该下载。

旧Worker把所有request.mode===navigate直接改成scope/index.html缓存键。资源导航由浏览器发起，不能因navigate就认定它是本站应用入口；ZIP链接、Markdown链接和独立HTML都有机会经过文档导航路径。旧逻辑不仅会丢掉已缓存资源，还把根本未缓存的资源伪装成成功的首页响应。

## 修复契约复核

1. 保留同源、scope内GET及排除Worker/清单的前置过滤。
2. 每个完整快照先cache.match原request，直接返回已有Response；不是把实际URL改成index，也没有重新包装其字节或响应头。
3. 只有navigate且pathname精确为scope目录入口或该scope/index.html时，才允许补shell。#article/...不发送到服务器，因此本站hash路由仍从入口恢复。
4. ZIP、README、独立实验HTML与未知普通路径没有通用shell补偿；缓存未命中则fetch原request，真正离线时失败，不能伪装200首页。
5. query未被全局忽略，Cache.match仍按URL匹配；应用入口允许自己的shell回退，不代表任意ZIP加查询参数也自动命中无参数资源。

独立示例sw.js与主站scripts/sw.js逐字节一致；正文完整fetch块独立比较，确为当前源码连续原文。只更换导航策略，没有改完整标记发布、候选失败删除、两版本保留或命名空间清理协议。

## 实际执行的检查

环境：本机macOS14.5、Node.js22.12.0；不需要新增依赖或启动服务。

```sh
npm test -- src/lib/offline.test.ts
npm test --prefix examples/offline-first-static-site
node work/expansion/review-offline-resource-contract.mjs
```

- 主站专项Vitest：**5/5通过**，包含原导航/懒资源、失败更新、命名空间及新增两条资源回归。
- 独立示例node:test：**9/9通过**，无跳过；原七条加实际资源导航与缺失资源不得伪装首页两条。
- 为证明回归不是只在新实现里自证，使用f3494f21fd3b6f5b70aad155cd089fac3fa1f90c的旧SW（git blob ecaed7d517dde86fbd99c6947c9b39ae804bdd9a），在独立work副本运行同一九条测试：**原7条通过、新2条失败，退出非0**。第一条实际site-one而非archive-one，第二条缺失下载未抛拒绝。完整结果保存在work/expansion/offline-before-fix-proof/observed.txt，没有把这轮预期失败算通过。
- 额外独立VM用真实Response对象校验8字节二进制ZIP逐字节不变，Content-Type application/zip、Content-Disposition attachment和版本头保持；README与独立HTML原文保持。
- 额外检查scope入口shell回退、index.html带query回退，以及若缓存有真实入口则优先该Response。缺失ZIP、带不同query的ZIP、缺失独立HTML和非hash伪路由共4项都调用原请求网络并以network unavailable失败，没有返回首页。

VM夹具仍使用受控Cache接口和导航模式对象，不能模拟浏览器下载管理器、HTTP Vary实现、存储配额或多标签升级。检查保留二进制/响应头证明本次处理路径没有转换Response，不等于已跑完所有浏览器的下载行为。

## 审查期间发现的同步问题

- 主代理更新文章JSON时曾漏回const article: Article声明，造成模块语法/导出错误；审稿即时报告，主代理恢复声明。修后独立解析该模块并核对fetch源码块通过。首轮全站测试失败不能记作通过；完整全站重跑由主代理记录，本审稿只报告上述专项结果。
- README已改当前9项并保留2026-10-23原7项的历史范围。正文已增加ZIP导航实测故障及两条回归说明。
- 另报告正文示例中“把导航统一映射”的旧措辞：该例本身是scope入口，但容易误读全navigate规则。主代理已改为先匹配实际入口URL，只有此scope入口才补index；审稿再次复读该行，与实现一致，本项关闭。

## 资料与后续验收

核对了[MDN Request.mode](https://developer.mozilla.org/en-US/docs/Web/API/Request/mode)、[Cache.match](https://developer.mozilla.org/en-US/docs/Web/API/Cache/match)与[Service Workers fetch/respondWith规范](https://w3c.github.io/ServiceWorker/#fetch-event-respondwith)。导航模式不等于应用路由归属；Cache匹配默认不忽略search，匹配返回对应Response而不是自动替换成HTML。

最终需主代理用新Worker控制实际页面，再对已缓存ZIP、README和独立HTML进行离线访问，确认URL/媒体类型/真实字节或下载结果，随后核对离线包、示例ZIP和线上发布。旧完整缓存不会因本次策略修改自动更新文章内容，仍按本站显式下载更新流程处理；本修复没有承诺全站任意路径均可当作SPA路由。

## 最后收口

主代理报告修复声明后的完整站点测试40/40通过，并完成修复快照6aeaf9…的构建与资源核对（217 downloads、136 figures、349源码映射、86 ZIP）；这些是主代理结果，与本记录独立专项5/5、示例9/9分开，不声称由审稿重复执行。正文残留措辞已再次实际读取确认修正。当前无剩余代码/文案审查阻断；真实新Worker缓存升级与浏览器下载复验仍由主代理继续，尚不在本记录宣称完成。

## 增量审查：下载前显式更新Worker，状态读取不强制网络

主代理在真实浏览器复验中又观察到：新manifest与内容资源已下载，源HTTP日志却未出现sw.js请求，旧拦截逻辑仍工作。这说明“内容包更新”和“执行中的Worker更新”需要分别验收，不能用前者替代后者；此现场观察由主代理完成。

本轮只读审查新增src/lib/offlineWorker.ts及Offline.tsx调用路径，并实际跑必要专项。DOWNLOAD通过updateViaCache:none注册，再显式等待registration.update，优先新installing/waiting，待其activated后才发DOWNLOAD。若脚本字节未变而没有新worker，update成功后使用现有active是合理结果；update拒绝时直接失败，不偷偷向旧active宣称更新成功。STATUS/CLEAR使用既有active，不要求先更新脚本。

### 增量发现并修复的两个缺口

1. 初版helper(false)不调用update，但外层request每次仍register；[MDN register说明](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)指出重复注册仍可能请求脚本，因此只测helper不能证明整条STATUS链路不依赖网络。报告后，主代理增加offlineRegistration：非刷新先getRegistration，并要求scope精确相同；只在没有本站注册或明确DOWNLOAD时注册，不误用更宽范围的其他注册。新增容器级测试证明精确已有注册时register调用数0，宽scope不会误认。
2. 初版15秒只限制statechange激活等待，update本身可能迟迟不settle。主代理新增within，对getRegistration、register、update分别提供15秒调用方等待期限；finally清timer。它只是让UI停止等待，不能取消浏览器底层update，代码和文章均明确此区别。此为各步骤期限，并不是整个多步骤流程总共15秒。

### 监听、失败与补充独立复核

- 新worker激活、变成redundant或等待超时，均移除同一个statechange listener并清timer；挂监听后立即读取一次state，避免读取状态到监听建立之间的竞态导致漏掉终态。无worker明确拒绝。
- 初轮专项9/9通过，随后两处缺口修复并加四条回归后，本审稿人重新实际运行 `npm test -- src/lib/offline.test.ts`，当前 **13/13通过**。原9项并非新13项以外另加的验收数量。
- 额外使用独立受控scheduler实际执行当前helper的四条路径：激活成功、激活超时、redundant失败都确认listener/timer回零；永不settle的update在15秒模拟期限拒绝、timer清理且不触碰旧active listener。脚本为work/expansion/review-offline-worker-lifecycle.mjs。该检查是事件与期限模型，不是浏览器更新网络实测。
- 文章模块再次解析通过，客户端请求完整节选与src/components/Offline.tsx连续原文一致，新helper完整代码与src/lib/offlineWorker.ts逐字对应；不是只同步一句解释而遗漏实现。

核对[MDN update](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update)及register的updateViaCache说明：该选项只约束Worker脚本及import的HTTP缓存，不等于绕过内容CacheStorage，也不表示每次update必生成新worker。

本增量当前无剩余代码或正文审查阻断。主代理仍需在真实浏览器确认新脚本请求、Worker接管、缓存快照更新以及README/ZIP实际访问；本审稿没有在并行主浏览器中另行操作，不能把13项受控测试称为这些实测通过。

## 增量审查：页面fetch与Blob下载交接

本轮审查src/lib/exampleDownload.ts、ExampleDownloads.tsx及Articles.tsx的窄范围替换。首先澄清证据：主代理在修复Worker后观察到downloadMedia工具及IAB工具离线下载超时，**工具超时不能证明普通Chrome点击也失败**。不能由此推导“浏览器普遍不支持离线ZIP下载”。页面fetch→Blob路径仍有明确价值：让资源读取先经过页面受控请求，保留原字节，并能在交给浏览器保存前拒绝误回的HTML。

### 代码与状态边界

- 页面只拦截源码ZIP的无修饰主键点击；非ZIP说明文件、修饰键等保留真实href行为。示例路径来自受控文章元数据，而非访客输入。独立加载实际文章清单并规范化217条下载链接（其中103条ZIP链接，含共享示例重复），均位于同源/fullstack-atlas/downloads/；这不是宣称内部通用helper另实现了任意URL授权器。
- 请求经fetch后完整读取arrayBuffer，原始字节直接构造application/zip Blob。只检查PK0304开头以阻止HTML伪ZIP，不冒称通过中央目录、文件内容或CRC完整性检查；发布时逐条源文件比对与实际ZIP验收仍需另做。
- HTTP失败、离线未缓存和错误文件头都抛错。UI显示pending或就近错误，finally释放pending；没有把“已调用click”写成用户已保存成功。浏览器可能拒绝或提示下载，真实保存仍是另一层证据。
- 下载状态最初可能随React组件复用从A文章带到B；报告后主代理在ExampleDownloads使用key={a.id}，旧请求的状态不再污染新文章。没有为此调整导航、鉴权、首页或视觉样式。

### 失败收敛与资源释放的修复复核

初版fetch和body读取没有应用期限，返回响应头后正文停住可让pending持续。主代理补充覆盖fetch与arrayBuffer全过程的**60秒总预算**、AbortController及finally清timer。超时是停止准备并尝试中止自己发起的请求，不保证撤销任何外部服务副作用，也不等于浏览器已经保存或取消文件。

随后独立合成复现HTTP503错误body仍保持打开：函数虽已返回HTTP错误，却只清timer，没有abort该响应。报告后finally加入controller.abort。主代理新增真实loopback HTTP503持续body回归，审稿人实际复跑通过，观察服务器response close作为连接收口证据，不用固定sleep代替。

saveExampleArchive的outer try/finally覆盖createElement、append和click失败；anchor可选移除，Blob URL延迟60000ms回收，避免刚交接就立即revoke。独立受控DOM/scheduler四路径（成功、创建失败、append失败、click失败）均实际验证：已创建anchor被移除，同一对象URL在回调时回收；创建anchor失败时也不会漏掉URL清理。后台调度可能延迟定时器，60000是调度延迟，不宣称所有设备精确60秒释放。

### 实际复跑与源码同步

- 初轮helper4/4，补总预算后6/6；HTTP错误body收口后，审稿人再次运行 `npm test -- src/lib/exampleDownload.test.ts`，当前 **7/7通过**，包括真实HTTP错误连接close。前述数量是不同修订阶段，不相加为新测试数。
- 额外四路径DOM清理脚本：work/expansion/review-example-blob-cleanup.mjs，四项全部通过；它不模拟浏览器下载管理器。
- 离线文章再次解析成功，完整helper及下载控件两块代码与当前真实文件连续原文一致；Articles.tsx的文章身份key实际确认存在。
- 参考核对[MDN AbortController.abort](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort)及[URL.revokeObjectURL](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static)，区分响应体消费中止与Blob引用释放。

### 浏览器实测归属与冻结版本

主代理随后实际用普通Chrome点击，在源停止/curl7的离线条件下保存Downloads/cross-platform-delivery (1).zip，**79084字节，与52项测试阶段冻结的ZIP逐字节一致，25条目CRC正常**。这些是主代理现场下载及文件验证，不是由审稿人的VM或DOM模型推测出来。此结果也进一步说明此前工具自身timeout不能当作普通点击失败证据。

主代理报告补齐收口后的完整站点55/55通过；审稿独立报告的是上述当前7项下载专项。最终55项候选的正式冻结、构建包与线上资源仍由主代理再核对，不能把52项阶段实测文件或旧54项结果偷换成新55冻结版本。当前本增量无剩余代码、资源释放或状态审查阻断。
