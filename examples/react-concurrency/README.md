# React 调度与输入实验

固定 React/React DOM 18.3.1，TypeScript5.7.2，Node22。锁文件记录依赖。

```sh
npm ci
npm test
npm run build
npm run dev
```

初始800行、每行16000次确定性运算；设备较慢时先降至200行/4000次，再输入abcdef。

- 普通更新：输入与列表参数一起更新。
- Transition：输入仍紧急，列表query在transition中更新，Results通过memo隔离旧query。
- 减少工作量：只显示前40行，是分页的简化对照，不是完整虚拟列表。
- 同步计算反例：startTransition回调里的CPU函数仍同步执行，不会自动变成后台任务。

测试验证真实React DOM的输入、最终列表参数与行数，不断言pending必须可见或提交次数固定。act会刷新工作，不代表用户真实设备时间线。

控制台“输入提交代理指标”只记录事件处理到layout effect的间隔，不是paint或INP。浏览器测量时固定设备、构建模式、工作规模，先预热再重复采集。没有提供生产提速百分比。
