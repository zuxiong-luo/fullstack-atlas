# HTTPS / TLS 1.3：教学CA与真实认证边界

对应文章 `https-tls`。所有网络调用仅为127.0.0.1临时端口，没有公网扫描、系统信任修改或浏览器安全例外。

## 环境

实际验证：macOS14.5 x86_64，Node22.12.0（内嵌OpenSSL3.0.15+quic），**命令行OpenSSL3.6.1**。CLI与Node内嵌库是两个版本。过期证书测试使用OpenSSL3.6的 `-not_before/-not_after` 参数，不承诺旧版CLI可运行。

```sh
cd examples/https-tls
nvm use
npm ci
openssl version
node -p "process.versions.openssl"
npm test
npm start
npm run check
```

如需指定命令行版本：`OPENSSL_BIN=/absolute/path/to/openssl npm test`。没有npm第三方依赖，`npm ci`只核验锁文件。其他操作系统尚未实跑；没有nvm时直接使用已安装Node22.12.0。

## 文件与数据

- `certificates.mjs`：临时目录生成P-256教学CA和叶密钥，叶SAN仅localhost/127.0.0.1。私钥权限600，不打印、不入库。
- `lab.mjs`：TLS1.3服务及保留CA/名称验证的HTTPS客户端。服务固定临时协商组X25519；listen(0)选空闲端口。
- `test.mjs`：真实成功与失败握手，不用HTTP状态代替通道授权。
- `main.mjs`：自动请求并退出，只打印公开连接元数据及固定JSON。
- `verify-article.mjs`：仓库内检查正文映射代码是实际文件连续原文；独立ZIP找不到文章时明确跳过。

`expired:true`生成2024-01-01至2024-01-02有效的叶证书；这是明确过期的测试输入，不是假改Node客户端时钟。正常CA与叶证书有效一天。系统时钟错误可能导致别的验证失败，先修正环境再复现。

## 预期结果

5个子场景通过；Node含父测试 **6 pass / 0 fail**：

1. 显式信任教学CA、名称localhost：authorized=true、TLSv1.3、X25519、正确SAN、HTTP200。
2. 不提供CA：未知签发者/不完整信任路径类错误。本机UNABLE_TO_VERIFY_LEAF_SIGNATURE，测试仅允许相关有限错误码。
3. 有CA但名称wrong.invalid：ERR_TLS_CERT_ALTNAME_INVALID。
4. 有CA但叶证书过期：CERT_HAS_EXPIRED。
5. 客户端只支持TLS1.2：无共同协议，连接失败。本机EPROTO；不通过关闭验证绕过。

本机成功套件为 `TLS_AES_256_GCM_SHA384`。它不表示证书是RSA，也不表示临时组叫AES：本例证书签名/密钥是ECDSA/P-256，临时交换是X25519，记录保护AES-GCM。

## 信任与清理

只给单次Node请求传入教学CA，不加入系统钥匙串或浏览器信任库。没有rejectUnauthorized:false，没有空的主机名校验函数。每个服务结束时关闭连接、停止监听并删除自己生成的证书目录；生成失败也清理。系统强杀/断电不保证finally。

没有读取SSH私钥、真实生产证书、个人密码。ZIP中只包含生成代码，不包含已生成的密钥/证书。不要拿它生成的临时CA给生产站点部署。

## 尚未验证

图为标准逻辑示意，不是抓包记录。本项目未验证公共CA/中间链部署、吊销/OCSP、CT、ECH、mTLS、PSK/0-RTT、HTTP2/3、真实浏览器策略或生产握手性能。

资料：[TLS1.3](https://www.rfc-editor.org/rfc/rfc8446.html)、[服务身份](https://www.rfc-editor.org/rfc/rfc9525.html)、[Node22.12 TLS](https://nodejs.org/download/release/v22.12.0/docs/api/tls.html)、[OpenSSL3.6 x509](https://docs.openssl.org/3.6/man1/openssl-x509/)。
