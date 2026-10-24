import type { Article } from '../../articleTypes';

const article: Article = {
  "id": "network-troubleshooting",
  "topic": "operations",
  "title": "网络故障排查：沿 DNS、TCP、TLS 和 HTTP 定位问题",
  "description": "用本地UDP DNS子集和真实TCP/TLS1.3/HTTP夹具建立分层证据，区分名字解析、连接、身份验证与应用状态，交付完整诊断CLI和故障恢复测试。",
  "minutes": 55,
  "labMinutes": 40,
  "tags": [
    "网络",
    "DNS",
    "TCP",
    "TLS",
    "HTTP",
    "排障"
  ],
  "scope": "IPv4、HTTPS over TCP、TLS1.3与HTTP/1.1；DNS为受控UDP A/IN模拟。mac预检与Ubuntu24.04.5隔离CI各10/10通过，不覆盖系统递归解析/HTTP3/代理/CDN/公网路径。",
  "prerequisites": [
    "能从终端运行Python3.12与读取基础HTTP",
    "了解客户端请求服务端，不要求背协议报文字段"
  ],
  "kind": "tutorial",
  "status": "complete",
  "versions": [
    "CPython3.12.14；mac与Ubuntu24.04.5隔离CI实际运行",
    "CI kernel6.17.0-1022-azure；OpenSSL补丁版本以运行输出为准，尚未摘录",
    "RFC1035、9293、8446、9110/9112；OpenSSL3.0文档"
  ],
  "verifiedAt": "2026-10-24",
  "questionIds": [],
  "examples": [
    {
      "label": "本地分层网络实验ZIP",
      "path": "network-troubleshooting.zip"
    },
    {
      "label": "夹具、命令与验证限制",
      "path": "network-troubleshooting/README.md"
    }
  ],
  "references": [
    {
      "title": "RFC1035：DNS报文与响应码",
      "url": "https://www.rfc-editor.org/rfc/rfc1035"
    },
    {
      "title": "RFC9293：TCP",
      "url": "https://www.rfc-editor.org/rfc/rfc9293"
    },
    {
      "title": "RFC8446：TLS1.3",
      "url": "https://www.rfc-editor.org/rfc/rfc8446"
    },
    {
      "title": "RFC9110：HTTP语义",
      "url": "https://www.rfc-editor.org/rfc/rfc9110.txt"
    },
    {
      "title": "Python3.12：SSL上下文与身份检查",
      "url": "https://docs.python.org/3.12/library/ssl.html"
    },
    {
      "title": "OpenSSL3.0：本地证书请求工具",
      "url": "https://docs.openssl.org/3.0/man1/openssl-req/"
    },
    {
      "title": "固定规范：RFC9112 HTTP/1.1消息与连接",
      "url": "https://www.rfc-editor.org/rfc/rfc9112.txt"
    },
    {
      "title": "完整Ubuntu隔离CI实际成功记录",
      "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40097929509"
    }
  ],
  "sections": [
    {
      "id": "layers",
      "title": "先把“访问不了”拆成能分别证明的事情",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "一次常见HTTPS访问需要完成不同职责：DNS把名字解析成地址；TCP在地址与端口之间建立可靠字节流；TLS在这条连接上协商加密并验证对端身份；HTTP再表达方法、路径、状态和内容。它们相互依赖，却不是同一个成功条件。能解析名字，不表示端口可连接；连接成功，不表示证书身份正确；HTTP返回503，反而说明前面的某些通信步骤已经完成。"
        },
        {
          "type": "paragraph",
          "text": "这里的顺序是本篇HTTPS over TCP的排查模型，不是四层OSI模型。真实客户端可能命中DNS缓存、复用连接或经代理转发；HTTP/3使用QUIC也不走本篇这条TCP路径。先限定输入与协议，才不会把一个命令得到的结果扩大到整条互联网链路。我们从概念进入受控案例，再把观察映射到下一步判断。"
        },
        {
          "type": "paragraph",
          "text": "案例只使用atlas.test这样的测试名字和127.0.0.1临时端口。DNS是我们写的UDP A/IN小子集，TCP/TLS1.3/HTTP由操作系统、OpenSSL与Python标准库真实完成，不伪造这三层成功。作者在mac用CPython3.12.14完成10项可移植预检；Linux实际结果已由Ubuntu24.04.5隔离CI独立通过，运行链接与范围见后文，仍review待最终图形/站点验收。"
        }
      ]
    },
    {
      "id": "contract",
      "title": "同一个名字、连接地址和身份字段，各自在哪层起作用",
      "paragraphs": [],
      "blocks": [
        {
          "type": "figure",
          "src": "/figures/network-troubleshooting/layers.svg",
          "title": "分层证据与停止位置",
          "alt": "名字查询先得到127.0.0.1，TCP连接动态端口，TLS验证atlas.test与可信证书，HTTP发送路径并得到状态；每层失败只保留此前已通过的证据。",
          "caption": "本地受控实验的数据流，不表示公网路由或实际延迟。左侧DNS为模拟协议子集，后面TCP/TLS/HTTP使用真实协议栈。"
        },
        {
          "type": "paragraph",
          "text": "诊断输入分开保存DNS查询名、连接端口、TLS server_name、信任文件和HTTP路径。正常时查询atlas.test得到127.0.0.1，连接夹具的动态TLS端口，以atlas.test做证书身份检查，并发送Host: atlas.test:端口和/ok路径。把这些值分开，是为了有意只破坏一层，再看失败停止在哪里。"
        },
        {
          "type": "paragraph",
          "text": "SNI是TLS客户端提示服务端所请求名字的机制，证书主机名检查是客户端确认身份的规则，HTTP Host又属于应用协议。常见API用server_hostname同时帮助SNI和身份检查，二者却不能因此当成同一个概念。直接把URL换成IP，往往同时改了多个变量；本例保持连接地址不变，只改server_name，就能隔离主机名验证的失败。"
        },
        {
          "type": "paragraph",
          "text": "每次诊断返回checks和failed_layer。checks只记录已经获得的具体证据；失败后不继续伪造上层结果。HTTP收到404或503也会记录真实状态，但业务成功ok为false。这样“请求已经到应用层”和“应用返回成功”能同时表达，不需要把所有失败都压成一个网络不通。"
        }
      ]
    },
    {
      "id": "dns",
      "title": "DNS先回答名字问题：NXDOMAIN和无响应不是同一个错误",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "DNS查询带事务ID、问题名、记录类型等字段；响应需要与查询对应。A记录提供IPv4地址，NXDOMAIN表示名字不存在；名字存在但没有指定类型的记录是另一类情况，不能看到空答案就都叫NXDOMAIN。超时则只是期限内没有获得可用响应，可能是路径、服务器、策略或本地配置问题，不等于服务器肯定已经回答“没有这个名字”。"
        },
        {
          "type": "code",
          "language": "python",
          "filename": "examples/network-troubleshooting/dns_wire.py",
          "kind": "excerpt",
          "purpose": "完整DNS A/IN教学子集：编码问题、校验响应ID/标志/问题、读取一个压缩指针形式的A答案。未实现递归、缓存、DNSSEC、CNAME、AAAA或TCP回退。",
          "code": "\"\"\"Deliberately small DNS A/IN wire subset for a local authoritative fixture.\"\"\"\nimport secrets\nimport socket\nimport struct\n\n\nclass DnsFailure(ValueError):\n    pass\n\n\ndef question(name: str) -> bytes:\n    labels = name.rstrip(\".\").lower().split(\".\")\n    if not labels or len(name) > 253:\n        raise DnsFailure(\"invalid name length\")\n    encoded = bytearray()\n    for label in labels:\n        if not 1 <= len(label) <= 63 or any(not (c.isascii() and (c.isalnum() or c == \"-\")) for c in label):\n            raise DnsFailure(\"invalid DNS label\")\n        encoded.append(len(label))\n        encoded.extend(label.encode(\"ascii\"))\n    return bytes(encoded) + b\"\\0\" + struct.pack(\"!HH\", 1, 1)\n\n\ndef read_question(packet: bytes) -> tuple[str, bytes]:\n    if len(packet) < 17:\n        raise DnsFailure(\"short DNS packet\")\n    position, labels = 12, []\n    while True:\n        if position >= len(packet):\n            raise DnsFailure(\"truncated label\")\n        length = packet[position]\n        position += 1\n        if length == 0:\n            break\n        if length > 63 or position + length > len(packet):\n            raise DnsFailure(\"unsupported or truncated label\")\n        labels.append(packet[position:position + length].decode(\"ascii\"))\n        position += length\n    if packet[position:position + 4] != struct.pack(\"!HH\", 1, 1):\n        raise DnsFailure(\"only A/IN supported\")\n    return \".\".join(labels).lower(), packet[12:position + 4]\n\n\ndef query_a(server: tuple[str, int], name: str, *, timeout: float = 1) -> str:\n    identifier = secrets.randbits(16)\n    query = question(name)\n    packet = struct.pack(\"!HHHHHH\", identifier, 0x0100, 1, 0, 0, 0) + query\n    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:\n        connection.settimeout(timeout)\n        connection.connect(server)  # Kernel filters responses to this fixture peer.\n        connection.send(packet)\n        response = connection.recv(512)\n    if len(response) < 12:\n        raise DnsFailure(\"short DNS response\")\n    response_id, flags, questions, answers, _, _ = struct.unpack(\"!HHHHHH\", response[:12])\n    if response_id != identifier or not flags & 0x8000 or flags & 0x0200 or questions != 1:\n        raise DnsFailure(\"unexpected ID/flags/question count\")\n    if response[12:12 + len(query)] != query:\n        raise DnsFailure(\"question mismatch\")\n    code = flags & 15\n    if code == 3:\n        raise DnsFailure(\"NXDOMAIN\")\n    if code != 0 or answers != 1:\n        raise DnsFailure(f\"unsupported response rcode={code} answers={answers}\")\n    answer = response[12 + len(query):]\n    if len(answer) != 16:\n        raise DnsFailure(\"unexpected A answer length\")\n    owner, kind, address_class, ttl, size = struct.unpack(\"!HHHIH\", answer[:12])\n    if (owner, kind, address_class, size) != (0xC00C, 1, 1, 4):\n        raise DnsFailure(\"unsupported A answer\")\n    return socket.inet_ntoa(answer[12:])\n"
        },
        {
          "type": "paragraph",
          "text": "正常query_a向指定本机UDP端口发查询，验证响应ID、QR、截断位、问题计数和原问题，再读rcode与A答案。连接式UDP socket让内核只接收所指定对端的数据；512字节读取和固定答案形式限制了本例解析范围。这个小解析器只接受夹具定义的格式，不能替代生产DNS库。对截断、多个答案或未支持格式直接报错，比悄悄猜一个地址更诚实。"
        },
        {
          "type": "paragraph",
          "text": "夹具对atlas.test回答127.0.0.1，对missing.atlas.test回答NXDOMAIN，对timeout.atlas.test故意不回应。恢复只是改回正确测试名字并重新查询，未改/etc/resolv.conf、hosts文件或宿主DNS缓存。这里验证的是DNS报文子集与诊断分支，不能据此宣称系统解析器、公司DNS或公网递归链路已经正常。"
        },
        {
          "type": "reference",
          "title": "固定规范：RFC1035报文格式与响应码",
          "url": "https://www.rfc-editor.org/rfc/rfc1035"
        }
      ]
    },
    {
      "id": "tcp",
      "title": "TCP把名字转换成端点之后的问题暴露出来",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "TCP连接针对地址与端口。connect成功说明这条具体连接已经建立，不能证明同一主机上的所有端口、其他地址族或应用功能都正常。ConnectionRefused通常表示收到了明确拒绝，在本机未绑定端点的夹具中可归因到这个受控状态；连接超时则没有同样明确的回应，不能仅凭它就判定防火墙或服务端哪一方有错。"
        },
        {
          "type": "paragraph",
          "text": "故障夹具先向内核申请一个临时端口，再关闭预约socket，让探测访问当前未绑定端点。测试要求真实ConnectionRefusedError，并保留已经成功的DNS证据。端口释放后理论上可能被别的进程抢占；隔离VM降低这种竞争，若断言意外失败则报告端点状态，不去杀掉或接管另一个监听者。恢复时用回真正TLS服务的端口。"
        },
        {
          "type": "paragraph",
          "text": "不要把ping失败直接当成TCP不可达，也不要把TCP握手成功当成HTTP响应已完成。ICMP策略、负载均衡、连接队列与应用处理属于不同观察。生产排查还应记录客户端所在位置、目标地址族、代理与请求时间；本篇只验证loopback，不制造跨网络故障或修改路由、防火墙。"
        },
        {
          "type": "reference",
          "title": "固定规范：RFC9293 TCP",
          "url": "https://www.rfc-editor.org/rfc/rfc9293"
        }
      ]
    },
    {
      "id": "tls",
      "title": "TLS成功要同时面对协议与身份，跳过检查不叫修复",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "TLS在连接上协商密钥与记录保护，并支持对端认证。本例固定TLS1.3，让结果不因协商到别的版本而含糊。服务端使用临时自签名证书，SAN只包含atlas.test；客户端仅在传入这份实验信任文件时信任它，并保持默认主机名检查。证书和私钥都放临时目录，不安装进宿主的系统信任库。"
        },
        {
          "type": "paragraph",
          "text": "两个故障分别改变一个条件：不提供实验CA，证书链不受默认信任；继续信任证书但把server_name改成wrong.atlas.test，主机名不匹配。两次都发生在TLS层，checks已经有DNS和TCP，尚没有HTTP状态。修复分别是恢复正确的实验信任文件、恢复与证书身份相符的名字，而不是把验证整体关闭。"
        },
        {
          "type": "paragraph",
          "text": "真实环境还可能是证书过期、链缺失、协议或密码套件不兼容，以及中间代理终止TLS。必须结合具体错误和已知端点配置继续查。临时关闭校验最多能缩小某个假设，不能作为把身份验证修好的证据；本例从未设置CERT_NONE，也不使用curl -k掩盖失败。"
        },
        {
          "type": "reference",
          "title": "固定规范：RFC8446 TLS1.3",
          "url": "https://www.rfc-editor.org/rfc/rfc8446"
        },
        {
          "type": "reference",
          "title": "实际API：Python3.12 SSL上下文与hostname检查",
          "url": "https://docs.python.org/3.12/library/ssl.html"
        }
      ]
    },
    {
      "id": "probe",
      "title": "完整探针把证据留在失败之前",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/network-troubleshooting/diagnose.py",
          "kind": "excerpt",
          "purpose": "完整可运行诊断CLI：真实输入参数、分层连接、验证、HTTP解析、有限响应读取和退出码都在此。",
          "code": "\"\"\"Layered probe: a simulated DNS peer, then real OS TCP, TLS and HTTP.\"\"\"\nimport argparse\nimport http.client\nimport json\nfrom pathlib import Path\nimport socket\nimport ssl\nfrom dns_wire import query_a\n\n\ndef probe(*, dns: tuple[str, int], name: str, port: int, cafile: Path | None,\n          server_name: str = \"atlas.test\", path: str = \"/ok\", timeout: float = 1) -> dict:\n    checks = {}\n    layer = \"dns\"\n    try:\n        if not 0 < timeout <= 5:\n            raise ValueError(\"timeout must be in (0,5]\")\n        address = query_a(dns, name, timeout=timeout)\n        checks[\"dns\"] = {\"address\": address, \"source\": \"local UDP A/IN fixture\"}\n        layer = \"tcp\"\n        with socket.create_connection((address, port), timeout=timeout) as plain:\n            checks[\"tcp\"] = {\"connected\": True}\n            layer = \"tls\"\n            context = ssl.create_default_context(cafile=cafile)\n            context.minimum_version = ssl.TLSVersion.TLSv1_3\n            context.maximum_version = ssl.TLSVersion.TLSv1_3\n            with context.wrap_socket(plain, server_hostname=server_name) as secured:\n                checks[\"tls\"] = {\"version\": secured.version(), \"hostname_verified\": True}\n                layer = \"http\"\n                if not path.startswith(\"/\") or any(c in path + server_name for c in \"\\r\\n\"):\n                    raise ValueError(\"invalid HTTP path or host\")\n                request = f\"GET {path} HTTP/1.1\\r\\nHost: {server_name}:{port}\\r\\nConnection: close\\r\\n\\r\\n\"\n                secured.sendall(request.encode(\"ascii\"))\n                with http.client.HTTPResponse(secured) as response:\n                    response.begin()\n                    body = response.read(4097)\n                    if len(body) > 4096:\n                        raise ValueError(\"HTTP body exceeds 4096 bytes\")\n                    checks[\"http\"] = {\"status\": response.status, \"body\": body.decode(\"utf-8\")}\n                    success = 200 <= response.status < 300\n                    return {\"ok\": success, \"failed_layer\": None if success else \"http\", \"checks\": checks}\n    except (OSError, ValueError, http.client.HTTPException) as error:\n        return {\"ok\": False, \"failed_layer\": layer, \"error_type\": type(error).__name__,\n                \"detail\": str(error), \"checks\": checks}\n\n\ndef main() -> int:\n    parser = argparse.ArgumentParser(description=__doc__)\n    parser.add_argument(\"--dns-port\", type=int, required=True)\n    parser.add_argument(\"--name\", default=\"atlas.test\")\n    parser.add_argument(\"--port\", type=int, required=True)\n    parser.add_argument(\"--cafile\", type=Path)\n    parser.add_argument(\"--server-name\", default=\"atlas.test\")\n    parser.add_argument(\"--path\", default=\"/ok\")\n    parser.add_argument(\"--timeout\", type=float, default=1)\n    arguments = parser.parse_args()\n    result = probe(dns=(\"127.0.0.1\", arguments.dns_port), name=arguments.name,\n                   port=arguments.port, cafile=arguments.cafile, server_name=arguments.server_name,\n                   path=arguments.path, timeout=arguments.timeout)\n    print(json.dumps(result, ensure_ascii=False))\n    return 0 if result[\"ok\"] else 2\n\n\nif __name__ == \"__main__\":\n    raise SystemExit(main())\n"
        },
        {
          "type": "paragraph",
          "text": "probe从DNS开始设置layer，每进入下一阶段才更新它。create_connection的地址直接使用A结果，后续TLS仍使用逻辑名字；context.wrap_socket成功之后才记录TLSv1.3与已验证身份。最后发送完整HTTP/1.1请求，Host带动态非默认端口，用HTTPResponse解析状态和消息体。响应体最多读取4097字节，超过4096视为本工具容量失败，不无限收集数据。"
        },
        {
          "type": "paragraph",
          "text": "连接与HTTPResponse都使用上下文管理，正常、异常与超时都会关闭本次持有的对象。timeout是每个相应网络操作的等待设置，阶段相加并不自动等于一个全链路硬截止时间；本工具CLI限制timeout在0到5秒之间，CI还设置总期限。OSError、协议错误或输入格式错误按发生阶段返回，未知程序缺陷不会被一个except Exception全部吞掉。"
        },
        {
          "type": "paragraph",
          "text": "HTTP读取超时发生在TLS已完成之后，checks会留下TLS证据，却没有HTTP状态；这与收到503有明确差别。503是服务端返回的应用语义，不能据此重配DNS。404也说明获得了HTTP响应，但可能是路径、虚拟主机或路由契约不符，不等于服务器主机不存在。"
        },
        {
          "type": "reference",
          "title": "固定规范：RFC9110 HTTP状态和消息语义",
          "url": "https://www.rfc-editor.org/rfc/rfc9110.txt"
        },
        {
          "type": "reference",
          "title": "固定规范：RFC9112 HTTP/1.1消息与连接",
          "url": "https://www.rfc-editor.org/rfc/rfc9112.txt"
        }
      ]
    },
    {
      "id": "fixture",
      "title": "完整本机夹具：有意制造故障，但不伪造协议结果",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "python",
          "filename": "examples/network-troubleshooting/fixtures.py",
          "kind": "excerpt",
          "purpose": "完整夹具与独立启动入口：本机UDP DNS子集、临时TLS证书、真实HTTP状态/延迟门闩、socket与文件清理。",
          "code": "\"\"\"Local UDP DNS subset + real TCP/TLS1.3/HTTP; no public DNS or host changes.\"\"\"\nimport argparse\nfrom contextlib import contextmanager\nfrom http.server import BaseHTTPRequestHandler, ThreadingHTTPServer\nimport json\nfrom pathlib import Path\nimport signal\nimport socket\nimport socketserver\nimport ssl\nimport struct\nimport subprocess\nimport threading\nfrom dns_wire import read_question\n\n\nclass DnsHandler(socketserver.BaseRequestHandler):\n    def handle(self):\n        packet, connection = self.request\n        try:\n            name, query = read_question(packet)\n        except (ValueError, UnicodeError):\n            return\n        if name == \"timeout.atlas.test\":\n            return  # A deliberate no-response fixture, not an upstream DNS outage.\n        known = name == \"atlas.test\"\n        flags = 0x8500 if known else 0x8503  # QR + AA + mirrored RD, no recursive service.\n        header = struct.pack(\"!HHHHHH\", struct.unpack(\"!H\", packet[:2])[0], flags, 1, int(known), 0, 0)\n        answer = (struct.pack(\"!HHHIH\", 0xC00C, 1, 1, 60, 4) + socket.inet_aton(\"127.0.0.1\")) if known else b\"\"\n        connection.sendto(header + query + answer, self.client_address)\n\n\n@contextmanager\ndef fixture(directory: Path):\n    directory.mkdir(parents=True, exist_ok=True)\n    directory.chmod(0o700)\n    certificate, key = directory / \"cert.pem\", directory / \"key.pem\"\n    subprocess.run([\"openssl\", \"req\", \"-x509\", \"-newkey\", \"rsa:2048\", \"-nodes\", \"-sha256\",\n                    \"-keyout\", str(key), \"-out\", str(certificate), \"-days\", \"1\",\n                    \"-subj\", \"/CN=atlas.test\", \"-addext\", \"subjectAltName=DNS:atlas.test\",\n                    \"-addext\", \"basicConstraints=critical,CA:TRUE\"],\n                   check=True, capture_output=True, timeout=15)\n    key.chmod(0o600)\n    release = threading.Event()\n    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)\n    context.minimum_version = context.maximum_version = ssl.TLSVersion.TLSv1_3\n    context.load_cert_chain(certificate, key)\n\n    class Handler(BaseHTTPRequestHandler):\n        protocol_version = \"HTTP/1.1\"\n\n        def do_GET(self):\n            if self.path == \"/slow\":\n                release.wait(timeout=2)\n            status = {\"/ok\": 200, \"/slow\": 200, \"/unavailable\": 503}.get(self.path, 404)\n            body = json.dumps({\"status\": status, \"path\": self.path}).encode()\n            try:\n                self.send_response(status)\n                self.send_header(\"Content-Type\", \"application/json\")\n                self.send_header(\"Content-Length\", str(len(body)))\n                self.end_headers()\n                self.wfile.write(body)\n            except OSError:\n                pass  # Client timeout/close is an expected fault in this fixture.\n\n        def log_message(self, *args):\n            pass\n\n    class Server(ThreadingHTTPServer):\n        daemon_threads = False\n        block_on_close = True\n\n        def get_request(self):\n            plain, address = super().get_request()\n            plain.settimeout(1)\n            try:\n                return context.wrap_socket(plain, server_side=True), address\n            except OSError:\n                plain.close()\n                raise\n\n    servers, threads = [], []\n    refusal = socket.socket()\n    try:\n        refusal.bind((\"127.0.0.1\", 0))\n        refused_port = refusal.getsockname()[1]\n        refusal.close()  # Release the reserved port: probe a genuinely unbound endpoint.\n        dns = socketserver.UDPServer((\"127.0.0.1\", 0), DnsHandler)\n        servers.append(dns)\n        tls = Server((\"127.0.0.1\", 0), Handler)\n        servers.append(tls)\n        for server in servers:\n            thread = threading.Thread(target=server.serve_forever, kwargs={\"poll_interval\": 0.05},\n                                      name=\"atlas-lab-network\")\n            thread.start()\n            threads.append(thread)\n        yield {\"dns_port\": dns.server_address[1], \"tls_port\": tls.server_port,\n               \"refused_port\": refused_port, \"cafile\": str(certificate),\n               \"release\": release}\n    finally:\n        release.set()\n        for server in servers:\n            server.shutdown()\n            server.server_close()\n        for thread in threads:\n            thread.join(timeout=3)\n            if thread.is_alive():\n                raise RuntimeError(\"fixture thread did not stop\")\n        refusal.close()\n        certificate.unlink(missing_ok=True)\n        key.unlink(missing_ok=True)\n\n\ndef main():\n    parser = argparse.ArgumentParser()\n    parser.add_argument(\"--state\", type=Path, required=True)\n    arguments = parser.parse_args()\n    stopped = threading.Event()\n    signal.signal(signal.SIGTERM, lambda *_: stopped.set())\n    signal.signal(signal.SIGINT, lambda *_: stopped.set())\n    try:\n        with fixture(arguments.state) as information:\n            manifest = {key: value for key, value in information.items() if key != \"release\"}\n            (arguments.state / \"manifest.json\").write_text(json.dumps(manifest))\n            print(json.dumps({\"event\": \"ready\", **manifest}), flush=True)\n            stopped.wait(timeout=60)\n    finally:\n        (arguments.state / \"manifest.json\").unlink(missing_ok=True)\n\n\nif __name__ == \"__main__\":\n    main()\n"
        },
        {
          "type": "paragraph",
          "text": "OpenSSL生成一天有效的临时证书，Python服务固定TLS1.3。/ok返回200，/missing返回404，/unavailable返回503；/slow在Event门闩前等待，客户端先超时，测试再放行并验证恢复。这里的等待是受控故障条件，不是靠睡一段时间猜测网络拥塞。服务端为接受的连接设置有限等待，退出时放行门闩、停止监听、join线程，并删除证书和私钥。"
        },
        {
          "type": "paragraph",
          "text": "DNS回答由Python夹具构造，所以图中明确标为模拟子集；TCP拒绝、TLS验证错误和HTTP响应则来自真实内核/协议实现。夹具只监听loopback动态端口，不修改宿主解析或网络配置。它没有实现递归DNS、证书颁发体系、生产HTTP服务器、可靠网络故障注入平台或任何公网可用性保证。"
        }
      ]
    },
    {
      "id": "run",
      "title": "从一条成功命令开始，每次只破坏一个条件",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "bash",
          "kind": "runnable",
          "purpose": "在examples/network-troubleshooting运行。新终端启动夹具，看到event=ready后用manifest中的真实端口调用探针；夹具最多存活60秒并响应TERM清理。",
          "code": "lab_state=$(mktemp -d /tmp/atlas-lab-network.XXXXXX)\npython3 fixtures.py --state \"$lab_state\" &\nlab_pid=$!\n# 看见event=ready后，在同一终端取得动态参数：\ndns_port=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[\"dns_port\"])' \"$lab_state/manifest.json\")\ntls_port=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[\"tls_port\"])' \"$lab_state/manifest.json\")\npython3 diagnose.py --dns-port \"$dns_port\" --port \"$tls_port\" --cafile \"$lab_state/cert.pem\"\n# 改路径，保留此前DNS/TCP/TLS条件，预期退出2：\npython3 diagnose.py --dns-port \"$dns_port\" --port \"$tls_port\" --cafile \"$lab_state/cert.pem\" --path /unavailable\nkill -TERM \"$lab_pid\"\nwait \"$lab_pid\"\nrm -rf -- \"$lab_state\""
        },
        {
          "type": "paragraph",
          "text": "作者mac可移植预检实际得到完整成功checks顺序dns、tcp、tls、http，TLS为TLSv1.3，HTTP为200。/unavailable返回failed_layer=http并记录503；missing名字返回DNS/NXDOMAIN；错端口停止在TCP；两种证书失败停止在TLS。error_type与失败阶段由10项断言分别确认，不把某一平台的整段OpenSSL报错文本当跨系统固定输出。上述是mac观测；Linux隔离CI也已独立通过，结果见后文，二者分别记录。"
        },
        {
          "type": "table",
          "headers": [
            "操作",
            "预期停止位置",
            "恢复后应重新证明"
          ],
          "rows": [
            [
              "--name missing.atlas.test",
              "DNS，NXDOMAIN",
              "正确名重新得到A地址并走通后续"
            ],
            [
              "timeout.atlas.test且短超时",
              "DNS，无响应期限耗尽",
              "恢复已知可回答名字"
            ],
            [
              "改成manifest.refused_port",
              "TCP，拒绝连接",
              "回到真实监听端口"
            ],
            [
              "省略--cafile",
              "TLS，未知信任",
              "正确CA与身份检查仍开启"
            ],
            [
              "--server-name wrong.atlas.test",
              "TLS，主机名不匹配",
              "恢复atlas.test，不改连接IP"
            ],
            [
              "--path /unavailable或/missing",
              "HTTP，503或404",
              "恢复/ok并检查200"
            ],
            [
              "--path /slow且短超时",
              "HTTP读取，已有TLS证据",
              "放行受控门闩后重新请求"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "10项测试还覆盖真实CLI的退出0/2、成功与故障JSON，以及夹具退出后证书删除、TLS端口不再监听。恢复指纠正本次受控输入或放行门闩后，重新走通探针，不等于证明生产系统已永久恢复。自动测试优先提供明确层次与状态，手工工具可补细节，但不要为每个现象换一整套不可对照的目标。"
        }
      ]
    },
    {
      "id": "linux-validation",
      "title": "Linux验证保留独立门槛，避免把预检写成验收",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "language": "bash",
          "filename": "examples/network-troubleshooting/verify-linux.sh",
          "kind": "excerpt",
          "purpose": "完整Linux CI入口。先验证操作系统，再输出Python/OpenSSL/内核版本，60秒总期限内运行真实夹具与源码映射。",
          "code": "#!/usr/bin/env bash\nset -euo pipefail\nif [[ \"$(uname -s)\" != \"Linux\" ]]; then\n  echo 'SKIP: Linux verification required; no host network setting changed.' >&2\n  exit 77\nfi\nfor tool in python3 openssl timeout; do\n  command -v \"$tool\" >/dev/null || { echo \"Missing required tool: $tool\" >&2; exit 78; }\ndone\npython3 -c 'import sys; assert sys.version_info[:2] == (3,12), sys.version'\nroot_dir=\"$(cd -- \"$(dirname -- \"${BASH_SOURCE[0]}\")\" && pwd)\"\npython3 --version\ncat /etc/os-release\npython3 -c 'import ssl; print(ssl.OPENSSL_VERSION)'\nopenssl version\nuname -r\n# All tests use local fixtures and bounded network/child-process waits.\ntimeout --signal=TERM --kill-after=5s 60s python3 \"$root_dir/test_network.py\"\npython3 \"$root_dir/verify-article.py\"\n"
        },
        {
          "type": "paragraph",
          "text": "mac预检与最新Ubuntu24.04.5隔离CI均为10/10通过。Linux运行CPython3.12.14，验证全链路成功、DNS子集故障、真实TCP拒绝、TLS身份失败、HTTP404/503/读取超时及恢复、CLI退出与资源清理；该DNS仍是本地协议模拟，不因此变成系统递归解析器实测。Linux内核为6.17.0-1022-azure，OpenSSL具体补丁号尚未从CI版本输出摘录，不借用mac的数值。文章图形及390px手机视口已在站点检查；没有手机、代理/CDN、HTTP/2/3或公网丢包结论。"
        },
        {
          "type": "paragraph",
          "text": "排查的目标不是证明一条命令足够万能，而是逐次缩小仍可能出错的范围。DNS证据回答名字，TCP证据回答具体连接，TLS证据回答协议与对端身份，HTTP证据回答应用响应。保留输入、失败阶段与已通过证据，才能决定下一步是修名字、监听端口、信任/身份，还是应用路由与处理逻辑。"
        },
        {
          "type": "reference",
          "title": "Ubuntu隔离CI：两套Linux脚本依序完整通过",
          "url": "https://github.com/zuxiong-luo/fullstack-atlas/actions/runs/40097929509",
          "note": "head bea07732405b0faf0375adce85e3e242f8d0cb87；job约30秒，总约33秒，不是性能基准。"
        }
      ]
    }
  ]
};
export default article;
