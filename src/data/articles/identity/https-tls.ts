import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "https-tls",
  "topic": "identity",
  "title": "HTTPS 与 TLS：从证书信任到加密通信",
  "description": "先分清身份认证、密钥协商和数据加密，再用真正的TLS1.3连接复现CA不受信、主机名错误和证书过期。",
  "minutes": 33,
  "labMinutes": 30,
  "tags": [
    "HTTPS",
    "TLS1.3",
    "X.509",
    "SAN",
    "ECDHE",
    "证书验证"
  ],
  "scope": "主线为HTTP/1.1 over TLS1.3、服务端证书认证与本机私有教学CA。解释完整握手，不实现自制TLS，不把PSK恢复、0-RTT、mTLS和HTTP/3称为已验证。",
  "prerequisites": [
    "理解HTTP请求与响应",
    "能运行Node.js项目；不要求会写密码学算法"
  ],
  "questionIds": [],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "Node.js 22.12.0（内嵌OpenSSL 3.0.15+quic）",
    "OpenSSL命令行3.6.1",
    "macOS14.5 x86_64"
  ],
  "verifiedAt": "2026-10-24",
  "examples": [
    { "label": "完整源码 ZIP", "path": "https-tls.zip" },
    {
      "label": "完整loopback实验与验证说明",
      "path": "https-tls/README.md"
    }
  ],
  "sections": [
    {
      "id": "concept",
      "title": "HTTPS是什么：给HTTP提供一条经过认证的受保护通道",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "HTTPS是通过受保护连接传输HTTP的方式。在本文的HTTP/1.1场景中，HTTP消息运行在TLS连接之上，TLS再使用TCP传输。应用仍然发送请求行、头和正文，只是在进入网络前，由TLS将它们封装成受保护的记录。HTTP/3使用QUIC并集成TLS1.3握手机制，传输层不同，不属于本实验。"
        },
        {
          "type": "paragraph",
          "text": "这条通道主要回答三个问题：连接的服务端是否是我想访问的对象；传输内容是否被旁观者读取；传输内容是否被偷偷修改。它们分别涉及身份认证、保密性与完整性。只做到“双方用某把钥匙加密”，却没有确认对方身份，攻击者仍可能分别和两边建立自己的加密连接。"
        },
        {
          "type": "paragraph",
          "text": "HTTPS也不等于网站的每个业务行为都安全。服务端仍然能读到自己的请求，SQL越权和XSS不会因为传输加密自动消失，HTTP里的用户身份仍需登录态与权限检查。我们先理解通道的责任，再用一个只返回200 JSON的本机服务验证证书与协商边界；真实账户与密码不参与实验。"
        },
        {
          "type": "reference",
          "title": "RFC9325：TLS安全使用的范围与建议",
          "url": "https://www.rfc-editor.org/rfc/rfc9325.html"
        }
      ]
    },
    {
      "id": "roles",
      "title": "证书、公私钥和会话密钥，不要混成一把钥匙",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "证书是一份带签名的身份材料，包含公钥、名称、有效期及扩展约束。CA使用自己的签名密钥签发证书；客户端依据预先信任的锚点和路径规则判断是否接受。服务器在握手里还要证明自己持有与证书公钥配对的私钥。拿到一张公开证书，不能因此冒充它的持有者。"
        },
        {
          "type": "paragraph",
          "text": "密钥协商解决另一件事：通信双方怎样得到共同秘密，同时不把共同秘密本身直接发出去。本文使用TLS1.3中的临时椭圆曲线Diffie–Hellman协商，常简称ECDHE。客户端和服务器各有临时私有材料，交换公开份额，各自算出相同的共享秘密，再通过密钥派生得到握手和应用流量所需的密钥。"
        },
        {
          "type": "paragraph",
          "text": "bulk数据保护主要使用对称的AEAD算法，例如本机协商出的AES-GCM。AEAD同时提供加密和认证标签，错误的密钥或被修改的受保护内容不能通过相应验证。不要把TLS1.3概括为“客户端生成随机数，用证书里的RSA公钥加密给服务器”。旧式RSA密钥交换不是TLS1.3普通证书握手的工作模型。"
        },
        {
          "type": "table",
          "headers": [
            "对象",
            "本例选择",
            "解决的问题"
          ],
          "rows": [
            [
              "CA/叶证书的密钥与签名",
              "ECDSA、P-256证书密钥",
              "建立证书归属与握手持钥证明的认证基础"
            ],
            [
              "临时密钥交换组",
              "X25519",
              "双方协商共享秘密，不公开临时私钥"
            ],
            [
              "握手与流量密钥派生",
              "TLS1.3密钥调度与HKDF",
              "为不同阶段和方向派生所需材料"
            ],
            [
              "记录保护",
              "本机TLS_AES_256_GCM_SHA384",
              "AES-GCM保护记录；名字不描述证书算法或ECDHE组"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "证书使用P-256，并不要求临时协商也使用P-256。本例特意把临时组设成X25519，真实客户端报告的ephemeral信息可以验证这层区别。HKDF不是把一个字符串随手hash一下；TLS协议还将协商与握手上下文纳入密钥调度。本文让成熟运行库实现这些细节，不交付一份自制密码协议。"
        },
        {
          "type": "reference",
          "title": "RFC5869：HKDF的提取与扩展用途",
          "url": "https://www.rfc-editor.org/rfc/rfc5869.html"
        }
      ]
    },
    {
      "id": "trust",
      "title": "客户端究竟在信任证书的什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "访问https://localhost时，客户端先有一个想验证的目标名称localhost，然后才收到服务端提供的证书。正确顺序是用这个既定目标核对证书，而不是收到证书后改口说“它自称什么我就访问什么”。主机名检查主要看subjectAltName中的合适名称或IP标识，不能只看证书上有一个好听的CN。"
        },
        {
          "type": "paragraph",
          "text": "信任路径与名称匹配是两道检查。证书可能确实由可信CA签发，却签给另一个域名；也可能名称刚好正确，但签发者不在客户端信任范围。有效期、用途和路径约束也属于验证的一部分。“证书有签名”只说明存在一段签名数据，不能替代这些检查。"
        },
        {
          "type": "paragraph",
          "text": "生产常见服务端发送叶证书及必要中间证书，客户端用自身信任锚点构造并验证路径；不是网站随手发来一个自签根就自动获得信任。本例没有中间层，直接由临时教学CA签叶证书，客户端只在这次请求的ca选项里信任它。系统钥匙串、浏览器信任库与其他应用均不改变。"
        },
        {
          "type": "reference",
          "title": "RFC5280：X.509路径、用途和约束",
          "url": "https://www.rfc-editor.org/rfc/rfc5280.html"
        },
        {
          "type": "reference",
          "title": "RFC9525：服务身份与目标名称验证",
          "url": "https://www.rfc-editor.org/rfc/rfc9525.html"
        }
      ]
    },
    {
      "id": "handshake",
      "title": "把三种职责放回一次TLS1.3握手",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "figures/https-tls/handshake.svg",
          "title": "完整证书握手中的消息与认证边界",
          "alt": "双方交换临时份额并派生握手密钥，服务端发送加密证书与持钥证明；客户端完成验证与Finished后，HTTP由应用流量密钥保护。",
          "caption": "逻辑时序示意。省略可选消息与TCP，不声称已做逐包抓包、恢复握手或0-RTT实验。"
        },
        {
          "type": "paragraph",
          "text": "先看普通完整握手。ClientHello提出支持的版本、协商参数和临时公开份额等；ServerHello选择参数并返回服务端临时份额。双方由此进入相应的握手密钥阶段。TLS1.3中，ServerHello之后的主要服务端认证握手消息已经受到加密保护，并不是先把所有证书和签名明文交换完，最后才第一次出现加密。"
        },
        {
          "type": "paragraph",
          "text": "证书链上的CA签名，和CertificateVerify中的握手签名，检查的对象不同。前者把身份材料和签发者信任联系起来；后者让服务器用证书对应私钥证明自己参与了这次握手。Finished进一步校验握手相关上下文。客户端必须把这些认证步骤连起来，而不能只因已经算出一份共享秘密就信任对方。"
        },
        {
          "type": "paragraph",
          "text": "完成相应握手后，用于应用数据的流量密钥按方向区分，HTTP请求和响应进入记录保护。图里把多条握手消息放在同一条箭头上便于阅读，不等于它们在真实网络中永远恰好占一个包。TCP分段、记录边界和业务消息边界也不是同一层。"
        },
        {
          "type": "paragraph",
          "text": "临时协商提供前向保密的基础：在满足临时私钥得到妥善处理等前提下，日后拿到服务器长期认证私钥，不应直接解出过去捕获的普通ECDHE会话。本篇没有验证内存取证，也不把这个结论无条件扩展到每一种恢复或早期数据模式。0-RTT另有重放边界，不能只为减少等待就把扣款等操作当作可安全重放。"
        },
        {
          "type": "reference",
          "title": "RFC8446：TLS1.3完整握手与密钥调度",
          "url": "https://www.rfc-editor.org/rfc/rfc8446.html"
        }
      ]
    },
    {
      "id": "certificates",
      "title": "先在临时目录建立一个可检查的信任范围",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "示例使用命令行OpenSSL3.6.1生成一对教学CA和叶证书，Node22.12.0实际握手使用其内嵌OpenSSL3.0.15+quic。这是两个程序的版本，不能看到openssl version就假设Node也链接相同库。项目没有npm第三方依赖，只有本地CLI和Node。"
        },
        {
          "type": "code",
          "code": "import { execFileSync } from 'node:child_process';\nimport { mkdtemp, readFile, writeFile, rm, chmod } from 'node:fs/promises';\nimport { tmpdir } from 'node:os';\nimport { join } from 'node:path';\nexport async function temporaryCertificates({expired=false}={}) {\n  const directory=await mkdtemp(join(tmpdir(),'atlas-tls-lab-'));\n  const openssl=process.env.OPENSSL_BIN || 'openssl';\n  const run=args=>execFileSync(openssl,args,{cwd:directory,stdio:'pipe',timeout:10000});\n  try {\n    await writeFile(join(directory,'ca.cnf'),`[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ca\n[dn]\nCN=Atlas Loopback Teaching CA\n[ca]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n`);\n    await writeFile(join(directory,'leaf.ext'),`basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n`);\n    for(const name of ['ca','server']) {\n      run(['ecparam','-name','prime256v1','-genkey','-noout','-out',name+'.key']);\n      await chmod(join(directory,name+'.key'),0o600);\n    }\n    run(['req','-new','-x509','-key','ca.key','-sha256','-days','1','-config','ca.cnf','-out','ca.pem']);\n    run(['req','-new','-key','server.key','-subj','/CN=localhost','-out','server.csr']);\n    run(['x509','-req','-in','server.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial',...(expired?['-not_before','20240101000000Z','-not_after','20240102000000Z']:['-days','1']),'-sha256','-extfile','leaf.ext','-out','server.pem']);\n    return {\n      key:await readFile(join(directory,'server.key')),\n      cert:await readFile(join(directory,'server.pem')),\n      ca:await readFile(join(directory,'ca.pem')),\n      async dispose(){await rm(directory,{recursive:true,force:true});},\n    };\n  } catch(error) { await rm(directory,{recursive:true,force:true});throw error; }\n}",
          "language": "js",
          "filename": "examples/https-tls/certificates.mjs",
          "purpose": "完整证书辅助：EC密钥权限600，CA约束、叶用途与SAN均显式给出；只返回本次教学材料，正常结束或创建失败清理临时目录。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "ca.cnf把CA限定为可签发证书的教学根，pathlen:0不允许再接下级中间CA；leaf.ext声明叶证书不是CA，允许服务端认证，SAN只列localhost和127.0.0.1。私钥在新建临时目录里生成，不读取你的SSH私钥，也不向控制台输出。绝不能把真实生产私钥放进文章示例目录。"
        },
        {
          "type": "paragraph",
          "text": "expired分支只为失败测试生成2024年1月1日至2日有效的过期叶证书；它依赖OpenSSL3.6支持的-not_before/-not_after选项。旧CLI不支持时应安装匹配版本或另行验证兼容流程，不能跳过过期测试后仍声称已通过。正常证书只有效一天，测试期间若系统时间异常，也会影响证书判断。"
        },
        {
          "type": "reference",
          "title": "OpenSSL3.6：x509签发日期与扩展参数",
          "url": "https://docs.openssl.org/3.6/man1/openssl-x509/"
        }
      ]
    },
    {
      "id": "service",
      "title": "真正建立受验证的连接，而不是关闭验证来求一个200",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import { createServer, request } from 'node:https';\nimport { once } from 'node:events';\nimport { checkServerIdentity } from 'node:tls';\nimport { temporaryCertificates } from './certificates.mjs';\nexport async function startLab(options={}) {\n  const certificates=await temporaryCertificates(options);\n  const server=createServer({\n    key:certificates.key,cert:certificates.cert,\n    minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ecdhCurve:'X25519',\n  },(req,res)=>{\n    res.writeHead(200,{'content-type':'application/json','connection':'close'});\n    res.end(JSON.stringify({ok:true,protocol:req.socket.getProtocol()}));\n  });\n  server.on('tlsClientError',()=>{}); // Expected negative-handshake tests are observed by clients.\n  try { server.listen(0,'127.0.0.1');await once(server,'listening'); }\n  catch(error) { await certificates.dispose();throw error; }\n  const port=server.address().port;\n  return {\n    port,ca:certificates.ca,\n    async close() {\n      server.closeAllConnections();\n      await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));\n      await certificates.dispose();\n    },\n  };\n}\nexport function get({port,ca,servername='localhost',maxVersion='TLSv1.3'}) {\n  return new Promise((resolve,reject)=>{\n    const req=request({hostname:'127.0.0.1',port,path:'/',method:'GET',\n      servername,ca,agent:false,minVersion:maxVersion==='TLSv1.2'?'TLSv1.2':'TLSv1.3',maxVersion,\n      rejectUnauthorized:true,checkServerIdentity,\n    },res=>{\n      const socket=res.socket;\n      const certificate=socket.getPeerCertificate();\n      const details={authorized:socket.authorized,protocol:socket.getProtocol(),\n        cipher:socket.getCipher().standardName,ephemeral:socket.getEphemeralKeyInfo(),san:certificate.subjectaltname};\n      let body='';res.setEncoding('utf8');\n      res.on('data',chunk=>{body+=chunk;});\n      res.once('error',reject);\n      res.once('end',()=>resolve({...details,status:res.statusCode,body:JSON.parse(body)}));\n    });\n    req.setTimeout(3000,()=>req.destroy(new Error('CLIENT_TIMEOUT')));\n    req.once('error',reject);req.end();\n  });\n}",
          "language": "js",
          "filename": "examples/https-tls/lab.mjs",
          "purpose": "完整loopback服务与客户端：TLS1.3固定、临时X25519组、显式CA和默认名称验证；agent:false避免连接复用干扰证书读取。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "close里的closeAllConnections只用于这套有限请求的实验收尾，会强制断开连接，不是生产服务的优雅关闭方案。生产关闭应先停止接受新请求、等待在途工作，并在预算到期后才强制终止。startLab监听127.0.0.1且端口为0，让操作系统选择空闲端口。get连接这个IP，但servername明确为localhost，运行库按这个服务器身份检查SAN。IP连接地址、SNI名称、HTTP Host是不同职责；本例只返回固定JSON，不把更复杂的虚拟主机路由混进身份实验。"
        },
        {
          "type": "paragraph",
          "text": "rejectUnauthorized:true与checkServerIdentity共同保留证书链和服务名称检查；ca只加在本次客户端连接中。成功后读取socket.authorized、getProtocol、getCipher和getPeerCertificate，再检查应用响应。只有HTTP200不够，因为某些错误配置也可能在没有可信身份的加密连接上拿到200。"
        },
        {
          "type": "paragraph",
          "text": "真正的失败定位应读错误码。没有教学CA时，客户端本机返回UNABLE_TO_VERIFY_LEAF_SIGNATURE；把servername改为wrong.invalid，即使仍信任CA，也返回ERR_TLS_CERT_ALTNAME_INVALID。打开rejectUnauthorized:false或随手把checkServerIdentity变成空函数，会抹掉我们正在验证的边界，不是修复。"
        },
        {
          "type": "reference",
          "title": "Node22.12.0：TLS验证选项与套接字观测",
          "url": "https://nodejs.org/download/release/v22.12.0/docs/api/tls.html"
        }
      ]
    },
    {
      "id": "failures",
      "title": "从成功与四种失败，读出各层的责任",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { startLab,get } from './lab.mjs';\ntest('loopback teaching CA: actual TLS 1.3 authentication failures',async t=>{\n  const lab=await startLab();t.after(()=>lab.close());\n  await t.test('trusted CA and SAN name succeed with TLS 1.3',async()=>{\n    const result=await get(lab);\n    assert.equal(result.authorized,true);\n    assert.equal(result.protocol,'TLSv1.3');\n    assert.equal(result.status,200);\n    assert.equal(result.ephemeral.name,'X25519');\n    assert.deepEqual(result.body,{ok:true,protocol:'TLSv1.3'});\n    assert.match(result.san,/DNS:localhost/);\n    assert.match(result.san,/IP Address:127\\.0\\.0\\.1/);\n    console.log(JSON.stringify(result));\n  });\n  await t.test('omitting teaching CA fails trust, not hostname policy',async()=>{\n    await assert.rejects(get({port:lab.port}),error=>{\n      assert.ok(['UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','SELF_SIGNED_CERT_IN_CHAIN'].includes(error.code));\n      console.log('untrusted CA:',error.code);return true;\n    });\n  });\n  await t.test('trusted issuer does not authorize a different hostname',async()=>{\n    await assert.rejects(get({...lab,servername:'wrong.invalid'}),error=>{\n      assert.equal(error.code,'ERR_TLS_CERT_ALTNAME_INVALID');\n      console.log('wrong name:',error.code);return true;\n    });\n  });\n  await t.test('expired leaf is rejected even with trusted CA',async()=>{\n    const expired=await startLab({expired:true});\n    try { await assert.rejects(get(expired),error=>error.code==='CERT_HAS_EXPIRED'); }\n    finally {await expired.close();}\n  });\n  await t.test('no common protocol fails rather than silently downgrade',async()=>{\n    await assert.rejects(get({...lab,maxVersion:'TLSv1.2'}),error=>{\n      assert.match(error.code,/TLSV1_ALERT_PROTOCOL_VERSION|TLSV1_ALERT_INTERNAL_ERROR|EPROTO/);\n      console.log('protocol mismatch:',error.code);return true;\n    });\n  });\n});",
          "language": "js",
          "filename": "examples/https-tls/test.mjs",
          "purpose": "完整测试覆盖正常TLS1.3、未知CA、名称不匹配、过期叶证书、协议不相容；错误后也关闭服务并清理证书。",
          "kind": "excerpt"
        },
        {
          "type": "table",
          "headers": [
            "输入变化",
            "本机结果",
            "应该判断什么"
          ],
          "rows": [
            [
              "ca正确、名称localhost",
              "authorized=true，TLSv1.3，200",
              "通道认证及本次HTTP响应同时成功"
            ],
            [
              "不提供教学CA",
              "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
              "信任路径未成立，不是HTTP鉴权失败"
            ],
            [
              "信任CA但名称wrong.invalid",
              "ERR_TLS_CERT_ALTNAME_INVALID",
              "目标身份不匹配，不能通过换目标逃避"
            ],
            [
              "信任CA但叶已过期",
              "CERT_HAS_EXPIRED",
              "日期验证失败；检查系统时钟及证书部署"
            ],
            [
              "客户端只允许TLS1.2",
              "EPROTO",
              "无共同协议；没有偷偷降级为TLS1.2"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "不同平台和TLS库版本可能给出略有差异的底层错误，例如未知签发者可能属于另一种证书链错误。测试对未知CA允许一个有限的相关错误集合，对名称错误则要求专门的代码。它没有把任意连接失败都当作“安全检查成功”，也没有用固定耗时推测握手是否完成。"
        },
        {
          "type": "paragraph",
          "text": "成功连接真实报告TLS_AES_256_GCM_SHA384、X25519、DNS:localhost与IP Address:127.0.0.1。这个结果证明本机协商了这些参数，不证明所有浏览器或生产服务器都选择相同组合。证书吊销、OCSP、证书透明度、公共CA签发和客户端证书均不在本实验中，不能因一个loopback测试通过就称为浏览器级完整PKI验收。"
        }
      ]
    },
    {
      "id": "boundary",
      "title": "TLS终止在哪里，明文也就会出现在哪里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "浏览器到反向代理使用HTTPS，而代理到应用使用HTTP时，TLS保护到代理终止。代理及后端链路的访问控制和加密需要另行设计；应用不能仅凭某个可由外部伪造的X-Forwarded-Proto头就信任所有请求已经安全。转发头应由明确可信的代理覆盖和校验。"
        },
        {
          "type": "paragraph",
          "text": "TLS也不默认隐藏全部连接元数据。网络仍可能观察IP、流量时序和长度；普通ClientHello中的某些信息在未使用相应保护时也可见。ECH等机制有独立的部署前提，本例没有实现。HSTS则是浏览器在已获得策略后强制后续HTTPS访问的机制，不能修复已经不可信的证书，也不能代替首次访问策略设计。"
        },
        {
          "type": "paragraph",
          "text": "排查顺序可以沿层次走：先确认DNS/目标地址和TCP连通，再看TLS协议、信任路径、名称和日期，最后看HTTP状态与应用授权。证书错误不应该靠清空浏览器安全提示解决；HTTP401也不意味着TLS握手失败。把错误放回所属层，修复才不会变成绕过。"
        }
      ]
    },
    {
      "id": "run",
      "title": "运行与验收：保留验证，缩小结论",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/https-tls\nnvm use\nnpm ci\nopenssl version\nnode -p \"process.versions.openssl\"\nnpm test\nnpm start\nnpm run check",
          "language": "sh",
          "filename": "终端",
          "purpose": "Node22.12.0与OpenSSL CLI3.6.1已验证；可用OPENSSL_BIN指定对应CLI。整个过程只访问本机临时端口。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "五个子场景全部通过，Node包含父测试共6项；临时CA、叶证书、私钥和socket均在结束时处理。npm start只打印非敏感的协议、套件、临时公开组、SAN和响应，不打印私钥或任何真实账户凭据。项目正常异常会走finally清理，强杀进程或断电后仍应检查临时残留，不能保证JavaScript收尾在所有故障下执行。"
        },
        {
          "type": "paragraph",
          "text": "SVG已经在本机渲染人工查看并修正客户端标签宽度；网站里的放大与390px手机视口已实际检查，离线资源纳入构建清单。没有安装教学CA到系统或浏览器，没有真实付费服务、外部扫描或公网证书请求。图是协议解释，不是抓包结果；测试也不声称测量握手性能。"
        },
        {
          "type": "table",
          "headers": [
            "理解检查",
            "解析"
          ],
          "rows": [
            [
              "证书可信，为何wrong.invalid仍失败？",
              "签发者可信不等于名称匹配；必须是本次目标的证书。"
            ],
            [
              "ECDSA证书为什么能配X25519？",
              "证书认证与临时秘密协商职责不同，不需使用同一曲线。"
            ],
            [
              "HTTPS200足以证明认证了吗？",
              "不够，还要保持验证选项并确认通道授权，不能先关闭检查再拿200。"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "HTTPS的核心不是一份“公钥加密流程”，而是有可信身份约束的密钥协商与记录保护。通道建立后，服务器还不知道访问者是否登录、是否能读某张私人笔记；下一篇会把这个应用层身份状态单独建立并验证。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "TLS1.3 RFC8446",
      "url": "https://www.rfc-editor.org/rfc/rfc8446.html"
    },
    {
      "title": "X.509 RFC5280",
      "url": "https://www.rfc-editor.org/rfc/rfc5280.html"
    },
    {
      "title": "TLS服务身份 RFC9525",
      "url": "https://www.rfc-editor.org/rfc/rfc9525.html"
    },
    {
      "title": "TLS部署建议 RFC9325",
      "url": "https://www.rfc-editor.org/rfc/rfc9325.html"
    },
    {
      "title": "HKDF RFC5869",
      "url": "https://www.rfc-editor.org/rfc/rfc5869.html"
    },
    {
      "title": "Node22.12 TLS",
      "url": "https://nodejs.org/download/release/v22.12.0/docs/api/tls.html"
    },
    {
      "title": "OpenSSL3.6 x509",
      "url": "https://docs.openssl.org/3.6/man1/openssl-x509/"
    }
  ]
};
export default article;
