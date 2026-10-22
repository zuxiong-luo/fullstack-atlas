# Fiber 身份与状态实验

React / React DOM 18.3.1，TypeScript 5.7.2，Node.js 22。依赖锁在package-lock.json。

完整仓库从根目录执行；下载ZIP解压后直接进入react-fiber-structure：

```sh
cd examples/react-fiber-structure
npm ci
npm test
npm run build
npm run dev
```

按终端地址打开页面。浏览器实验室载入的是同一份App.tsx。无接口和密钥；安装依赖需要联网。

1. 默认业务ID：给A加一，再交换顺序，A=1，B=0。
2. 切换key策略（主动重置实验）：给A加一再交换，A=0，B=1。
3. 制造非零计数后更换父级key：计数重置。
4. 制造非零计数后更换组件类型：计数重置，即使两种函数返回相同宿主标签。

源码中Counter和OtherCounter定义在模块顶层；没有用私有Fiber字段识别节点。测试是真实ReactDOM+jsdom+act，验证状态对应关系，不验证布局、绘制或调度时机。见VERIFICATION.md。
