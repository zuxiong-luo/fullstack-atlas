# message-delivery：作者验证

2026-10-24，review，待独立审稿/站点验收。macOS14.5 x86_64 / Node22.12.0 / Redis server和cli7.0.4。

## 交付

`src/data/articles/tasks/message-delivery.ts`；`examples/message-delivery/`；`public/figures/message-delivery/pending.svg`；下载 `message-delivery/README.md`。

## 实跑

```sh
npm test --prefix examples/message-delivery
npm run check --prefix examples/message-delivery
```

最终6子场景，Node含父测试7 pass / 0 fail。3块正文完整源码映射（worker、redis、test）逐字通过。

1. 真实Worker读取后退出23，PEL1；其他消费者的>无新记录；重领同ID，ACK1再ACK0，PEL0/XLEN1。
2. 先ACK再退出，PEL0/重领空/无计数，原流1，漏做窗口被实际证明。
3. 朴素效果后退出，重领再做，计数20。
4. 安全效果后退出，AOF正常停启恢复；重领duplicate，同业务另一次传输仍duplicate，计数10/PEL0。
5. 同业务ID改amount99，明确冲突，保留pending且计数不变。
6. 两消费者先领first/second，受控先做second再first，证明交付顺序不能推出完成顺序。

实例固定56381、仅127.0.0.1；先确认自己进程Ready再连接和检查版本，不接用户6379。FLUSHDB只对新建私有实例。无npm依赖；AOF always，正常退出清理临时目录。min-idle-time=0仅在真实旧Worker退出后，不当生产抢占策略。

Lua将回执与计数写在同一Hash的一次HSET，先验证再写；不声称脚本出错能回滚之前写入。小整数计数不当金融精度实现，不保护外部邮件/支付或另一个数据库。

## 图形与来源

pending.svg用Quick Look真实渲染，/tmp方形视口审查完整横图；检查方向、PEL/XACK与业务回执分界，标签可读。正式图1120×620。不是站点或手机浏览器验收。

浏览Redis官方XREADGROUP、XACK、XAUTOCLAIM、持久化、Lua说明，并核对7.0.4固定tag命令JSON和redis.conf，未把新版CLAIM选项混入7.0.4。

## 未验证

RabbitMQ/Kafka/Redis集群、复制/故障转移、断电持久、死信流程、Linux/原生设备、生产吞吐。AOF仅正常停启验证。整站路由、手机视口、ZIP和离线清单由主代理整合后核验。

## 根代理站点复核（2026-10-24）

12篇路由逐篇打开，390px无页面横溢，高亮正常；每篇实际打开首图弹层确认加载，全部17张SVG在浏览器图库完整检查。七套React实验已实际编译/交互、手机视口检查；WebGL三套初始像素与独立页面丢失恢复首次getError=0。复制按钮最终显示已复制。范围、实际数据与仍未验证设备见 expansion-stage-01-browser.md；下载、冻结快照、离线与线上版本见后续发布记录。
