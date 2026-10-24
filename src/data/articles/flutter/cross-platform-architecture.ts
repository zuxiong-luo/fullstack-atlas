import type { Article } from '../../articleTypes';
const article: Article = {
  "id": "cross-platform-architecture",
  "topic": "flutter",
  "title": "跨平台架构：领域逻辑、状态与平台适配接口",
  "description": "围绕设备任务管理，把领域值、应用状态和宿主能力分开；完整实现可取消控制器、端口解码、晚到结果防护和 React 18 实验，明确共享规则与真实原生验证的界线。",
  "minutes": 52,
  "labMinutes": 35,
  "tags": [
    "跨平台",
    "架构",
    "状态机",
    "端口与适配器",
    "取消",
    "React 18"
  ],
  "scope": "一个页面会话中的设备选择与只读巡检：TypeScript纯核心、受控模拟适配器、自足React18.3.1实验。交付状态/归属/失败/计时器清理验证；未实现RN、Flutter、Electron原生设备适配器，不比较真实设备性能。",
  "prerequisites": [
    "能读TypeScript接口、Promise与async/await",
    "知道状态变化可以请求界面更新；无需掌握特定状态库"
  ],
  "kind": "series",
  "status": "complete",
  "verifiedAt": "2026-10-24",
  "versions": [
    "Node.js22.12.0",
    "TypeScript5.7.3",
    "React/ReactDOM18.3.1",
    "纯TS核心与计时器模拟；原生宿主未接入"
  ],
  "questionIds": [],
  "experiment": "react",
  "examples": [
    {
      "label": "完整核心、适配器、浏览器实验与测试",
      "path": "cross-platform-architecture.zip"
    },
    {
      "label": "运行与验证边界",
      "path": "cross-platform-architecture/README.md"
    }
  ],
  "sections": [
    {
      "id": "definition",
      "title": "跨平台架构先分职责：哪些规则稳定，哪些能力依赖宿主",
      "paragraphs": [],
      "blocks": [
        {
          "type": "paragraph",
          "text": "跨平台架构是在多个宿主中组织同一项功能的方法：把稳定的业务规则与数据含义保持清楚，把系统权限、设备通信和界面更新等差异放到明确边界。它不等于所有语言共享一份源文件，也不等于先安装一个状态库。判断结构是否有用，可以问：换一个设备接口或界面框架时，哪些逻辑需要重写，哪些原有测试还应该成立？"
        },
        {
          "type": "paragraph",
          "text": "我们沿用设备任务管理，但这篇不再重复 RN 与 Flutter 如何渲染。目标缩到一个页面：选择 A，加载它的能力，发起一次只读巡检；切换到 B 后，A 的旧结果没有资格进入 B 的状态；取消和关闭页面后，正在等待的工作得到停止请求。这里的 ready 只表示本例已取得当前设备快照，不证明真实蓝牙、串口或远程设备已经连接。"
        },
        {
          "type": "paragraph",
          "text": "可以把代码分成四种职责。Device、TaskResult 和能力约束表达业务含义；DeviceController 协调请求和页面状态；DevicePort 定义外部能力契约；适配器把具体协议和错误转换为契约，视图只展示快照与提交意图。控制器属于应用协调层，不把所有界面字段都称作纯领域规则。这样讨论分层才有落点，而不只是画出几个漂亮盒子。"
        },
        {
          "type": "figure",
          "src": "figures/cross-platform-architecture/boundaries.svg",
          "title": "依赖接口，而不是让设备 SDK 进入每个按钮回调",
          "alt": "视图提交意图给控制器，控制器调用DevicePort；已实现计时器模拟适配器，原生适配器明确待接入。",
          "caption": "箭头分别标调用、状态与实现关系。TS纯核心不导入React；Dart宿主需要实现等价契约，不会自动执行这份TS。"
        },
        {
          "type": "paragraph",
          "text": "Flutter 官方架构指导也把展示、状态与数据访问分开，并允许按复杂度增加领域层；这是理解职责的参考，不要求每个小功能都创建同一组类。本例只做单页面、一个当前操作和一个发布回调。多人共享连接、后台常驻任务和可靠命令队列需要另一套生命周期，不能从这个局部控制器直接推导。"
        }
      ]
    },
    {
      "id": "contract",
      "title": "端口定义需要什么，适配器确认收到的究竟是什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "export type ErrorCode='permission'|'unsupported'|'offline'|'timeout'|'protocol'|'unexpected';\nexport class PortFailure extends Error {\n  constructor(public code:ErrorCode){super(code);}\n}\nexport type Device={id:string;label:string;canInspect:boolean};\nexport type TaskResult={deviceId:string;commandId:string;summary:string};\nexport interface DevicePort {\n  load(id:string,signal:AbortSignal):Promise<Device>;\n  inspect(id:string,commandId:string,signal:AbortSignal):Promise<TaskResult>;\n}\nexport function decodeDevice(raw:unknown,id:string):Device {\n  if(!raw||typeof raw!=='object')throw new PortFailure('protocol');\n  const value=raw as Record<string,unknown>;\n  if(value.id!==id||typeof value.label!=='string'||!value.label||value.label.length>40||typeof value.canInspect!=='boolean')throw new PortFailure('protocol');\n  return {id,label:value.label,canInspect:value.canInspect};\n}\nexport function decodeResult(raw:unknown,id:string,commandId:string):TaskResult {\n  if(!raw||typeof raw!=='object')throw new PortFailure('protocol');\n  const value=raw as Record<string,unknown>;\n  if(value.deviceId!==id||value.commandId!==commandId||typeof value.summary!=='string'||!value.summary||value.summary.length>120)throw new PortFailure('protocol');\n  return {deviceId:id,commandId,summary:value.summary};\n}\nexport const errorMessages:Record<ErrorCode,string>={\n  permission:'没有设备权限，请在宿主设置中检查授权',unsupported:'当前宿主没有实现该能力',\n  offline:'设备不可达，请确认连接',timeout:'设备适配器报告超时，请查询当前状态',\n  protocol:'设备返回格式或请求归属不符合约定',unexpected:'操作失败，请查看受控诊断日志',\n};\nexport function uiError(error:unknown):{code:ErrorCode;message:string}{\n  const code=error instanceof PortFailure&&Object.hasOwn(errorMessages,error.code)?error.code:'unexpected';\n  return {code,message:errorMessages[code]};\n}\nexport type ViewState={\n  deviceId:string|null;connection:'idle'|'loading'|'ready'|'error';label:string|null;canInspect:boolean;\n  command:'idle'|'running'|'success'|'error';result:string|null;\n  connectionError:ReturnType<typeof uiError>|null;commandError:ReturnType<typeof uiError>|null;\n};\nexport function initialState():ViewState{return {deviceId:null,connection:'idle',label:null,canInspect:false,command:'idle',result:null,connectionError:null,commandError:null};}",
          "language": "ts",
          "filename": "examples/cross-platform-architecture/core.ts",
          "purpose": "纯核心开头：错误类型、领域值、端口、DTO解码、受控错误和完整状态定义。连续原文，后面继续展示控制器。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "这里的端口是接口契约：load 接收设备 ID 和取消信号，返回 Device；inspect 还接收命令关联 ID，返回 TaskResult。业务无需知道数据来自 HTTP、平台通道还是受控计时器。接口中的 Promise 表达异步结果，不保证原生实现没有同步阻塞，也不保证 signal 发出后外部操作已经停止。"
        },
        {
          "type": "paragraph",
          "text": "TypeScript 接口在运行时不会检查设备消息，因此 decodeDevice 和 decodeResult 仍要判断实际字段。load 的结果必须属于所请求设备，标签是有长度限制的字符串，能力是布尔值；命令结果还必须回传同一个 commandId。正常 DTO 只保留契约字段，原始对象里的额外内容不会传入页面。错误归属和坏格式都收敛成 protocol。"
        },
        {
          "type": "paragraph",
          "text": "canInspect 表示当前快照声明具备只读巡检能力，不能替代宿主权限。权限拒绝应由真正的适配器在平台边界映射为 permission；宿主压根没有实现接口则是 unsupported。两种情况都可能让按钮不可用，但修复方向不同：一种需要授权，一种需要安装或实现能力。当前模拟器只用于验证这些分类如何影响状态。"
        },
        {
          "type": "paragraph",
          "text": "uiError 使用有限错误码映射文字，未知异常不会把原始 message 直接显示到页面。测试故意传入含 secret 的底层错误，页面得到通用提示。正式产品可以把本例的中文消息移到展示层做本地化，同时保留稳定错误码；诊断日志则应记录受控上下文，并按实际系统要求脱敏。这里没有实现日志平台，不用一条提示假装完成所有诊断。"
        }
      ]
    },
    {
      "id": "state",
      "title": "先列允许的状态迁移，再选择通知机制",
      "paragraphs": [],
      "blocks": [
        {
          "type": "table",
          "headers": [
            "事件",
            "连接状态变化",
            "命令与数据的处理"
          ],
          "rows": [
            [
              "选择设备",
              "任何状态→loading",
              "旧结果、能力和命令都清空"
            ],
            [
              "当前加载成功",
              "loading→ready",
              "保存当前标签与能力"
            ],
            [
              "当前加载失败",
              "loading→error",
              "发布受控连接错误"
            ],
            [
              "发起巡检",
              "保持ready",
              "idle/success/error→running；重复点击拒绝"
            ],
            [
              "巡检完成或失败",
              "保持ready",
              "success或error，不自动宣称连接断开"
            ],
            [
              "取消加载",
              "loading→idle",
              "旧加载失去发布资格"
            ],
            [
              "取消巡检",
              "保持ready",
              "command→idle，结果清空"
            ],
            [
              "销毁拥有者",
              "不再发布",
              "旧结果失效，发出取消请求"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "连接和命令分开，是因为“已取得设备快照”与“这次命令成功”回答不同问题。设备加载成功后，巡检可能超时；不能直接把整个连接状态设为失效，也不能继续显示上一次巡检的成功结果。反过来，切换设备必须清除旧能力与结果，否则 B 的界面会短暂展示 A 的信息，即使后台请求最后正确返回，也已经误导用户。"
        },
        {
          "type": "figure",
          "src": "figures/cross-platform-architecture/states.svg",
          "title": "两组状态，以及它们之间的约束",
          "alt": "连接从idle到loading再到ready或error；只在ready且能力允许时进入命令running；取消和销毁有独立规则。",
          "caption": "图只列主要路径，不把所有字段的笛卡尔组合当作有效状态。状态名表达本应用语义。"
        },
        {
          "type": "code",
          "code": "export class DeviceController {\n  private epoch=0;\n  private active:AbortController|null=null;\n  private closed=false;\n  private state=initialState();\n  constructor(private port:DevicePort,private publish:(state:ViewState)=>void=()=>{}){}\n  get snapshot():ViewState{return {...this.state,connectionError:this.state.connectionError?{...this.state.connectionError}:null,commandError:this.state.commandError?{...this.state.commandError}:null};}\n  private emit(change:Partial<ViewState>){this.state={...this.state,...change};this.publish(this.snapshot);}\n  private invalidate(){this.epoch+=1;const old=this.active;this.active=null;old?.abort();return this.epoch;}\n  private owns(epoch:number,id:string,signal:AbortSignal){return !this.closed&&epoch===this.epoch&&id===this.state.deviceId&&!signal.aborted;}",
          "language": "ts",
          "filename": "examples/cross-platform-architecture/core.ts",
          "purpose": "控制器字段与共同机制：当前代数、取消句柄、快照副本、结果归属判断。连续承接前一段。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "状态只由控制器改变，界面拿到的是快照副本。错误对象也复制，避免调用者改一个提示就反过来污染内部状态。publish 在本例是一位页面拥有者提供的回调，不是通用事件总线；界面框架如何订阅、批处理和重绘留给对应适配层。共享的重点是状态迁移与发布资格，不是强迫每个平台使用同一个通知库。"
        }
      ]
    },
    {
      "id": "load",
      "title": "普通加载先走通，再引入设备切换的竞争窗口",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "  async connect(id:string):Promise<void>{\n    if(this.closed)return;\n    if(!/^[a-zA-Z0-9_-]{1,32}$/.test(id))throw new RangeError('invalid device id');\n    const epoch=this.invalidate(),controller=new AbortController();this.active=controller;\n    this.emit({...initialState(),deviceId:id,connection:'loading'});\n    try{\n      const device=await this.port.load(id,controller.signal);\n      if(!this.owns(epoch,id,controller.signal))return;\n      if(device.id!==id)throw new PortFailure('protocol');\n      this.emit({connection:'ready',label:device.label,canInspect:device.canInspect});\n    }catch(error){if(this.owns(epoch,id,controller.signal))this.emit({connection:'error',connectionError:uiError(error)});}\n    finally{if(this.active===controller)this.active=null;}\n  }",
          "language": "ts",
          "filename": "examples/cross-platform-architecture/core.ts",
          "purpose": "完整connect路径：校验输入，先使旧工作失效，再发布loading，await返回后判断归属，最后只清自己的句柄。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "初始没有选择设备。connect(A) 让 epoch 从零变一，保存新 AbortController，并发布 A/loading。适配器返回 Device(A) 后，owns 检查控制器没有关闭、代数仍为一、当前仍选择 A、信号没有取消，才发布 ready 与能力。正常路径让读者知道每个判断保护谁，之后再看晚到结果就不需要猜背景。"
        },
        {
          "type": "paragraph",
          "text": "现在 A 尚未完成，用户选择 B。invalidate 先把代数变二，再给 A 的信号发 abort；新状态立即成为 B/loading。B 先返回时 owns(2,B) 成立；A 稍后返回时 owns(1,A) 失败，因此不触碰 B。代数先失效再取消，是为了让已经进入异步链的回调也没有发布资格。只比 deviceId 还不够：同一设备 A 点了两次，较早结果也可能比新的更晚回来。"
        },
        {
          "type": "figure",
          "src": "figures/cross-platform-architecture/ownership.svg",
          "title": "停止请求与结果归属防护，需要同时存在",
          "alt": "选择A后选择B，代数先改变；B成功后A晚到，归属检查拒绝旧结果。",
          "caption": "受控完成顺序示意，图中距离没有时间比例。即使适配器忽略取消，旧结果也不得覆盖新状态。"
        },
        {
          "type": "paragraph",
          "text": "finally 还有一个很容易漏的判断：只有 this.active 仍是本次 controller 才清掉它。若 A 的 finally 不分归属直接设 active=null，就可能抹掉 B 的取消句柄，后续取消 B 失效。异步代码需要的不只是数据归属，也包括清理动作的归属。测试把晚到顺序握在受控 Promise 手里，不靠设备网速碰巧复现。"
        }
      ]
    },
    {
      "id": "commands",
      "title": "命令有自己的关联信息，也要在业务入口抑制重复",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "  async inspect():Promise<boolean>{\n    if(this.closed||this.state.connection!=='ready'||!this.state.canInspect||this.state.command==='running')return false;\n    const id=this.state.deviceId!,epoch=this.invalidate(),controller=new AbortController();this.active=controller;\n    const commandId=`${id}:${epoch}`; // Page-session correlation only, not a durable idempotency key.\n    this.emit({command:'running',result:null,commandError:null});\n    try{\n      const result=await this.port.inspect(id,commandId,controller.signal);\n      if(!this.owns(epoch,id,controller.signal))return false;\n      if(result.deviceId!==id||result.commandId!==commandId)throw new PortFailure('protocol');\n      this.emit({command:'success',result:result.summary});return true;\n    }catch(error){if(this.owns(epoch,id,controller.signal))this.emit({command:'error',commandError:uiError(error)});return false;}\n    finally{if(this.active===controller)this.active=null;}\n  }",
          "language": "ts",
          "filename": "examples/cross-platform-architecture/core.ts",
          "purpose": "完整inspect路径：状态和能力在控制器再检查，关联请求结果，成功与失败保留设备快照。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "只有 ready、canInspect=true 且当前不在 running 时，巡检才会进入端口。UI 禁用按钮减少误点，控制器的检查保证其他调用者也不能绕过。这和 Electron 专题里主进程拒绝越权是相同的分工原则，但本例检查的是当前页面能力和状态，不声称已经完成真实宿主授权。"
        },
        {
          "type": "paragraph",
          "text": "新命令生成 A:epoch 形式的关联 ID，并把它交给端口。结果设备和 commandId 均一致才接受。这个 ID 只在页面会话中关联请求，不是跨进程唯一编号，也不是持久幂等键。真实控制设备、开锁或扣费时，取消与超时后可能已经产生外部副作用，必须用设备端确认、结果查询和适当幂等协议处理；本例只做模拟只读巡检。"
        },
        {
          "type": "paragraph",
          "text": "命令期间切换到 B，同样先提高代数并取消 A。A 的成功或失败晚到时只能被忽略，不能把 B 的 command 改成 success 或 error。若当前命令返回错误的关联 ID，则成为 protocol 错误，连接仍保持 ready。这样既避免错误结果污染，也不把单次命令失败夸大成整个设备连接必然失效。"
        }
      ]
    },
    {
      "id": "cancel",
      "title": "取消、销毁与资源释放，分别能保证什么",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "  cancel(){\n    if(this.closed)return;\n    this.invalidate();const ready=this.state.connection==='ready';\n    this.emit({connection:ready?'ready':'idle',label:ready?this.state.label:null,canInspect:ready&&this.state.canInspect,command:'idle',result:null,connectionError:null,commandError:null});\n  }\n  dispose(){if(this.closed)return;this.invalidate();this.closed=true;this.publish=()=>{};}\n}",
          "language": "ts",
          "filename": "examples/cross-platform-architecture/core.ts",
          "purpose": "核心收尾：取消保留已加载设备，销毁先失效、取消并移除发布回调。至此纯核心文件已完整展示。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "cancel 加载时回到 idle；cancel 巡检时保留已加载设备、清掉命令结果，并让旧结果失效。dispose 可以调用多次，后续 connect/inspect 都不会再启动工作，晚到异常也不会发布。这些是控制器自身可证明的语义。它发出了 abort，但没有为真实原生 SDK 执行异步 close，更没有等待设备确认撤销命令。"
        },
        {
          "type": "table",
          "headers": [
            "资源",
            "拥有者",
            "本例怎样释放"
          ],
          "rows": [
            [
              "当前操作的AbortController",
              "控制器",
              "切换、取消、销毁时abort"
            ],
            [
              "模拟计时器与abort监听",
              "模拟适配器",
              "支持取消时清timer/监听并拒绝Promise"
            ],
            [
              "页面发布回调",
              "页面会话拥有的控制器",
              "dispose后替换为空回调"
            ],
            [
              "蓝牙/串口/平台订阅",
              "未来真实适配器",
              "本例未实现；要约定close完成、失败与共享范围"
            ]
          ]
        },
        {
          "type": "paragraph",
          "text": "如果真实适配器需要 await close 才能确认资源释放，就应把这个完成协议明确交给拥有者，例如应用级连接服务或可等待的关闭过程。页面同步卸载只能先停止发布，不能把一个返回 void 的 dispose 写成“所有系统资源此刻已经关闭”。反过来，多页面共享连接时，也不能因为一个页面离开就擅自关闭所有人的连接。生命周期取决于谁拥有资源。"
        }
      ]
    },
    {
      "id": "adapter",
      "title": "提供一个诚实的模拟器，让取消是否生效可以观察",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import {PortFailure,decodeDevice,decodeResult} from './core.js';\nimport type {DevicePort} from './core.js';\n\n// Explicitly simulated: these timers never connect to hardware or native permissions.\nexport class TimerDeviceAdapter implements DevicePort {\n  respectCancellation=true;\n  pending=0;\n  cancelled=0;\n  private wait(ms:number,signal:AbortSignal){\n    const respect=this.respectCancellation;this.pending+=1;\n    return new Promise<void>((resolve,reject)=>{\n      let settled=false;\n      const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);this.pending-=1;if(error)reject(error);else resolve();};\n      const abort=()=>{this.cancelled+=1;finish(new Error('simulated abort'));};\n      const timer=setTimeout(()=>finish(),ms);\n      if(respect){if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});}\n    });\n  }\n  async load(id:string,signal:AbortSignal){\n    await this.wait(id==='A'?800:120,signal);\n    if(id==='denied')throw new PortFailure('permission');\n    return decodeDevice({id,label:'模拟设备 '+id,canInspect:id!=='readonly'},id);\n  }\n  async inspect(id:string,commandId:string,signal:AbortSignal){\n    await this.wait(500,signal);\n    return decodeResult({deviceId:id,commandId,summary:'模拟巡检完成：'+id},id,commandId);\n  }\n}",
          "language": "ts",
          "filename": "examples/cross-platform-architecture/demo-adapter.ts",
          "purpose": "完整适配器：计时器模拟等待，显式支持关闭取消行为；返回DTO仍经过同一解码器。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "A 的模拟等待设为 800ms，其他设备 120ms，巡检为 500ms；这些数字只安排可观察顺序，不是硬件性能。支持取消时 wait 清计时器、移除监听、减少 pending 并拒绝。测试确认一项等待从 pending=1 变零。关闭“遵守取消”后，旧计时器继续到期，控制器仍应拦住它的结果；这只证明发布防护，不能拿它宣称底层工作已经停止。"
        },
        {
          "type": "paragraph",
          "text": "denied 设备通过受控错误演示 permission，readonly 返回 canInspect=false。真正的 RN 原生模块、Flutter MethodChannel 或 Electron IPC 都没有在这里实现；它们应分别负责系统能力检查、原始返回校验、错误映射和真实释放。接口统一后，成功与拒绝的领域用例可以成为共同验收规则，但每个平台仍需要执行自己的原生验证。"
        },
        {
          "type": "paragraph",
          "text": "JavaScript 宿主可以复用这份纯 TS 核心，Flutter/Dart 则需要实现等价的值、状态和端口语义，再跑对应契约。本文没有额外贴一份未经执行的 Dart 翻译来增加“跨平台”观感。已有 Flutter 页面与 Electron 安全专题负责它们自己的运行和权限证据；这里主要把可共享的规则和不可假设的平台事实分开。"
        }
      ]
    },
    {
      "id": "view",
      "title": "界面拥有控制器：把创建和清理放在同一次Effect里",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "import React, {useEffect,useRef,useState} from 'react';",
          "language": "tsx",
          "filename": "examples/cross-platform-architecture/App.tsx",
          "purpose": "浏览器文件唯一导入。完整核心和模拟适配器由下方同步脚本原样合成，避免沙箱相对导入。",
          "kind": "excerpt"
        },
        {
          "type": "code",
          "code": "export default function App(){\n  const [state,setState]=useState(initialState);\n  const [respect,setRespect]=useState(true);\n  const controller=useRef<DeviceController|null>(null),adapter=useRef<TimerDeviceAdapter|null>(null);\n  useEffect(()=>{\n    const source=new TimerDeviceAdapter(),owner=new DeviceController(source,setState);\n    adapter.current=source;controller.current=owner;void owner.connect('A');\n    return()=>{controller.current=null;adapter.current=null;owner.dispose();};\n  },[]);\n  return <main style={{fontFamily:'system-ui',padding:20,lineHeight:1.6,maxWidth:720}}>\n    <h1>设备任务 · 架构实验</h1><p>全部数据来自本地计时器，不是蓝牙、RN 或 Flutter 真机。</p>\n    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{['A','B','readonly','denied'].map(id=><button key={id} onClick={()=>void controller.current?.connect(id)}>选择 {id}</button>)}</div>\n    <label><input type=\"checkbox\" checked={respect} onChange={event=>{const value=event.target.checked;setRespect(value);if(adapter.current)adapter.current.respectCancellation=value;}}/>新操作遵守取消（取消勾选可观察晚到结果）</label>\n    <p>选中：{state.deviceId??'无'} · 连接：{state.connection} · 命令：{state.command}</p>\n    <p>{state.label??'尚未取得当前设备数据'}</p>\n    <button disabled={state.connection!=='ready'||!state.canInspect||state.command==='running'} onClick={()=>void controller.current?.inspect()}>模拟只读巡检</button>{' '}\n    <button onClick={()=>controller.current?.cancel()}>取消当前操作</button>\n    <p role=\"status\">{state.connectionError?.message??state.commandError?.message??state.result??'等待操作'}</p>\n    <p>实验：先取消勾选，选择 A 后迅速选择 B。B 先完成，A 晚到也不得覆盖 B。</p>\n  </main>;\n}",
          "language": "tsx",
          "filename": "examples/cross-platform-architecture/App.tsx",
          "purpose": "完整React视图调用者。控制器在Effect内创建，清理中dispose；事件只提交意图。",
          "kind": "excerpt"
        },
        {
          "type": "paragraph",
          "text": "页面把控制器的 publish 直接接到 setState，按钮只调用 connect、inspect 或 cancel。控制器在 Effect setup 里创建，所以 React 18 开发 StrictMode 的 setup→cleanup→setup 可以得到新的拥有者，而不是拿一个已经 dispose 的 useMemo 单例继续使用。清理先移除当前引用再销毁旧拥有者，旧回调也会被核心的closed/epoch保护。"
        },
        {
          "type": "paragraph",
          "text": "core.ts 不依赖 React，demo-adapter.ts 只依赖核心。为了本站现有沙箱能运行，App.tsx 是由核心、适配器正文和视图合成的单文件；下面的生成脚本保留这一关系，测试逐字检查合成体一致。正式项目可以直接按模块引用，浏览器教学入口则只 import React，不要求沙箱解析外部项目目录。"
        },
        {
          "type": "code",
          "code": "import {readFile,writeFile} from 'node:fs/promises';\nconst core=await readFile(new URL('./core.ts',import.meta.url),'utf8');\nconst adapter=(await readFile(new URL('./demo-adapter.ts',import.meta.url),'utf8')).split('\\n').filter(line=>!line.startsWith('import ')).join('\\n').trim();\nconst view=await readFile(new URL('./view.tsx.txt',import.meta.url),'utf8');\nconst source=\"import React, {useEffect,useRef,useState} from 'react';\\n\\n\"+core+'\\n'+adapter+'\\n\\n'+view;\nawait writeFile(new URL('./App.tsx',import.meta.url),source);",
          "language": "js",
          "filename": "examples/cross-platform-architecture/sync-browser.mjs",
          "purpose": "完整生成脚本。独立项目npm test会先同步再编译；生成文件已随ZIP交付。",
          "kind": "excerpt"
        },
        {
          "type": "experiment",
          "id": "cross-platform-architecture",
          "title": "运行设备切换与取消实验",
          "description": "React18.3.1，自足App.tsx。取消勾选遵守取消，选择A后迅速选择B，观察B结果保持；测试的是Web模拟器，不是原生硬件。"
        },
        {
          "type": "paragraph",
          "text": "实验步骤先选 A 并等待 ready，再运行巡检得到成功；选择 readonly，巡检按钮与核心都拒绝；选择 denied，显示受控授权提示。观察晚到结果时先取消勾选“新操作遵守取消”，重新选 A 后迅速选 B，B 先 ready，A 结束后仍显示 B。重勾选只影响后来建立的操作；先前已经开始的计时器按启动时配置运行。"
        }
      ]
    },
    {
      "id": "verify",
      "title": "验证结果按层记录，不把mock通过写成所有平台完成",
      "paragraphs": [],
      "blocks": [
        {
          "type": "code",
          "code": "cd examples/cross-platform-architecture\nnvm use\nnpm ci\nnpm test",
          "language": "sh",
          "filename": "终端 · 独立项目验证",
          "purpose": "ZIP解压后进入同名目录。Node22.12.0、TS5.7.3、React18.3.1，只有小型JS依赖，不安装移动SDK。",
          "kind": "runnable"
        },
        {
          "type": "paragraph",
          "text": "实际 macOS14.5 x64 已运行 17 项测试：正常 DTO、坏格式/错误归属、加载状态、切换晚到、同设备重试、取消加载、命令与重复抑制、能力拒绝、命令晚到、受控错误、销毁、快照隔离、计时器释放、SSR smoke、合成源码一致，以及控制器防御错误端口结果与取消命令保留设备。核心顺序测试直接控制 resolve/reject，没有用睡眠猜网络完成顺序。"
        },
        {
          "type": "paragraph",
          "text": "SSR smoke 只证明 React 18 静态标记可以生成，不会执行 Effect，也不证明点击、hydration 或手机界面正确。Web 实验已在本站React18.3.1沙箱实际编译并核验A/B归属、readonly能力限制、denied错误及390px视口；RN/Flutter 真机、系统权限、后台切换和设备释放仍未完成。没有性能曲线，没有原生耗时排名，也没有把模拟器的 800ms 当作真实通信延迟。"
        },
        {
          "type": "paragraph",
          "text": "最后做三次推演：同一个 A 重试后，为什么还要代数？因为 deviceId 没变，旧请求仍需失效。信号 abort 后为什么还检查owns？因为外部适配器可能忽略取消，结果已在路上。为什么命令失败不一定把连接改成error？因为快照可用性和单次工作结果属于不同状态。把这三件事讲清楚，分层才真正帮助定位，而不仅是文件夹看起来整齐。"
        },
        {
          "type": "paragraph",
          "text": "下一步接真实平台时，先保留这组验收语义，再逐个补平台事实：能力是否存在、权限何时询问、数据如何解码、取消能停止到哪一步、关闭何时完成。不要先修改界面去掩盖协议差异。源码、图形和实验可进入离线包，原生SDK、设备与服务器运行环境仍需另外准备。"
        }
      ]
    }
  ],
  "references": [
    {
      "title": "Flutter官方架构指导",
      "url": "https://docs.flutter.dev/app-architecture/guide"
    },
    {
      "title": "Flutter3.41.3 ChangeNotifier固定源码",
      "url": "https://github.com/flutter/flutter/blob/3.41.3/packages/flutter/lib/src/foundation/change_notifier.dart"
    },
    {
      "title": "React官方useEffect生命周期",
      "url": "https://react.dev/reference/react/useEffect"
    },
    {
      "title": "React18.3.1提交阶段固定源码",
      "url": "https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCommitWork.new.js"
    }
  ]
};
export default article;
