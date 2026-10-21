# Fullstack Atlas · 罗祖雄的全栈手册

个人名片 + 全栈学习知识库 + 浏览器代码实验室。纯静态 React / TypeScript / Vite 项目，无数据库、无业务后端，适合 GitHub Pages。

## 本地运行

Node.js 22（建议当前受支持的 LTS 版本），npm。

```sh
npm ci
npm run dev -- --port 4173
```

打开 http://127.0.0.1:4173 。停止服务：终端 Ctrl+C。

```sh
npm test
npm run build
npm run preview
```

## 已实现

- 个人名片、6 项能力证据、MV / Flutter 机器人 / 跨端业务 / 保险交易项目案例、GitHub 与邮件联系入口。
- 6 个知识领域、24 篇首批解析、3 条场景化学习路径。
- 全文关键词搜索、领域筛选、学习状态与收藏筛选。
- 每篇包含简答、原理、边界、追问、项目联系、关联题与官方参考链接。
- 客户端阅读口令、笔记、学习进度、收藏、代码草稿、JSON 导入导出。
- 响应式布局、移动端导航与编辑/结果切换、明暗主题。
- JS Worker 真实执行、5 秒运行上限、停止按钮、日志数量上限。
- TS 独立语义诊断及转译执行；内置 ES5 / ES2015 常用类型与 DOM 声明，非完整 npm 项目类型环境。
- React 18 单文件 JSX/TSX 编译与隔离 iframe 预览，支持 react / react-dom/client 导入；不支持任意 npm 包。
- 基于 hash 的路由和相对资源路径，可部署到 GitHub Pages 项目子路径。

## 个人模式

默认阅读口令：`luo0612`。在 `src/App.tsx` 的 `PASSWORD` 常量修改。

按项目需求，这只是客户端展示开关，不是安全鉴权。内容、源码及口令均可能被检查或绕过。不要存放凭证、公司机密或个人敏感资料。会话解锁状态保存在 sessionStorage。

## 数据与内容

- 文章与关系：`src/data/content.ts`
- 实验初始代码：`src/data/exercises.ts`
- 个人名片：`src/components/Profile.tsx`
- 视觉与响应式：`src/styles.css`
- 笔记、收藏、进度和草稿：当前浏览器 localStorage，键 `fullstack-atlas:v1`。

首版数据量较小，使用 localStorage（尚未切换 IndexedDB）。没有云同步；在“我的笔记”导出 JSON，在其他设备导入。导入会替换当前记录并提示确认。浏览器清理数据会删除记录。

内容为首批学习提纲，不是完整全栈教材。参考链接供进一步核验，平台行为应以目标版本为准。尚未实现 AI 问答、PWA 离线缓存、真实 Linux/K8s 远程实验、自动跨设备同步、多文件代码项目、代码评测系统。

## 代码运行边界

- JS / TS 使用浏览器 Web Worker，不是 Node.js，不提供 DOM API。
- TS 类型检查与 JS 执行分别展示；类型错误不会自动阻止转译执行。
- React 预览使用 sandbox="allow-scripts" 的 iframe，不开放同源访问能力。运行器通信校验 iframe 来源与每次运行 token。
- React 死循环仍可能造成浏览器卡顿；iframe 不提供 CPU/内存的硬隔离。不要用于运行未知不可信项目。
- Babel 与 TypeScript 编译器按需加载，体积较大；首页不会直接下载这两个编译器。
- React 运行依赖随静态站点发布，不依赖外部 npm CDN。

## GitHub Pages 发布

项目已提供 `.github/workflows/deploy.yml`，尚未创建远程仓库或执行公网部署。

1. 在你的 GitHub 账户新建 `fullstack-atlas` 仓库，并将本地项目推送到 main。
2. 在仓库 Settings → Pages → Build and deployment 中选择 GitHub Actions。
3. 推送 main 或手动执行 Deploy GitHub Pages workflow。
4. 部署成功后，以 Actions 返回的实际地址为准；通常为 `https://lzxdanny-debug.github.io/fullstack-atlas/`。

免费 GitHub Pages 的仓库可见性支持受账户套餐限制。公开仓库会公开源码与学习资料；私有仓库是否可发布 Pages 请核对你的账户权益。私有源码仓库也不等于 Pages 内容私有。

工作流运行单元测试、类型检查和生产构建，再发布 dist。无需添加数据库连接或部署密钥。

## 公开文章与个人练习

- `#library`：公开专题文章，正文位于 `src/data/articles.ts`，支持全文搜索和专题筛选。
- `#article/<id>`：公开文章详情，包含阅读准备、原理、代码示例和参考资料。
- `#paths`：公开文章学习路径。
- `#interview`、`#interview/<articleId>`、`#q/<id>`：需要阅读口令的面试题与关联练习。
- `#workspace`：需要阅读口令的个人笔记。

文章末尾链接到对应练习；面试题详情可返回关联文章。旧题目 ID、浏览器记录和备份格式保持不变。Flutter 文章已有正文，配套题目尚未整理，因此不展示无效题目链接。阅读口令仍为客户端展示开关，并不加密静态源码。

## 当前导航、登录与离线功能

学习路径入口已移除，旧 `#paths` 地址兼容到专题文章；研习入口改为 `#study`，旧 `#interview` 地址仍兼容。文章列表为单列。

右上角登录使用客户端演示账号 `luo` / `luo0612`，在 `src/App.tsx` 修改。旧阅读口令会话不再生效。未登录隐藏深度研习、我的笔记、离线阅读入口，并拦截直接访问。登录状态保存在当前标签页的 sessionStorage；关闭会话后需重新登录。这是静态站点的展示控制，不是服务端认证或内容加密。

`npm run build` 生成离线清单与 Service Worker；`npm run preview -- --port 4174` 可体验。登录后到「离线阅读」下载本站全部静态资源（包括延迟加载的编译器与 Worker）。外部评论和参考网站不包含在缓存中。缓存完整后可断网重新加载；更新需主动点「下载最新离线版本」并刷新。失败更新不替换完整版本，清除缓存不删除笔记。开发服务器不启用缓存，避免旧版本干扰热更新。托管环境需 HTTPS。

## GitHub Discussions 评论接入

目前尚无 GitHub 仓库，组件显示「公开讨论尚未启用」，没有模拟提交成功。

1. 创建公开 GitHub 仓库，在 Settings → General 开启 Discussions。
2. 在 https://github.com/apps/giscus 给该仓库安装 giscus。
3. 在 https://giscus.app/ 选择仓库和讨论分类（建议 Announcements），取得 repo、repo-id、category、category-id。
4. 填入 `src/data/community.ts` 的公开配置并重新构建发布，不需要前端访问令牌。

文章以 `article/<固定ID>` 映射独立讨论，留言板使用 `guestbook`，不依赖 hash URL 的 pathname，避免所有文章共用评论。数据保存在 GitHub Discussions，可通过 GitHub GraphQL API 导出 JSON，但本站尚未实现评论导出工具；不直接改写静态站点文件。邮件联系与公开讨论独立，邮箱按钮现在即可使用。
