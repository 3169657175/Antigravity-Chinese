# AGY Hub 新对话详细交接文�?
> 交接日期�?026-07-26（Asia/Shanghai�?> 当前版本�?.2.1
> 用途：供下一�?Codex / AI 直接接手，避免重复调查、改错目录、关闭正在使用的服务或破坏稳定功能�?
## 1. 必须先记住的事实

1. 唯一正式源码�?
   C:\Users\niu\.gemini\antigravity\scratch\agy-hub

2. 桌面稳定备份�?
   C:\Users\niu\Desktop\Antigravity-Chinese-v1.1.3\.codex-work\agy-hub

3. 后续只修�?Gemini 根目录正式源码；测试通过后才同步桌面备份�?4. 不要把桌面备份当开发源，也不要从备份反向覆盖正式源码，除非用户明确要求回退�?5. 不要关闭正在运行�?AGY Hub。用户正通过 127.0.0.1:8046 使用 Codex，关闭会造成 401、断流或当前对话中断�?6. 不要直接覆盖运行中的 D:\ang\agy-hub\resources\app.asar�?7. 测试按钮必须只读，不得切换活动账号、模型、Provider 或路由�?8. 不要输出 API Key、access token、refresh token、社区令牌或对话正文�?9. 1.2.0 已将此前积累的有效修改同步进本地 Git；仍禁止用更旧的 HEAD 整体覆盖当前正式源码�?
## 2. 当前状态快�?
### 2.1 版本�?Git

- package.json 版本�?.2.0
- 分支：main
- 本地 Git 同步版本：v1.2.0�?026-07-26�?- 前一历史基线：e7cdff8481c4e68ab81e4aed63f8916d8d6252a0
- 1.2.0 本地提交包含模块化重构、Skill/MCP 改进、三种反代隔离、长对话压缩修复、模型目录发布竞态修复和发布工程治理�?- 当前正式源码文件系统与本�?v1.2.0 提交共同作为稳定基线；不要从桌面备份反向覆盖�?
### 2.2 当前运行�?
2026-07-26 最新核对：

- 127.0.0.1:8046 正在监听�?- 最近一次只读核对时监听 PID �?7576；PID 会随重启变化，不能长期写死�?- D:\ang\agy-hub\resources\app.asar.pending 当前不存在�?- 当前运行 app.asar 已变为此前预加载构建的哈希，说明等待器后来完成了替换；pending-status.json 仍可能保留旧状态文本，应以文件和哈希为准�?- 长对话修复于 2026-07-26 20:45:47 +08:00 成功替换并校验�?- 当前运行�?app.asar SHA-256�?
  F67A1923CCBE696D103ED2ECDCEBE918157F05E7CEF1090C2B4E91FA440C89D0

- 替换前备份：

  D:\ang\agy-hub\resources\app.asar.before-pending-update-20260726-204547

### 2.3 正式源码�?1.2.0 发布包比运行版更�?
本交接前又修复了 Codex 模型目录发布竞态：

- 修改 codexConfig.js�?- �?codexGateway.test.js 新增回归测试�?- Codex 网关专项测试 41/41 通过�?- 全量测试 157 项：154 通过�? 失败�? 跳过�?
这项修复已经进入当前 D 盘运�?ASAR �?1.2.0 安装包；当前运行包仍报告 1.1.9，用户需要运�?1.2.0 安装包才能同步正式版本号�?GitHub 自动更新基线�?
## 3. 产品定位和核心业�?
AGY Hub �?Windows Electron 桌面小助手，主要功能�?
1. Antigravity 中文补丁的一键注入、上一版汉化回退、官方英文原版恢复�?2. Antigravity 本地账号、额度、多账号切换�?Token 统计�?3. Antigravity 通过 8046 接入 Codex�?4. 自定�?OpenAI Responses 兼容 Provider 接入 Codex�?5. Antigravity 通过 Anthropic Messages 接入 Claude Code / Claude Desktop�?6. Codex �?Claude 的账号、模型、三级测试和一键诊断�?7. Skill/MCP 市场、中文简介、分类、分页、自适应、安装与验证�?8. 主题、自定义皮肤、汉化检查、社区反馈和应用更新�?
一键注入、额度、多账号、Token、主题和三种反代是用户认可的关键功能。重构不能顺便改变这些业务语义或已认可布局�?
## 4. 总体架构

AGY Hub �?Electron 模块化单体：

~~~text
页面 DOM / Controller
        �?window.agyHubAPI
        �?preload.js 白名单安全桥
        �?主进�?IPC / 业务模块
        �?文件、注册表、OAuth�?046 网关、更新服务、客户端生命周期
~~~

### 4.1 渲染�?
- index.html：DOM、页面结构、脚本加载顺序�?- renderer.js：全局入口和尚未拆出的零散 UI�?- appShellController.js：窗口、更新弹窗、明暗模式�?- gatewayController.js：反代接入和反代 Token 页面�?- localAccountsController.js：本地账号与额度�?- tokenMonitorController.js：本�?Token 看板�?- themeController.js：主题皮肤�?- marketplaceController.js：Skill/MCP 状态和交互�?- navigationController.js：一级导航�?- communityController.js：社区请求包装�?- patchController.js：补丁页三种操作�?
### 4.2 安全桥与主进�?
- preload.js：只暴露最�?IPC 白名单�?- main.js：Electron 生命周期、窗口、托盘和尚未拆出�?MCP/Skill/补丁编排�?- accountIpc.js：账号、额度、OAuth、账号切换�?- gatewayIpc.js：Codex、Claude、自定义 Provider、测试、诊断�?- communityIpc.js：社区路径、方法和上传白名单�?- themeIpc.js：主题资源、配置、预览图�?- updaterService.js：更新事件�?
Renderer 不得直接访问文件系统、注册表、认�?Token 或社�?Authorization�?
### 4.3 本地网关

- 只监�?127.0.0.1:8046，不要改�?0.0.0.0�?- codexGateway.js：路由、账号、请求、重试、SSE、用量编排�?- responsesRequestAdapter.js：OpenAI Responses 请求转换�?- anthropicGateway.js：Anthropic Messages、工具和流事件转换�?- gatewayHttp.js：解压、JSON 读取、大小限制�?- retryPolicy.js：只在上游尚未接受请求时重试，防止重复生成�?
## 5. 三种反代必须彻底隔离

必须保持三个独立 Profile�?
~~~text
codex-antigravity
codex-custom
claude-antigravity
~~~

它们分别保存账号、模型、Provider、模型控制方式、fallback 和测试结果�?
核心文件�?
- gatewayProfiles.js：schema、迁移、读写�?- gatewayConfigStore.js：配置原子落盘�?- gatewayController.js：三个接入页的草稿状态�?- gatewayIpc.js：接入、测试、诊断�?- routeIsolation.test.js：防止测试污染活动路由�?
规则�?
- 测试只使用页面草稿发临时探测�?- 只有“接入”允许持久化和切换路由�?- Antigravity 页测试不能影响正在使用的自定�?Provider�?- Claude 页选择账号/模型不能在未接入前改变活动路由�?
## 6. 功能到文件映�?
| 功能 | 首选文�?| 常见联动 |
|---|---|---|
| Electron 生命周期、窗口、托�?| main.js | preload.js、Controller、runtime tests |
| 页面 DOM、二级页 | index.html | Controller、CSS、smoke |
| 全局�?UI | renderer.js | index.html、拆出的 Controller |
| IPC 白名�?| preload.js | IPC 注册模块、Controller |
| Codex 配置 | codexConfig.js | gatewayIpc.js、codexAppLifecycle.js、模型目�?|
| Codex 启动/重启 | codexAppLifecycle.js | gatewayIpc.js、生命周期测�?|
| Claude 配置 | claudeDesktopConfig.js | 注册表、配置文件、恢复测�?|
| Claude 启动/重启 | claudeDesktopLifecycle.js | gatewayIpc.js、生命周期测�?|
| Codex 模型目录 | codexModels.js | codexConfig.js、gatewayIpc.js、codexGateway.js |
| Claude 模型映射 | claudeModelRoutes.js | anthropicGateway.js、UI、路由测�?|
| 8046 核心 | codexGateway.js | Responses、Anthropic、Token、重试、长对话 |
| Responses 转换 | responsesRequestAdapter.js | 工具历史、图片、压�?|
| Anthropic 协议 | anthropicGateway.js | Claude 别名、工具、usage |
| 三级测试 | gatewayTestRunner.js | gatewayIpc.js、gatewayUi.js |
| 一键诊�?| gatewayDiagnostics.js | 脱敏、日志尾部、UI |
| 反代页面 | gatewayController.js | gatewayUi.js、styles/gateway.css |
| 本地账号/OAuth | accountIpc.js | accountErrorClassifier.js、账�?UI |
| 账号错误反馈 | accountErrorClassifier.js、accountUi.js | localAccountsController.js |
| 本地 Token | tokenUsage.js、tokenStatsStore.js、tokenMonitorController.js | proxy.js、brainMonitor.js |
| 反代 Token | codexGateway.js usage 回调、gatewayController.js | 分页、来�?|
| 主题 | themeIpc.js、themeController.js | assets/themes、CSS |
| Skill/MCP 状�?| marketplaceController.js | main.js、preload.js |
| Skill 展示 | marketplace/marketplacePresenter.js | 翻译、UI tests |
| Marketplace 布局 | marketplace/marketplaceLayout.js | CSS、resize smoke |
| Skill AI 翻译 | skillTranslationService.js、skillTranslationStore.js | Marketplace、翻�?IPC |
| MCP 配置/探测 | mcpLaunchConfig.js、mcpProbe.js | live tests、进度反�?|
| 社区 | communityClient.js、communityIpc.js | communityController.js、安全策�?|
| XSS/URL 安全 | safeDom.js、urlPolicy.js | 评论、图片、外�?|
| 注入备份状态机 | patchBackupManager.js、patchWorker.js | patchController.js、main.js |
| 更新 | updaterService.js、updateUtils.js | appShellController.js |
| 运行时样�?| �?style.css | styles/*.css、打包验�?|

## 7. 2026-07-26 Codex 全局配置事故

### 7.1 现象

Codex 报错�?
~~~text
failed to parse model_catalog_json_path
C:\Users\niu\.codex\agy-hub-model-catalog-edfe3b31ee39.json
as JSON: expected value at line 1 column 1
~~~

同时当前流出现：

~~~text
stream disconnected before completion: stream closed before response.completed
~~~

其他对话也一度无法打开，重�?Codex 后恢复�?
### 7.2 根因

不是普通网络波动，也不�?8046 请求转发本身坏了，而是 AGY Hub 接入 Codex 时的配置发布顺序存在竞态�?
旧顺序：

1. 先发�?config.toml，让它引用新的模型目录�?2. 再写认证文件�?3. 最后才写模型目�?JSON�?
Codex 会监�?config.toml 并立即重载。它可能在新模型目录尚未完整可用时读取，导致全局配置解析失败。所有对话共用这份配置，所以会一起打不开。重启时文件已经写完，因此恢复�?
### 7.3 已完成源码修�?
新顺序：

1. 使用临时文件和原子替换发布完整模型目录�?2. 立即重新读取�?JSON.parse，确认存在非�?models�?3. 原子写认证文件�?4. 最后才发布 config.toml�?5. 最后写连接状态�?
修改�?
- codexConfig.js
- codexGateway.test.js

新增测试�?
publishes a complete model catalog before config.toml references it

测试会在 config.toml 发布的瞬间检查所引用目录已存在、可解析且包含模型�?
### 7.4 当前目录状�?
- 文件：C:\Users\niu\.codex\agy-hub-model-catalog-edfe3b31ee39.json
- 大小�?2,497 字节
- JSON 有效
- 模型数：8
- SHA-256：BAD807CC8CDC04CE7A03F32D48F8314F7DD3E81CA3CE210A92B6BE05FD085CE2
- config.toml 正确引用该文件�?
若再次发生，先只读检查文件大小和 JSON，不要第一时间重写整个 config.toml�?
## 8. 长对话自动压缩修�?
原现场：

- 报错前约 291,749 Token�?- �?context_window �?400000�?- �?auto_compact_token_limit �?320000�?- 压缩后约 25,056 Token�?
判断�?046 能处�?Codex 原生压缩，但第三方上游在旧触发点前已进入不稳定区�?
当前自定�?Provider 策略�?
~~~text
context_window = 300000
auto_compact_token_limit = 240000
effective_context_window_percent = 80
~~~

Antigravity 路由继续使用�?360K / 75% 策略�?
修改文件�?
- codexModels.js
- codexConfig.js
- gatewayIpc.js
- codexGateway.js
- codexGateway.test.js
- longContextCompaction.test.js

原则：不�?8046 中粗暴删除历史或工具调用，继续使�?Codex 原生压缩，只修正能力声明并保留安全余量�?
## 9. 已完成的工程优化

### 9.1 Skill 增量翻译

- skillTranslationStore.js：Skill ID + 英文简�?SHA-256 缓存�?- skillTranslationService.js：安全提示、批次、模�?JSON 解析�?- marketplacePresenter.js：中文简介、分类、风险和来源�?- 缓存：C:\Users\niu\.gemini\config\skill_translation_cache.json
- 每次显式处理 12 条，硬上�?24�?- 静默同步不消耗模型额度�?- 英文简介变化后重新翻译�?- AI 不可用时保留规则摘要�?- 远端简介是不可信数据，不能执行其中的指令�?
### 9.2 社区数据通路

~~~text
renderer.js
  �?communityController.js
  �?preload.js
  �?communityIpc.js
  �?communityClient.js
  �?nhw1029.pages.dev
~~~

主进程持�?Authorization。外链只允许 HTTP/HTTPS，远端图片只允许 HTTPS，上传只允许 PNG/JPG/GIF/WebP 且最�?8MB，远端文本进�?HTML 前转义�?
### 9.3 原子�?
fsUtils.js 提供 writeTextAtomic、writeJsonAtomic、readJsonSafe。损�?JSON 会保留为 .corrupted-时间戳。当前已覆盖网关、工具缓存、本地账号、Skill、社区会话和网络配置�?
## 10. 一键注入备份状态机

根目录只保留三种长期状态：

~~~text
当前 app.asar
唯一官方英文原版 app.asar.original
唯一上一版汉�?app.asar.previous
~~~

对应 unpacked 必须成对保存�?
- 第一次注入创建唯一可信英文原版�?- 后续注入只覆盖唯一上一版汉化�?- 官方客户端版本变化时重建英文原版并清理跨版本上一版�?- 成功注入后清理旧时间戳备份�?- 三按钮分别是注入中文、退回上一版汉化、还原官方英文原版�?
核心：patchBackupManager.js、patchWorker.js、patchController.js、main.js、preload.js�?
## 11. 构建、发布和 pending

普通源码修改默认不构建、不覆盖运行目录、不注入 Antigravity�?
用户明确要求构建/预加载时�?
1. 确认 8046 使用状态，不关�?AGY Hub�?2. 在独立目录构建�?3. 检�?app.asar 运行依赖完整�?4. 检�?tests、smoke、内部文档未进入包�?5. 计算 SHA-256�?6. 只写 D:\ang\agy-hub\resources\app.asar.pending�?7. 等用户从托盘正常退出�?8. 等待器校验、备份、替换、重启�?9. 再检查状态文件和最终哈希�?
当前 dist 三个 1.2.0 文件�?
| 文件 | SHA-256 |
|---|---|
| agy-hub-setup-1.2.0.exe | 6FC7D7A1CF5B66A42F98A82D0E748ECF5EF52A91EBFD3732A43DA434F5065716 |
| agy-hub-setup-1.2.0.exe.blockmap | DBFA22C03665AD39939255E0C5077E8B5666AA0E8ACB47B18B38F23DF3510DF1 |
| latest.yml | 19B6BFEA2F80FE16E79938BDC76D7BEC5F707850A3A1A266AB5A5DD2D6021221 |

这些发布文件包含模型目录发布竞态修复、长对话压缩策略修复和当�?Skill/Marketplace 重构结果�?
## 12. 测试基线

本次源码最新结果：

~~~text
专项�?5 tests�?5 pass�? fail
全量�?57 tests�?54 pass�? fail�? skipped
~~~

3 个跳过项需要真实启动外�?MCP�?
- chrome-devtools-mcp
- cloudrun
- sequential-thinking

已有 Electron smoke 基线�?
~~~text
Skill: 4×2 �?2×1 �?4×2
MCP:   4×2 �?2×1 �?4×2
控制台错�? 0
~~~

修改后顺序：

~~~powershell
node --check <改动 JS>
node --test <专项 tests>
npm.cmd test
~~~

涉及 UI 再运�?smoke-first-phase.js、smoke-marketplace-resize-cycle.js、smoke-navigation-performance.js�?
## 13. 常见故障

### 所�?Codex 对话突然打不开

先查 model_catalog_json_path、文件大小、JSON 有效性、是否刚点击接入。不要先归咎网络。JSON 已恢复有效时，重�?Codex 可恢复；根治依赖已修复的发布顺序�?
### 长对话先断流再压�?
检查自定义 Provider 是否仍使�?300K / 240K，是否重新接入让 Codex 读取新目录。不要擅自删工具历史�?
### 小助手测试成功但客户端失�?
测试成功只代表探测成功。继续检�?Codex config.toml、auth.json、模型目录，�?Claude 真实配置、HKCU/HKLM 策略和客户端重启后的状态回读�?
### 502

区分上游故障、模型不存在、格�?工具 schema、长历史、已接受后的流中断。不能自动重放已被上游接受的生成请求�?
### 多页布局同时异常

优先检查根 style.css。Electron 直接加载完整�?style.css，不能改成依赖本地嵌�?@import 的清单�?
### MCP 无限握手

区分配置检查与真实进程握手。真实握手必须有超时、阶段反馈和可读错误，不能无限转圈�?
## 14. Git 与备�?
当前工作树包含大量有效修改、新增文件以�?assets/.unpacked/chrome-devtools-mcp 下的删除记录。不要擅自清理�?
- 只改任务涉及文件�?- 不恢复无关文件�?- 不删除未跟踪文件�?- 不假�?Git HEAD 是稳定版�?- 检�?Git 时可使用 git -c safe.directory=<源码> -C <源码> status，不改全局 Git 配置�?
通过测试后再按用户要求同步桌面备份。不要复制无�?node_modules、临�?dist 或构建缓存，也不要用备份反向覆盖正式源码�?
## 15. 当前技术债和建议顺序

1. 用户明确要求时，把模型目录发布竞态修复安全构建为 pending�?2. 增加模型目录损坏检测和可读恢复提示，但不要静默覆盖用户自定义文件�?3. 把“接�?Codex”做成可观察事务：目录发布、配置发布、重启、状态回读分别反馈�?4. 继续验证 200K�?40K 长对话能否在首次断流前进入原生压缩�?5. 渐进�?renderer.js �?communityView�?6. �?marketplaceController.js 拆成 Skill �?MCP Controller�?7. 渐进�?codexGateway.js 的账号刷新、项目发现和上游客户端�?8. style.css 只有建立构建期合并器后才能物理拆分�?
禁止一次性重�?8046 核心，也禁止提高架构行数预算来掩盖膨胀�?
## 16. 下一�?AI 的首轮检�?
1. 读取正式源码 AGENTS.md�?2. 完整读取 AI_PROJECT_GUIDE.md、MAINTENANCE_GUIDE.md、PHASE2_PHASE3_ARCHITECTURE.md、LONG_CONTEXT_COMPACTION.md �?CURRENT_HANDOFF.md�?3. 确认版本�?4. 检�?8046�?5. 检�?pending、状态文件和当前 app.asar 哈希�?6. 确认 codexConfig.js 是“目录先发布、config.toml 最后发布”�?7. 检查正式源码和备份差异，但不自动覆盖�?8. 把现�?Git 改动视为用户资产�?9. 修改前在桌面 .codex-stage 暂存�?10. 不读取或输出明文密钥�?
## 17. 可复制给新对话的提示

~~~text
请先完整阅读�?C:\Users\niu\.gemini\antigravity\scratch\agy-hub\docs\CURRENT_HANDOFF.md

正式源码唯一基准�?C:\Users\niu\.gemini\antigravity\scratch\agy-hub

桌面目录只是稳定备份�?C:\Users\niu\Desktop\Antigravity-Chinese-v1.1.3\.codex-work\agy-hub

不要关闭正在运行�?AGY Hub，因�?Codex 通过 127.0.0.1:8046 使用它�?不要直接覆盖 D:\ang\agy-hub\resources\app.asar�?当前运行 ASAR 已包�?Codex 模型目录发布竞态修复，但仍报告 1.1.9�?.2.0 源码与安装包用于同步正式版本号和 GitHub 自动更新基线�?~~~

## 18. 交接结论

当前正式源码�?GitHub Release 构建产物已升级为 1.2.0，并通过 157 项全量测试；D 盘运�?ASAR 已包含竞态修复，但仍报告 1.1.9，需执行 1.2.0 安装包同步正式版本号�?026-07-26 21:25 的“所有对话无法加载”是 Codex 模型目录发布顺序竞态，不是普通上游网络波动，该修复已经包含在当前运行 ASAR �?1.2.0 安装包中�?
下一�?AI 最重要的纪律：�?Gemini 根目录为唯一源码、保护正在运行的 8046、保持三种反代隔离、测试只读、发布走 pending、绝不以�?Git HEAD 覆盖当前文件系统�?