# sessions-lifecycle：作者交付与验证

2026-10-24；文章review，待独立交叉审稿、整站浏览器与资源检查。

## 交付与环境

`src/data/articles/identity/sessions-lifecycle.ts`；`examples/sessions-lifecycle/`；`public/figures/sessions-lifecycle/state.svg`；下载入口 `sessions-lifecycle/README.md`。

实际macOS14.5 x86_64、Node22.12.0 / 内嵌OpenSSL3.0.15+quic、CLI OpenSSL3.6.1。未修改站点现有鉴权、口令、共享types或聚合。

## 真实复现

```sh
npm test --prefix examples/sessions-lifecycle
npm start --prefix examples/sessions-lifecycle
npm run check --prefix examples/sessions-lifecycle
```

9个真实HTTPS子场景、1个独立JWT策略测试，包含父测试11 pass / 0 fail。5处正文映射为连续真实源码（sessions、server、client、jwt及完整JWT反例）。类型检查通过。

- 登录不采用攻击者选定ID；新Cookie标志文本正确/no-store，旧指定ID401。
- 本人笔记200、其他人笔记404，登录不代替授权。
- 缺CSRF/错Origin403；刷新换ID与CSRF，旧ID401；随机伪造401。
- 同旧ID并发刷新仅一笔200、一笔401。
- 假时钟只注入服务端时间判定：空闲10秒、绝对25秒，边界到期拒绝；9/18秒活动及显式续期可延短期，25秒绝对截止仍拒绝。网络仍真实HTTPS。
- 退出删除服务端记录、清Cookie，旧副本401。
- 超量正文413，坏口令401，缺Origin403。
- JWT签发/使用/退出/重放及30秒过期真实网络验证。
- 独立策略：改payload未改MAC、none、未知crit、错iss/aud、非法或未来时间、不同key、撤销与过期全部拒绝。

npm start仅打印200/404/401等状态，不输出可重放Cookie/JWT/CSRF或私钥。只用公开教学凭据，未使用真实个人密码。

## 语义审查

Cookie是载体、Session是状态、JWT是格式。正文完整展示随机ID、摘要键、双期限、单进程轮换、删除与Cookie作用域；CSRF与精确Origin并用；JWT固定HS256/HMAC与声明策略，不把decode当verify，不把签名当加密。

JWT仅30秒Access Token，无JWT Refresh Token服务；/refresh只作用于不透明会话。立即撤销使用jti Map并明确重新引入状态；重启内存数据/签名密钥丢失；多实例原子与共享撤销不在已验范围。正文未声称只删客户端能撤销复制品。

## 图与资料

SVG已用Quick Look渲染查看，核对随机ID→查表→轮换/期限/退出及JWT撤销状态；不是浏览器Cookie策略测试。正式图1120×690，临时方形包装只为完整缩略图审查。

实际浏览MDN Set-Cookie与CSRF；RFC7519、7515、8725、6265；Node22.12 crypto/https。生产建议用成熟库与等价策略测试，手写代码标为教学，不声称完整兼容所有JWT扩展。

## 限制

Node手动Cookie客户端不执行SameSite、Secure、前缀策略：此处只验头文本与服务端响应。未验浏览器跨站策略、真机、生产容量/限速/MFA、注册重置、共享存储、持久密钥轮换、跨实例撤销、真实数据库提交边界与审计。JWT撤销表也不是无容量成本。下载、离线包与站点浏览器等待主代理整合检查。

## 根代理发布前复核（2026-10-24）

正文图形完成网站1280×800及390×844检查，放大与局部滚动可用；图无正文矛盾、箭头遮挡或文字裁切。安全6/11、Python全前五章33、Next4/5/8真实用例通过；本批六套交付ZIP均解压到新目录，Node实际npm ci（Next另生产build），没有借用作者环境。Next路由另在实际浏览器验证计数2经Link保留、整页a重置0。以上补充作者阶段记录，不替代原文列明的浏览器Cookie策略、原生移动设备、托管平台或分布式边界。冻结站点、离线和发布证据另见批次记录。
