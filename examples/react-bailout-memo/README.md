# E1：memo 与 bailout 的真实 React 实验

固定 React/React DOM **18.3.1**，客户端 `createRoot`，无 StrictMode。不要把关闭 StrictMode 当生产建议；此处只是固定观察前提。

## 运行

Node **22.12.0**、npm **10.9.0**。完整仓库进入 `examples/react-bailout-memo`；ZIP解压进入 `react-bailout-memo`：

```sh
nvm use
npm ci
npm test
npm run build
npm run dev
```

不用nvm时手动切换Node后跳过第一条。Vite打印本机URL。`App.tsx`只导入React，站内实验室使用同一文件。其他锁定依赖：TypeScript5.7.2、Vite6.4.5、esbuild0.28.2、jsdom26.1.0。

## 五组操作

1. 父无关更新：Panel的title字符串稳定；其诊断计数保持。ObjectCard每轮收到新options对象，普通Plain也继续更新。
2. 子任务进度+1：Leaf更新，Panel的诊断节点保持。父bailout不冻结后代。
3. 面板自身state+1：自己的更新不受memo props比较阻止。
4. 切Context：Panel订阅Theme，仍需读取新值。
5. 父tick增加后点击错误比较按钮和默认比较按钮：前者仍读挂载时tick，后者读当前tick。错误比较忽略了函数prop。

## 诊断到底测什么

`CommitCount`是独立诊断节点，在layout effect里更新自己专用span，计数与DOM诊断都不在render里执行。它表示该观察点的已提交更新，**不是**全部组件函数求值次数，也不是毫秒、帧数或性能收益。它不会更新应用state来制造计数回路。并发放弃、StrictMode和热刷新会影响观察口径；本实验固定简单同步点击流程。

`test.mjs`通过jsdom挂载真实React DOM、act触发点击，断言公开结果。它不读取私有Fiber，也不是伪造一个memo运行器。jsdom不能证明浏览器布局和绘制性能。

## 源码核验

`source-notes/`包含官方v18.3.1源码快照、MIT许可、SHA-256及`excerpts.json`。测试校验快照哈希，并将每个代码段与固定行段逐字比较；在完整仓库中，还核对文章中内嵌的全部源码记录。独立ZIP不含站点文章TS文件，因此只验证随包交付的摘录清单与源码；不能声称在那里检查了未包含的页面。

源码和行为验证记录见 `VERIFICATION.md`。没有生产性能数据，没有把开发诊断次数转为性能结论。
