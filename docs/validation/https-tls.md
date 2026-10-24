# https-tls：作者交付与验证

2026-10-24。状态review，待独立交叉审稿及整站浏览器/离线验收。

## 环境和范围

macOS14.5 x86_64；Node22.12.0 / 内嵌OpenSSL3.0.15+quic；CLI OpenSSL3.6.1。CLI负责临时证书生成，Node负责真实TLS；未混淆版本。

正文 `src/data/articles/identity/https-tls.ts`；示例 `examples/https-tls/`；下载 `https-tls/README.md`；图 `public/figures/https-tls/handshake.svg`。

## 实跑

```sh
npm test --prefix examples/https-tls
npm start --prefix examples/https-tls
npm run check --prefix examples/https-tls
```

5子场景，Node含父测试6 pass / 0 fail；3块正文完整真实源码映射通过（certificates、lab、test）。

真实成功：authorized=true、TLSv1.3、TLS_AES_256_GCM_SHA384、临时组X25519、SAN=DNS:localhost/IP Address:127.0.0.1、HTTP200固定JSON。

失败：未给CA为UNABLE_TO_VERIFY_LEAF_SIGNATURE；错名称ERR_TLS_CERT_ALTNAME_INVALID；过期叶CERT_HAS_EXPIRED；只支持TLS1.2的客户端EPROTO。未知CA测试只允许有限相关错误码，不接受任意异常当成功。

临时教学根/叶EC密钥P-256，CA用途和叶serverAuth/SAN明确；过期分支使用OpenSSL3.6的-not_before/-not_after（2024-01-01至02），没有篡改客户端时间。Node客户端始终rejectUnauthorized:true并保留checkServerIdentity；无系统信任库/钥匙串修改，无真实SSH或生产私钥读取。listen(0)只127.0.0.1；finally关闭连接/服务/临时目录。代码/ZIP不含生成私钥或证书。

## 文章与图形检查

正文区分CA证书签名、CertificateVerify持钥证明、ECDHE、HKDF及对称AEAD，不用旧RSA密钥交换解释TLS1.3。完整代码在正文，来源链接用于追溯。

SVG使用Quick Look真实渲染，在/tmp方形视口包装中看全横向内容，检查消息方向、加密阶段、认证范围；修正客户端标签溢出。正式SVG仍1120×770。不是抓包，未声称已验浏览器或手机。

## 一手来源

实际浏览：RFC8446、5280、9525、5869、9325；Node22.12 TLS/HTTPS；OpenSSL3.6 req/x509；MDN HSTS。以固定协议/版本与实际调用核对，不用搜索摘要替代。

## 未验证

公共CA/中间链、吊销/OCSP/CT、ECH、0-RTT/PSK恢复、mTLS、HTTP2/3、浏览器信任策略、生产负载或握手性能。未输出提速数字。全站路由、手机视口、下载ZIP与离线清单待主代理整合验收。

## 根代理发布前复核（2026-10-24）

正文图形完成网站1280×800及390×844检查，放大与局部滚动可用；图无正文矛盾、箭头遮挡或文字裁切。安全6/11、Python全前五章33、Next4/5/8真实用例通过；本批六套交付ZIP均解压到新目录，Node实际npm ci（Next另生产build），没有借用作者环境。Next路由另在实际浏览器验证计数2经Link保留、整页a重置0。以上补充作者阶段记录，不替代原文列明的浏览器Cookie策略、原生移动设备、托管平台或分布式边界。冻结站点、离线和发布证据另见批次记录。
