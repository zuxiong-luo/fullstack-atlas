# next-production 作者验证

2026-10-24。status review，等待独立审稿与真实浏览器验收。macOS14.5 x64 / Node22.12.0 / Next16.4.2 / React与DOM19.3.1 / TS5.7.2，webpack，Cache Components关闭。

## 实际运行

在对应examples目录：

```sh
npm ci --ignore-scripts
NEXT_PUBLIC_SITE_TITLE=Build-A NEXT_TELEMETRY_DISABLED=1 npm run build
npm test
npm run typecheck
```

构建与 **8/8真实HTTP测试**通过。端口4336，测试结束释放；手工start是复现说明，不混称为已点过浏览器。

npm ci真实独立安装31包，未复用其他示例node_modules符号链接。webpack生产构建、standalone文件追踪与装配通过；测试把release复制到新临时目录再启动，扫描禁止外部符号链接，不能借用源码树运行。

验证追踪清单+asset实际读取、HTML+Next JS+public资源、全部浏览器JS秘密扫描、请求ID与受控错误、缺asset500后恢复、同一构建切换region与私有token而公开标题仍Build-A、缺配置启动拒绝。日志关联测试等待真实标记，不依赖stdout与网络事件恰好同顺序。

## 正文、图形与依赖

- 12块关键代码正文与实际文件连续原文映射；另有必要框架出处说明。
- 独立TypeScript类型检查、XML与源码匹配由下方复核追加。
- 两张SVG以940方形外框Quick Look真实渲染逐张查看，检查标签/方向/边界，未见溢出；不是移动浏览器验收。
- 精确版本锁包含依赖；生产示例实际npm ci，流式示例本地复用此前同版本运行时，另有独立锁供ZIP干净安装。

## 仍需根代理验证

- [ ] 真实浏览器首访、hydrate、按钮交互。
- [ ] 流式错误retry/生产计数按钮、移动视口。
- [ ] 下载ZIP干净安装、资产和离线包完整性。
- [ ] Linux/Docker/托管多区域等专用环境，未执行时明确保留。

当前只在macOS14.5 x64/Node22.12验证；没有Linux/Docker、托管多区域、CDN或反代缓冲测试。没有数据库/外部凭据服务或分布式span。health只代表存活，不保证关键asset或外部依赖就绪。构建于另一OS/架构时必须重新验证原生依赖。

公开构建标题的测试期望是Build-A；若自行换构建值，测试应一起改。真实.env不提交；.env.example仅教学占位。

## 最终静态复核

正文源码连续匹配12/12，两图XML有效，独立内容类型检查通过。示例npm run typecheck也通过。
