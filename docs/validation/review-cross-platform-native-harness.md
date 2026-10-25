# 跨平台原生验收工具独立审稿

日期：2026-10-25。审稿人 expansion_data，只读检查两套示例的 build_android.py、verify_emulator.py、verify-android.sh，以及为核对证据链所需的报告、签名/hash/source-map和文件读写入口；不重复文章、JS状态机或路由本身审稿。未改作者文件、共享工作流，未操作SDK、设备或真实Android模拟器。

本记录区分三件事：工具静态/合成检查、实际APK构建、真实模拟器运行。后两项以主代理独立CI结果为准，不能由本次静态检查替代。作者修复下列问题后已独立合成复核收口；目前未见剩余工具层阻断。实际APK/模拟器结果仍单独等待CI，不因此提前判为原生验收完成。

## 已核对的隔离与证据链

- 主入口先拒绝非Linux/非CI；运行阶段进一步要求明确emulator-*序号、qemu=1、x86_64，并拒绝覆盖已有同包名应用。所有adb命令明确指定该serial，只安装/停止/卸载自有 com.atlaslab.rnengineering 或 com.atlaslab.delivery；权限按钮仅用于自有实验请求产生的系统弹窗。未见adb kill-server、全局设备清理、真实账号签名或商店上传。
- 构建复制到私有临时目录，独立GRADLE_USER_HOME、固定本地模板、锁定依赖，prebuild修改只作用于临时Android工程。SDK组件由CI预装检查；保留到调用方明确指定的新/空artifact目录。模板Debug签名用于打包JS的release构建，不能称生产签名。apksigner必须实际验证，报告记录APK SHA256，交付篇还记录两版本map SHA256和相同证书摘要。
- 工件校验失败会抛错；build-only分支仅退出构建工具，不运行模拟器。当前工作流显式BUILD_ONLY=1，因此成功构建不等于生命周期、权限、真实UI或升级验收通过。
- RN运行等待HTTP gate与具体事件、id、状态，不把固定sleep结束当成功；HOME/返回Activity后等待真实AppState事件。文件分支要求真实往返与缺文件拒绝，权限分支等系统拒绝按钮及denied结果，明确不读取位置。
- 交付篇要求v1原生code=1且首次创建假文档，再以同证书install -r装v2；要求实际nativeCode=2/name=1.1.0、created=false且旧文档内容完全一致。只验证schema仍为1的本地文件保留，不据此证明任意迁移。
- 捕获的JS错误携带release/stack，对应APK/map字节校验后真实Metro符号化，并要求原文件和函数名；错release必须明确MAP_RELEASE_MISMATCH。它验证防误配，不防恶意攻击者同时改全部清单，也不是native进程崩溃/tombstone符号化。
- 降级必须出现具体INSTALL_FAILED_VERSION_DOWNGRADE，而非任意ADB失败；随后再次启动v2并读到旧假数据。异常均继续raise，未见把失败吞掉后打印验收成功的路径。

## 实际做过的本机检查

本机macOS14.5；工具检查使用系统python3（3.14.3）与GNU timeout，未把它写成CI目标环境。

- 四个Python脚本内存compile通过，真实运行入口均在macOS/Linux守卫处非0拒绝，未进入ADB/SDK操作。
- 两个shell入口bash -n通过，真实在不支持宿主执行返回77，未进入工具安装或构建。
- 安装存在检查修复后，分别注入空列表、只有相似包名、精确包名、ADB transport异常：每套4项通过；异常没有被当不存在吞掉。这些是helper合成检查，不能称实际Android安装。

## 审稿发现与修订状态

### 1. 包不存在的正常返回码被当作ADB错误：已修复并独立复核

原版用默认check=True的pm path判断包不存在；AOSP PackageManagerShellCommand.displayPackageFilePath不存在包返回1，导致新模拟器还没安装包就失败，成功卸载后的检查也失败。作者改为成功返回的pm list packages PACKAGE，并逐整行精确匹配 package:PACKAGE；相似包名不误判，transport非0仍报错。独立helper检查通过。

参考：[AOSP官方镜像的PackageManagerShellCommand](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/refs/heads/main/services/core/java/com/android/server/pm/PackageManagerShellCommand.java)，displayPackageFilePath/runPath；这里只用于核对返回码，不把其分支版本当本次模拟器版本。

### 2. 外层超时可能留下内层timeout监控的子命令：已修复并独立复核

使用作者原RN run函数和只写自有PID文件/等待的安全子进程，外层GNUtimeout 1秒触发TERM：外层exit124后，受监控子进程仍存活。原因是内层GNUtimeout另建进程组，Python收到TERM抛KeyboardInterrupt后subprocess.run异常清理杀了wrapper，但没有收口该组的子命令。交付篇同结构。该残留子进程已由审稿人手动终止，没有运行Android/Gradle。

合成证据：work/expansion/native-harness-timeout-review.json。已要求作者采用自有进程组的TERM、有限wait、KILL和reap等收口方式，再做同类合成复测。不能仅凭TemporaryDirectory退出就声称所有构建子进程已停止。

### 3. HTTP自报rendered与实际原生UI证据：工具已补，真实运行待CI

原先*_rendered仅来自React effect的HTTP报告，能证明实际进程执行/提交路径，却不是独立原生文字或像素证据。作者已新增UIAutomator解析自有Text中的JSON，精确匹配RN n2 ready、交付v1/v2的release/nativeCode，并通过adb exec-out screencap保存带PNG签名的截图。脚本静态链路已核对；目前不冒称这些断言已在模拟器执行。

### 4. server循环停止不等于请求线程收口：已修复并独立复核

原ThreadingHTTPServer默认daemon_threads=True。用两套原Handler、自有loopback随机端口和部分POST，执行现有shutdown/server_close/join后，server循环确已停止，但各仍有1个daemon请求线程等待输入。随后审稿人关闭自有socket并join，全部干净结束；没有设备操作。

证据：work/expansion/native-harness-thread-review.json。已建议作者设非daemon并让server_close等待有限请求结束（连接已有3秒超时、RN先释放所有gate），或准确收窄清理日志。该发现不证明任意外部网络服务有泄漏，只涉及工具当前“fixture threads stopped”的验收措辞与实现不完全对应。

## 限制

真实Linux APK构建、模拟器UI/生命周期/授权/升级及source-map符号化尚须主代理现场CI证据；不以本机guard、helper mock或安全子进程测试替代。SIGKILL/宿主故障无法保证finally，私有runner销毁是额外隔离边界。Android实体手机、iOS、生产证书、商店交付、OTA、native崩溃符号均不在这两套教学夹具已经验证的范围。

## 修后独立复核收口

作者两套build.run均去掉内层GNUtimeout wrapper，直接Popen(start_new_session=True)拥有命令进程组；内部deadline/外部TERM异常会TERM该组、有限5秒等待、必要时KILL，再reap直接子进程；正常命令结束也清掉仍在该组的后台成员。没有扩大到系统其他进程组。两套HTTP Fixture改daemon_threads=False/block_on_close=True；RN在CONDITION内先置AUTO_RELEASE并释放既有gate，避免枚举后新gate仍阻塞的竞态。

使用已有 **CPython3.12.14** 工具环境，审稿人分别在两目录实际运行：

```sh
/Users/luozuxiong/Documents/study/fullstack-atlas/work/expansion/python-web-venv/bin/python test_harness.py -v
```

两套新增安全回归分别 **3/3、3/3通过**，无跳过，每套约13.7秒。验证真实内部超时、真实外部TERM下忽略TERM的自有子命令被收口，以及部分HTTP POST连接在server_close前后请求线程真正join；没有调用ADB/SDK或实体设备。随后额外用自有子进程独立验证正常退出leader留有后台组成员的路径：两套均确实终止该组成员，而非只测异常分支。合成复核元数据在work/expansion/native-harness-revised-review.json。

原pm返回码问题、超时组成员、原生UI证据缺口及HTTP线程四项目前均已在工具层关闭：前两项和线程收口有真实本机安全回归，UIAutomator/截图是已补完整断言但仍待主代理模拟器真正执行。主代理仍需以对应提交的真实Linux构建、APK签名、原生UI/生命周期/权限、双版本安装升级、原栈符号化及清理输出验收；本记录不把安全合成测试当成Android通过。
