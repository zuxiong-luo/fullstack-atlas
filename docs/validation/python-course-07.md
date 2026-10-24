# Python第7章：作者验证

2026-10-24。独立文章python-fastapi与chapter07已落盘，status review；不改分类index/catalog/types，不聚合未审章节。前1～5章源码/正文与第6章原有ID保持原样。

## 环境与依赖

macOS14.5 x86_64，CPython3.12.14（标准GIL构建）。新建ignored work/expansion/python-web-venv，实际pip安装FastAPI0.115.8、Pydantic2.10.6、Starlette0.45.3、Uvicorn0.34.0、HTTPX0.28.1；运行和测试传递依赖完整freeze到chapter07/requirements.lock，版本是复现基线，不称最新版。无外部服务/付费依赖。

## 实际命令与结果

- `work/expansion/python-web-venv/bin/python -m unittest discover -s examples/python-course -p test_chapter07.py -v`：**8/8通过**。TestClient真实ASGI请求、严格422/413、401/201/409、整批导入冲突不发布部分笔记、队列Busy映射429、Event屏障下运行+等待容量、超时finally、关闭取消与任务淘汰；另包含真实内核loopback socket的Uvicorn HTTP读写与停止线程。
- 真正通过子进程`python -m chapter07`启动本机127.0.0.1:8017，在有限健康轮询后HTTP POST/imports得202；查询真实任务succeeded/count2，GET notes2条；未认证401，title数字422；finally仅停止自己Popen的进程并等待退出。日志在ignored work/expansion/python7-cli.log，不放公开下载。
- 首次真实socket测试收到环境代理502；诊断确认trust_env=True走代理，False本地200，修正HTTPX本地夹具为trust_env=False，curl命令加--noproxy '*'。未改宿主代理设置，不把代理失败算成服务失败。

## 官方依据

实际浏览FastAPI依赖与lifespan官方教程，另核对0.115.8 routing源码和Starlette0.45.3 routing tag；Pydantic2.10 strict文档、Python3.12 Queue文档（维护页3.12.15）。正文明确3.12.14实测与文档维护版本区分。HTTPBearer+compare_digest只演示共享Bearer边界，不宣称JWT/OAuth/用户隔离。

## 交付与限制

正文约3420字符叙述（不含代码），完整models、body_limit、jobs、api、__main__、真实JSON输入及调用；filename映射待最终内容检查时汇总。图lifetimes为可编辑SVG，实际渲染检查另回填。已说明队列capacity不含运行worker、每批32、notes512、终态记录64淘汰、32768原始字节不等于整个进程内存上限；timeout不能打断不让出的CPU，202后任务由应用寿命持有。

没有耐久任务、多进程共享、数据库、HTTPS、手机/浏览器界面或生产负载验收。图与文章渲染待站点验收；后续章节不自动进入index。

最终内容检查：本章6个带examples路径代码块逐字连续匹配，新增三篇内容tsc无诊断；SVG已以1100px真实渲染人工看过，无文字裁切/覆盖，7章箭头与标注交叉已修复并再看。预览仅ignored work/expansion/python7-9-figures；网站/手机仍未验收。
