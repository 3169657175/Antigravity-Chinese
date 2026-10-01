# AGY Hub 维护与结构说�?

> 适用版本�?.2.1 源码结构�?026-07-30�? 
> 正式源码：`C:\Users\niu\.gemini\antigravity\scratch\agy-hub`  
> 原则：只修改正式源码；除非明确发布，不构建安装包、不覆盖运行目录、不注入 Antigravity�?

## 1. 系统总体结构

AGY Hub �?Electron 模块化单体，分为四层�?

1. **渲染�?*：`index.html`、`renderer.js` 和各页面 Controller，负责界面与用户操作�?
2. **安全�?*：`preload.js`，只公开白名�?IPC 方法�?
3. **主进程编排层**：`main.js` 和各 IPC 模块，负责文件、注册表、OAuth、更新、客户端生命周期�?
4. **本地网关�?*：`codexGateway.js` 及协议适配器，�?`127.0.0.1:8046` 提供 Responses �?Anthropic Messages�?

调用链固定为�?

`页面按钮 �?Controller �?window.agyHubAPI �?preload.js �?IPC 模块 �?业务模块/文件/网关`

不要从渲染层直接访问 Node.js、文件系统、注册表�?Token�?

## 2. 顶层文件职责

| 文件 | 单一职责 | 修改时通常联动 |
|---|---|---|
| `main.js` | Electron 生命周期、窗口、托盘，以及尚未迁移�?MCP/Skill/补丁/社区 IPC 编排 | `preload.js`、对�?IPC 模块、运行依赖测�?|
| `preload.js` | 暴露 `window.agyHubAPI` 白名�?| 对应 IPC 注册模块、Controller |
| `index.html` | 页面结构、DOM ID、Controller 加载顺序 | Controller、CSS、UI smoke |
| `renderer.js` | 全局导航和尚未迁移的页面控制�?| 页面 Controller、`index.html` |
| `patchController.js` | 汉化补丁页路径、版本、注入与两类恢复操作 | `patchBackupManager.js`、`main.js`、`preload.js`、`index.html` |
| `style.css` | Electron 直接加载的完整运行时 CSS | `styles/*.css`、`tokenDashboardLayout.test.js`；禁止退化为仅含 `@import` 的清�?|
| `gatewayIpc.js` | Codex、Claude、自定义 Provider、三级测试与诊断 IPC | `preload.js`、`gatewayController.js`、网关模�?|
| `accountIpc.js` | 本地账号、额度、Google OAuth、账号切�?| `preload.js`、`localAccountsController.js`、`accountUi.js` |
| `updaterService.js` | electron-updater 事件、检查、下载、安�?| `appShellController.js`、`updateUtils.js` |
| `gatewayController.js` | 反代接入四个二级页及 Token 来源切换 | `gatewayIpc.js`、`gatewayUi.js`、`styles/gateway.css` |
| `localAccountsController.js` | 本地账号卡片、额度显示、重新授权入�?| `accountIpc.js`、`accountUi.js`、`accountUi.css` |
| `appShellController.js` | 更新弹窗、窗口最大化、明暗主�?| `updaterService.js`、`styles/theme-modes.css` |

## 3. 反代与协议模�?

| 文件 | 作用 | 不应承担的职�?|
|---|---|---|
| `codexGateway.js` | 8046 服务生命周期、路由选择、请求编排、重试、SSE 转发 | UI、Electron IPC、客户端配置写入 |
| `gatewayProfiles.js` | 三个隔离 Profile �?schema、迁移和读写 | 发请求、改客户端配�?|
| `gatewayHttp.js` | 压缩请求正文解码、JSON 读取、请求元数据 | 模型路由与账号选择 |
| `responsesRequestAdapter.js` | OpenAI Responses �?Cloud Code 请求、工�?Schema 清洗 | HTTP 监听、持久化 |
| `anthropicGateway.js` | Anthropic Messages/工具/流式事件转换 | Claude Desktop 注册表写�?|
| `gatewayTestRunner.js` | Codex、Claude、自定义 Provider 三级测试 | 持久化当前路�?|
| `gatewayDiagnostics.js` | 一键诊断和脱敏 | 输出 Token、API Key、对话正�?|
| `codexModels.js` | Codex 模型目录、别名和上下文窗�?| Claude 客户端伪装目�?|
| `claudeModelRoutes.js` | Claude 可见别名与真实模型双向映�?| 账号与端口配�?|

三个 Profile 必须始终独立�?

- `codex-antigravity`
- `codex-custom`
- `claude-antigravity`

测试只能读取草稿并发送临时请求；只有“接入”允许持久化和切换路由�?

## 4. 客户端配置与生命周期

| 功能 | 配置文件 | 生命周期文件 | 测试 |
|---|---|---|---|
| Codex 接入 | `codexConfig.js` | `codexAppLifecycle.js` | `codexAppLifecycle.test.js`、`codexGateway.test.js` |
| Claude Code/Desktop 接入 | `claudeDesktopConfig.js` | `claudeDesktopLifecycle.js` | 对应两个 test 文件 |
| 自定�?Provider | `codexProviderProfiles.js` | 通过 Codex 生命周期启动 | `codexGateway.test.js`、`routeIsolation.test.js` |

修改“接入”时必须同时检查：备份、真实落盘位置、恢复、客户端重启、状态回读。不能只相信 UI 显示成功�?

## 5. 功能到文件映�?

### 本地账号与额�?

- 主进程读取与 OAuth：`accountIpc.js`
- 错误分类：`accountErrorClassifier.js`
- 卡片与额度控制：`localAccountsController.js`
- 错误提示组件：`accountUi.js`、`accountUi.css`
- IPC 白名单：`preload.js`

### 反代接入

- 页面结构：`index.html`
- 页面行为：`gatewayController.js`
- IPC：`gatewayIpc.js`
- 本地服务：`codexGateway.js`
- Profile：`gatewayProfiles.js`
- 测试：`gatewayTestRunner.js`
- 诊断：`gatewayDiagnostics.js`
- 页面结果格式：`gatewayUi.js`、`gatewayUi.css`

### Token 统计

- 数据记录：`tokenUsage.js`、`proxy.js`、`brainMonitor.js`
- 网关写入来源：`main.js` 创建 `CodexGateway` 时的 `onUsage`
- 页面：`tokenMonitorController.js` �?`gatewayController.js` 中来源分�?- 分页：本地日志使�?`window.pageSize = 20`，反代调用记录使�?`USAGE_PAGE_SIZE = 20`
- 样式职责：`styles/gateway.css`；Electron 运行时实际加载根 `style.css`

### 主题皮肤

- 主题文件和配置：`themeIpc.js`
- 页面控制：`themeController.js`
- 样式：`styles/base.css` �?`styles/theme-modes.css`
- 图片：`assets/themes`

### 汉化补丁备份

- 状态机和文件操作：`patchBackupManager.js`
- IPC 编排：`main.js` �?`install-patch`、`restore-previous-patch`、`restore-original`
- UI：`index.html` �?`patchController.js`；`renderer.js` 仅调�?`AgyPatchController.init()`
- 固定文件：`app.asar.original`、`app.asar.previous`，以及对�?`.unpacked.original`、`.unpacked.previous`
- `app.asar.original` 只能来自确认未汉化且版本匹配的官方包；缺少可信原版时必须停止注入，不能把当前汉化版误存为原版�?- 每次再次注入只覆�?`.previous`，禁止恢复时间戳备份历史机制�?- 修改后运�?`patchBackupManager.test.js` �?`patchBackupUi.test.js`，并验证安装失败临时快照不会残留�?
### MCP �?Skill

- MCP 安全配置：`mcpLaunchConfig.js`
- MCP/Skill IPC：当前仍�?`main.js`
- 页面：当前仍�?`renderer.js`
- live 测试：`mcpLaunchConfig.live.test.js`

### 一键汉化补�?

- AGY Hub 安装编排：`main.js` 补丁�?- 构建规则：`patch-workbench`
- 发布源包：`assets/app.asar`、`assets/patch-manifest.json`
- 兼容增量：`patch-workbench/legacy-payload.asar` �?`runtime-rules.json`
- 发布前必须执行：`patch:rebuild`、`patch:verify`、`npm test`

### 更新系统

- 主进程：`updaterService.js`
- Release 文本处理：`updateUtils.js`
- 页面：`appShellController.js`
- 弹窗结构：`index.html`

## 6. 常见修改应该改哪�?

### 新增或修改一�?IPC

1. 在所�?IPC 模块注册 handler；不要默认塞�?`main.js`�?
2. �?`preload.js` 暴露最小方法�?
3. 在对�?Controller 调用�?
4. 添加契约测试，确�?handler、preload、Controller 名称一致�?
5. 运行 `runtimeDeps.test.js` 和对应业务测试�?

### 修改模型列表

- Codex 显示与真实模型：先改 `codexModels.js`�?
- Claude 显示别名：改 `claudeModelRoutes.js`�?
- 如果上游内部 ID 变化，再检�?`codexGateway.js`�?
- 同步更新模型路由测试，不要在 UI 下拉框硬编码第二份列表�?

### 修改反代测试

- 测试步骤�?`gatewayTestRunner.js`�?
- IPC 返回�?`gatewayIpc.js`�?
- UI 文本�?`gatewayUi.js` �?`gatewayController.js`�?
- 必须运行 `routeIsolation.test.js`，保证测试没有改变活动路由�?

### 修改账号异常提示

- 识别错误类型：`accountErrorClassifier.js`�?
- UI 组件：`accountUi.js`�?
- 卡片触发行为：`localAccountsController.js`�?
- Google OAuth 逻辑：`accountIpc.js`�?

### 修改页面布局

- DOM 结构：`index.html`�?- 事件行为：对�?Controller�?- 样式职责：对�?`styles/*.css`；交付时必须同步完整�?`style.css`�?- 不得把根 `style.css` 改成嵌套本地 `@import` 清单；该方式曾导致样式模块未进入 Electron 实际计算样式�?- 重要布局需要检查打包后�?`app.asar`，必要时用浏览器读取 `getComputedStyle` 和元素坐标�?- 修改 DOM ID 前全仓搜索，并运行三�?UI smoke�?
## 7. 文件互相影响矩阵

| 修改文件 | 高概率影�?|
|---|---|
| `preload.js` | 所�?Controller、IPC 名称、打包启�?|
| `index.html` | Controller DOM 查询、CSS、导�?smoke |
| `gatewayProfiles.js` | Codex、Claude、自定义 Provider、诊断、迁�?|
| `codexGateway.js` | 长对话、工具调用、压缩、三个反代入口、Token 日志 |
| `codexModels.js` | Codex 列表、三级测试、上游路�?|
| `claudeModelRoutes.js` | Claude 模型列表、模型伪装和真实模型解析 |
| `accountIpc.js` | 本地账号、额度、OAuth、切换账号、反代账号下拉框 |
| `themeIpc.js` | 主题文件、预览图、壁纸和主题配置；必须自行引�?Node `crypto` |
| `tokenMonitorController.js` | 本地 Token 看板、筛选和每页 20 条分�?|
| `style.css` | 所�?Electron 页面实际样式；缺失会同时影响看板、主题和页面布局 |
| `patchBackupManager.js` | 一键注入、上一版汉化、官方英文原版、旧备份迁移和根目录清理 |
| `patchController.js` | 补丁页三按钮状态、路径检测和恢复结果反馈；脚本加载顺序必须早�?`renderer.js` |
| `styles/theme-modes.css` | 全应用亮色主题以及后加载覆盖规则 |

## 8. 测试与验收门�?
最小验证：

`node --check <所有改动的 JS>`

`npm.cmd test`

涉及页面时继续运行：

- `electron.cmd smoke-codex-ui.js`
- `electron.cmd smoke-navigation-performance.js`
- `electron.cmd smoke-light-ui.js`

涉及真实接入时，只有用户明确授权后才能检查真�?Codex/Claude 配置。测试按钮本身不能写配置�?

涉及发布时才运行 `npm run dist:sync`。构建或同步不是普通源码修改的默认步骤�?

## 9. 不可破坏的边�?

- 不关闭正在运行的 AGY Hub�?
- 不把 8046 监听改成 `0.0.0.0`�?
- 不让测试按钮持久化账号、模型或 Provider�?
- 不输�?refresh token、access token、API Key 或对话正文�?
- 不直接修改备份目录或 D 盘运行目录�?
- 不因为拆文件改变现有 DOM、样式加载顺序、IPC 名称和配置格式�?
- 不通过提高 `architectureBoundaries.test.js` 行数预算来掩盖文件再次膨胀�?

## 10. 后续继续拆分建议

当前仍值得继续拆出的域�?

1. `main.js`：MCP/Skill IPC、一键补�?IPC、社区服�?IPC�?
2. `renderer.js`：MCP Controller、Skill Controller、社�?管理�?Controller�?
3. 每次只拆一个业务域，保持原函数正文不变，先移动再优化�?
4. 每完成一个域都降低架构行数预算，防止代码重新回流到巨型入口文件�?
