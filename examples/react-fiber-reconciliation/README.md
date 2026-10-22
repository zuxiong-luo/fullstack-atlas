# Fiber 与协调实验

使用真实 React / React DOM 18.3.1，Node.js 22，锁定依赖见 package-lock.json。

```sh
npm ci
npm test
npm run build
npm run dev
```

打开 Vite 输出的地址。初始 A/B/C 均为 0：

1. 给 A 加一，再重排为 C A B：A 仍为 1。
2. 刷新后改为 A D C：B 卸载，D 新挂载，A/C 保留。
3. 切换 key 并重置，给 A 加一再重排：下标 key 下 C 为 1，A 为 0。
4. 更换父级 key：所有行计数归零，旧 DOM 被替换。
5. 清空记录、给 A 加一、读取记录：layout setup 读到 DOM=1，两种 Effect 各自先清理旧闭包再建立新闭包。

读取记录自身会触发父组件渲染，不能把日志数量当提交次数。render 中记录日志只为教学诊断，不应用于业务副作用。示例无 StrictMode，便于单独观察正常路径；生产业务仍可使用 StrictMode。

测试检查实际 DOM 对象身份与公开行为，不读取 React 私有 Fiber 属性，也不测量绘制顺序或性能。源码解释位于配套文章，固定到官方 v18.3.1 tag；示例不是 React 内部算法的替代实现。
