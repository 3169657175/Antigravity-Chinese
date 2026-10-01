# AGY Hub 项目接手说明（供新对�?AI / 开发者使用）

> 最后核对：2026-07-26  
> 当前应用版本�?.2.1  
> 项目名称：AGY Hub 桌面管家（仓库名 `any-sub`�? 
> 技术形态：Windows Electron 桌面应用 + 本地 HTTP 网关 + Antigravity 补丁工作�?

## 1. 这份文档解决什么问�?

本项目经历过多轮由不�?AI 进行的连续修改，曾出现过以下典型问题�?

- 修改了错误的副本，界面看似改好，但实际运行程序没有变化�?
- 测试某个模型时意外改变了当前网关模式，导致另一个接入方式中断�?
- 为修复主题或汉化而改动运行时代码，造成已经正常的功能再次损坏�?
- 直接关闭正在运行的小助手，导致用户正在使用的 Codex 连接返回 401�?
- 只验证按钮提示“成功”，没有验证 Codex / Claude Desktop 的真实端到端调用�?

因此，接手本项目时不要立即改代码。先确认源码位置、运行位置、目标功能所属模块和验证边界�?

## 2. 当前环境中的目录关系

在当前机器上，常见目录有三套，作用不同：

| 目录 | 作用 | 是否应直接修�?|
|---|---|---|
| `C:\Users\niu\.gemini\antigravity\scratch\agy-hub` | **核心源码仓库，也是后续修改的唯一基准** | **是，默认修改这里** |
| `C:\Users\niu\Desktop\Antigravity-Chinese-v1.1.3\.codex-work\agy-hub` | Codex 曾使用的临时工作副本 | 不能作为最终交付目录；仅可用于受限环境下暂存变�?|
| `D:\ang\agy-hub` | 已构建应用的实际部署/运行目录 | 不直接手改源码；通过构建产物同步 |
| `...\agy-hub\dist` | GitHub Release �?Windows 安装产物 | 仅发�?打包任务更新 |
| 工作区顶�?`patch-*.js`、`fix-*.js` | 历史临时修复脚本 | 不是真正源码，不应继续叠加修�?|

开始工作时至少执行一次：

```powershell
Get-Location
Get-Content -Raw .\AGENTS.md
Get-Content -Raw .\AI_PROJECT_GUIDE.md
Get-Content -Raw .\package.json
```

如果当前目录不是上述核心源码目录，先进入核心目录再操作。受沙盒限制必须在工作副本暂存时，完成后也必须明确同步回核心仓库并比较关键文件哈希�?

## 3. 产品定位和核心业�?

AGY Hub 是面�?Antigravity、Codex Desktop �?Claude Desktop/Claude Code 用户�?Windows 本地桌面管家。它不是单一反代工具，而是把下列能力集中在一�?GUI 中：

1. **Antigravity 汉化补丁**：检测安装路径、备份原�?`app.asar`、注入并验证汉化补丁、恢复原版�?
2. **本地账号与额�?*：读�?`~/.gemini/antigravity/tools` 中的本地账号，查�?Gemini/Claude 额度并支持切换账号�?
3. **Codex 接入**：在本机 `127.0.0.1:8046` 提供 OpenAI Responses 兼容接口，写�?`~/.codex` 配置并启动或重启 Codex�?
4. **Claude Desktop 接入**：在同一网关提供 Anthropic Messages 兼容接口，写�?Claude Desktop �?3P 配置�?Windows 托管策略�?
5. **自定�?Responses Provider**：保存第三方 Provider，测试其 `/responses`，并通过本地网关接入 Codex�?
6. **模型映射**：将 Antigravity 中真实的 Gemini、Claude、GPT-OSS 模型映射�?Codex �?Claude 客户端允许显示的模型 ID�?
7. **Token 统计**：记�?Codex �?Claude Code 反代用量，同时监�?Antigravity 本地会话与代理流量�?
8. **主题皮肤**：管理内置壁纸、自定义壁纸、主题色�?Antigravity 运行时主题配置�?
9. **MCP �?Skill**：配置、安装、验�?MCP，浏�?安装社区 Skill，并提供自定�?Skill 生成器�?
10. **社区与更�?*：反馈看板、用�?公告管理，以�?GitHub Release 自动更新�?

用户明确要求保留的关键能力包括：一键注入、额度显示、多账号切换、Token 统计、主题皮肤、Codex/Claude Code 反代和自定义 Provider。重构时不能以“简化”为理由删除这些能力�?

## 4. 总体架构

```mermaid
flowchart LR
    UI["index.html + renderer.js + style.css"]
    PRELOAD["preload.js\n安全 IPC �?]
    MAIN["main.js\nElectron 主进�?/ IPC 编排"]
    GW["codexGateway.js\n127.0.0.1:8046"]
    AGY["Antigravity Cloud Code"]
    CODEX["Codex Desktop\nOpenAI Responses"]
    CLAUDE["Claude Desktop / Claude Code\nAnthropic Messages"]
    PATCH["patch-workbench + assets/app.asar"]
    DATA["用户配置 / 账号 / Token 统计"]

    UI --> PRELOAD --> MAIN
    MAIN --> GW --> AGY
    CODEX -->|"/v1/responses"| GW
    CLAUDE -->|"/v1/messages"| GW
    MAIN --> PATCH
    MAIN --> DATA
```

这是一�?Electron 模块化单体。渲染进程不能直接访�?Node.js；所有系统操作必须经�?`preload.js` 暴露的有�?API，再�?`main.js` �?IPC handler 执行�?

## 5. 正式源码模块地图

### 5.1 Electron 外壳与前�?

| 文件 | 当前职责 | 修改提示 |
|---|---|---|
| `main.js` | 窗口、托盘及尚未拆出的主进程 IPC 编排 | 新功能优先注册独立模块；MCP 进程探测已经迁移�?`mcpProbe.js` |
| `preload.js` | 通过 `window.agyHubAPI` 暴露 IPC API | 新增 IPC 时必须同步核对主进程 handler、preload �?renderer 三端命名 |
| `index.html` | 全部主页面、二级页面、对话框和静态表�?| 删除或改 ID 前先搜索 `renderer.js` �?UI smoke test |
| `renderer.js` | 全局状态、导航、页面初始化入口和尚未迁移的 UI 交互 | 只负责编排已拆出�?Controller；不要把补丁页等独立页面逻辑重新塞回此文�?|
| `patchController.js` | 汉化补丁页的路径检测、版本显示、注入、退回上一版和还原英文原版 | 必须�?`preload.js` 的三组补�?API、`patchBackupManager.js` 的状态语义保持一�?|
| `style.css` | Electron 页面直接加载的完整运行时样式�?| 禁止改回仅含 `@import` 的清单；修改 `styles/*.css` 后必须同步运行时样式并验证打包后的计算样�?|

### 5.2 本地反代和模型协�?

| 文件 | 当前职责 | 关键接口 |
|---|---|---|
| `codexGateway.js` | 本地 8046 网关、鉴权、OpenAI Responses 转换、Anthropic Messages 路由、长对话压缩保护、SSE 转发、重试、诊断日�?| `/health`、`/v1/models`、`/v1/responses`、`/v1/messages`、`/v1/messages/count_tokens` |
| `anthropicGateway.js` | Anthropic �?Responses 内容、工具调用、流式事件之间的转换 | Claude 工具调用兼容的核�?|
| `codexModels.js` | Antigravity 模型清单、Codex 可见别名、上下文窗口和模型目�?| 修改模型时先同步测试模型别名 |
| `claudeModelRoutes.js` | Claude 客户端可见路由名与真�?Antigravity 模型的双向映�?| Claude 模型列表的单一事实来源 |
| `codexProviderProfiles.js` | 自定�?Responses Provider 的保存、读取和删除 | 当前会持久化 API Key，属于敏感配�?|
| `tokenUsage.js` | 用量记录、聚合与分页相关数据逻辑 | Codex/Claude Code 数据源必须分开标记 |

网关默认只监�?`127.0.0.1`，不是局域网或公网服务。不要为了让别人使用而直接改�?`0.0.0.0`；这会暴露本�?API Key、账号额度和模型调用能力。远程使用必须另做鉴权、TLS、访问控制和限流设计�?

### 5.3 客户端配置和生命周期

| 文件 | 当前职责 | 写入位置 |
|---|---|---|
| `codexConfig.js` | 备份、写入、恢�?Codex Provider、API Key 和模型目�?| `~/.codex/config.toml`、`auth.json`、模�?catalog |
| `codexAppLifecycle.js` | 查找并启�?重启 Codex Desktop | Windows AppX / 开始菜单应�?|
| `claudeDesktopConfig.js` | 写入 Claude Desktop 3P profile、配置库、HKCU 托管策略；备份和恢复 | `%LOCALAPPDATA%\Claude`、`Claude-3p`、`HKCU\SOFTWARE\Policies\Claude` |
| `claudeDesktopLifecycle.js` | 查找并启�?重启 Claude Desktop | Windows 安装目录与快捷方�?|

接入按钮和测试按钮的语义必须严格分开�?

- **测试**：只发临时探测请求，不能持久化模式、账号、模型或 Provider�?
- **启动服务**：只确保本地端口监听，不应暗中切�?Provider�?
- **接入**：允许写客户端配置、建立备份，并按用户预期启动/重启对应客户端�?
- **恢复**：必须恢复第一次接入前的配置，而不是恢复到最近一次已经被 AGY Hub 改过的状态�?

### 5.4 Token、账号、MCP �?Skill

| 文件 | 当前职责 |
|---|---|
| `proxy.js` | Antigravity API 代理�?Token 日志统计 |
| `brainMonitor.js` | 监听本地会话/日志，提供无需重启 Antigravity 的估算数�?|
| `mcpLaunchConfig.js` | 构造和校验 MCP 启动配置 |
| `mcpProbe.js` | MCP 配置快速校验、进程启动、initialize 握手、超时和子进程清�?|
| `marketplaceController.js` | MCP/Skill 市场数据、分类、分页、响应式布局及按需深度验证 |
| `main.js` / `renderer.js` | 只负责注�?MCP IPC 与导航编排，不应重新吸收市场业务逻辑 |

本地账号目录�?`~/.gemini/antigravity/tools`。账�?refresh token �?Antigravity 使用系统安全存储加密；读取时只允许在 Electron 主进程内解密，不得传到渲染进程、日志、反馈接口或云端�?

### 5.5 汉化补丁和主�?

| 位置 | 作用 |
|---|---|
| `assets/app.asar` | 随安装包发布的一键注入补丁源�?|
| `assets/patch-manifest.json` | 补丁版本和哈希元数据 |
| `patch-workbench/legacy-payload.asar` | 基于当前官方版本生成补丁时使用的 AGY 增量载荷 |
| `patch-workbench/runtime-rules.json` | 带命中次数校验的版本适配规则 |
| `patch-workbench/` | 官方底包兼容合并、构建、语法检查和运行时验�?|
| `AGENTS.md` | 主题资源�?ASAR 发布安全边界 |

主题运行数据位于 `%APPDATA%\Antigravity` 下的�?

- `agy-themes\`
- `agy-themes\custom\`
- `agy-theme.json`
- `agy-theme-library.json`

只修改壁纸时必须遵守 `AGENTS.md`：不能碰 Antigravity �?`main.js`、`preload.js`、`ipcHandlers.js`、`accountVault.js`，也不能顺手重打 ASAR�?

## 6. 关键请求流程

### 6.1 Codex 使用 Antigravity

1. 用户�?AGY Hub 选择本地账号和真实模型�?
2. `main.js` 启动 `CodexGateway`，默认地址�?`http://127.0.0.1:8046/v1`�?
3. `codexConfig.js` 备份并写�?`~/.codex`，模型目录使�?Codex 允许展示的别名�?
4. Codex 调用 `/v1/responses`�?
5. `codexGateway.js` 修复长对话历�?ID、工具历史和压缩请求，转换为 Antigravity Cloud Code 请求�?
6. SSE 事件被转换回 Responses 格式，并记录 `codex-gateway` 来源的用量�?

### 6.2 Claude Desktop/Claude Code 使用 Antigravity

1. 用户选择账号和真实模型�?
2. Claude 客户端看到的�?`claudeModelRoutes.js` 中伪装后�?Claude 模型 ID�?
3. `claudeDesktopConfig.js` 写入 3P profile 和当前用户的托管策略�?
4. Claude 调用 `http://127.0.0.1:8046/v1/messages`�?
5. 网关�?Anthropic 消息和工�?schema 转成 Responses/Cloud Code 请求，再转回 Anthropic 事件�?
6. 用量�?`claude-code-gateway` 来源单独记录�?

### 6.3 自定�?Provider

1. “测�?Provider”直接调用对方的 `/responses`，不经过当前活动路由，也不能改变活动配置�?
2. “接�?Provider”才允许把网关切换为 `custom` 模式，并更新 Codex 配置�?
3. 自定�?Provider 当前只支�?OpenAI Responses 协议，不等于 Chat Completions �?Anthropic 协议�?

## 7. 运行时配置和敏感数据

`app.getPath('userData')` 下会产生或维护以下数据（实际根目录由 Electron 在运行时决定）：

- `codex-gateway.json`：端口、当前模式、账号、模型、本�?Key、自定义 Provider 配置�?
- `codex-gateway.log`：网关诊断日志，超过�?5 MB 会轮转�?
- `codex-tool-calls.json`：工具调用关联缓存�?
- `codex-provider-profiles.json`：已保存的自定义 Provider�?
- `codex-connection.json`、`codex-backups\`：Codex 接入备份状态�?
- `claude-desktop-connection.json`、`claude-desktop-backups\`：Claude 接入备份状态�?
- `token_stats.json`：Token 统计�?
- `network_config.json`：局部代理设置�?
- `auth_config.json`：AGY Hub 云端登录会话�?

这些文件可能包含 API Key 或登录信息。排查问题时可以报告字段是否存在、配置模式和脱敏后的 URL，但不要把完�?Key、refresh token 或完整用户凭据输出到对话中�?

## 8. 按功能定位修改文�?

| 用户需�?| 优先检�?| 常见联动 | 必跑验证 |
|---|---|---|---|
| Codex 502、长对话、流式中�?| `codexGateway.js` | `codexModels.js`、`codexConfig.js` | `codexGateway.test.js`、端到端 smoke |
| Claude 模型不可用、工具报�?| `anthropicGateway.js`、`claudeModelRoutes.js` | `codexGateway.js`、`claudeDesktopConfig.js` | Anthropic、模型路由、Claude 配置测试 |
| 测试按钮影响其他接入 | `main.js` 对应 IPC、`CodexGateway.probeUpstream` | `renderer.js` 状态刷�?| `routeIsolation.test.js` |
| 8046 写入不生�?| `claudeDesktopConfig.js` �?`codexConfig.js` | 对应 lifecycle 文件 | 配置单测 + 读取真实落盘状�?|
| 页面消失、点击卡顿、大片空�?| `index.html`、`renderer.js`、`style.css` | 导航性能 smoke test | `navigationPerformance.test.js` + UI smoke |
| Token 数字或分�?| `tokenUsage.js`、`proxy.js`、`renderer.js` | `index.html`、`style.css` | `tokenUsage.test.js` |
| 本地账号与额�?| `main.js` 账号/配额 IPC | `renderer.js` | 使用脱敏账号做只读验�?|
| MCP 安装/检�?| `mcpLaunchConfig.js`、`mcpProbe.js` | `marketplaceController.js`、`main.js` | 默认只做配置快检；真实进程握手必须由“深度验证”显式触�?|
| 主题/自定义壁�?| `main.js` 主题函数、`renderer.js`、主题资�?| `style.css` | 主题列表、预览、持久化、重开应用 |
| 汉化不完�?| `patch-workbench/injections` 和规�?| `assets/app.asar` | `patch:rebuild` + `patch:verify` + smoke |
| 应用 Logo | `assets/logo-*`、`icon.ico`、`package.json` | 安装包、快捷方式缓�?| 重打包并检�?EXE/安装�?快捷方式 |
| 自动更新 | `main.js` updater、`updateUtils.js` | `renderer.js` 更新看板 | updater 单测�?smoke |

## 9. 开发、测试和发布

### 9.1 安装与本地启�?

```powershell
npm install
.\node_modules\.bin\electron.cmd .
```

当前 `package.json` 没有 `start` 脚本，所以不要照�?README 使用 `npm start`，除非先补上脚本�?

### 9.2 全量单元/契约测试

```powershell
$tests = Get-ChildItem -File *.test.js | Select-Object -ExpandProperty FullName
node --test $tests
```

`mcpLaunchConfig.live.test.js` 依赖本机真实 MCP 环境，设计上可以跳过。不要把“跳�?live 测试”误判为普通单测失败�?

### 9.3 补丁构建门禁

```powershell
npm run patch:rebuild
npm run patch:verify
npm test
```

只有用户明确要求重建/发布汉化补丁时才执行。验证必须覆�?`dist/main.js`、`dist/preload.js`、`dist/ipcHandlers.js`、`dist/accountVault.js`，并保留稳定基线�?

### 9.4 Windows 安装包和运行目录同步

```powershell
npm run dist:sync
```

这个命令会先使用 `electron-builder` 构建，再运行 `sync-d.js` 同步�?`D:\ang\agy-hub`。`sync-d.js` 已设计为：当正在运行�?EXE 无法替换时，将新版暂存为 `.next`，不应通过强杀 AGY Hub 来完成替换�?

GitHub Release 的核心三个文件是�?

- `agy-hub-setup-<version>.exe`
- `agy-hub-setup-<version>.exe.blockmap`
- `latest.yml`

## 10. 验收原则

### 10.1 不能只相�?UI 的“成功�?

“测试成功”至少要证明�?

- 请求到达预期端点�?
- 使用了用户选择的账号和模型�?
- 上游返回了可识别内容或用量元数据�?
- 测试前后的活动网关配置指纹一致�?

“接入成功”还要证明：

- 客户端配置真实落盘到目标目录/注册表�?
- 备份状态存在且可恢复�?
- 客户端重启后读取的是新配置�?
- �?Codex �?Claude 客户端发起真实请求能够完成�?

### 10.2 每次改动后的最小验�?

1. 对改过的 JavaScript 执行 `node --check`�?
2. 运行对应模块单测�?
3. 涉及网关时运�?`routeIsolation.test.js`�?
4. 涉及页面时运行导�?UI smoke test�?
5. 涉及安装包时检查版本、文件时间、SHA-256 和三个发布文件�?
6. 涉及真实配置写入时，验证后恢复测试环境，不能留下污染�?

## 11. 不可破坏的工作规�?

1. **不要关闭正在运行�?AGY Hub�?* 用户可能正通过它使�?Codex，关闭会造成 401 和当前对话中断�?
2. **不要自动注入或重�?Antigravity�?* 除非用户明确要求执行注入�?
3. **不要把测试变成接入�?* 测试必须只读、临时、可重复�?
4. **不要混用路由状态�?* Codex、Claude、自定义 Provider 的账号、模型、模式和 fallback 应分别考虑�?
5. **不要覆盖用户已有配置而不备份�?* Codex、Claude、主题和 ASAR 都必须具备恢复路径�?
6. **不要修改错误副本�?* 修改后报告准确的源码路径、构建路径和部署路径�?
7. **不要伪造验证�?* 没有启动真实客户端时，只能说单测/协议层通过，不能宣称端到端成功�?
8. **不要顺手大改已有 UI�?* 用户多次明确要求保留已经认可的布局和关键功能�?
9. **不要输出凭据�?* API Key、refresh token 和云端登录信息必须脱敏�?
10. **不要用临时脚本长期打补丁�?* 稳定逻辑应进入正式模块，并配套测试�?

## 12. 当前已知技术债入�?

更完整的评估�?[`PROJECT_REVIEW_2026-07-26.md`](./PROJECT_REVIEW_2026-07-26.md)。新任务开始前尤其关注�?

- `main.js`、`renderer.js`、`codexGateway.js` 仍是高风险热点；`style.css` 虽然较大，但它是 Electron 必需的完整运行时产物，不应再机械拆成嵌套 `@import`�?- 网关仍以单实例配置保�?Codex、自定义 Provider �?Claude 的部分状态，隔离不够彻底�?
- 自定�?Provider Key 和本地网�?Key 以明文形式存在配置文件或客户端配置中�?
- README 的启动命令与 `package.json` 不一致；仓库缺少统一 `test` 脚本、CI、CHANGELOG、LICENSE 文件和正�?docs 目录�?
- 对外�?Cloud Code 内部接口和模�?ID 依赖较强，需要能力探测、契约样本和更明确的降级策略�?

## 13. 新对�?AI 的推荐开场检查清�?

```text
1. 我现在位于哪个目录？这是不是 C:\Users\niu\.gemini\antigravity\scratch\agy-hub 核心源码�?
2. 用户是在要求分析、修复、构建、同步还是注入？授权范围到哪里？
3. 这个功能对应哪些正式模块？是否触�?AGENTS.md 的安全边界？
4. 当前运行中的 AGY Hub 能否保持不关闭？
5. 测试是否会写�?~/.codex、Claude 配置、注册表�?app.asar�?
6. 我将用哪些单测、协议测试和真实落盘检查证明完成？
7. 最终需要同步到 Gemini 副本、D 盘部署目录或 dist 吗？用户是否明确要求�?
```

遵循这份清单，可以显著减少“改错目录、表面成功、破坏现有路由、关闭自身连接、补丁反复好坏”的问题�?


## 14. 模块化维护边界（2026-07-26�?

为防止四个巨型文件继续膨胀，新增以下强制边界：

- `main.js` 只负�?Electron 生命周期与跨域编排；反代 IPC 放在 `gatewayIpc.js`，更新器放在 `updaterService.js`�?
- `renderer.js` 只保留全局导航和尚未迁移的页面；反代页面控制器放在 `gatewayController.js`，窗�?更新/明暗模式放在 `appShellController.js`�?
- `codexGateway.js` 保留网关生命周期和路由编排；HTTP 正文处理放在 `gatewayHttp.js`，Responses 请求转换放在 `responsesRequestAdapter.js`�?
- `styles/base.css`、`styles/gateway.css`、`styles/theme-modes.css`、`styles/claude-access.css` 用于表达样式职责边界；Electron 实际直接加载完整 `style.css`。当前没有可靠的自动 CSS bundler，任何模块样式修改都必须同步到根 `style.css`，并禁止把根文件改成嵌套本地 `@import` 清单�?- 新增功能不得直接突破 `architectureBoundaries.test.js` 的行数预算；需要扩展时应新增职责明确的模块，而不是提高预算�?
- UI 模块必须�?`index.html` 中先�?`renderer.js` 加载，并同时加入 `runtimeDeps.test.js` 的打包依赖检查�?


## 15. 详细维护手册

修改功能前先查阅 `docs/MAINTENANCE_GUIDE.md`。架构决策记录位�?`docs/ADR-001-modular-monolith.md`�?
自定�?Provider 多协议、鉴权、模型发现、安全存储、健康检查、备用地址、配置快照和请求时间线的边界�?`docs/PROVIDER_2_0.md`�?

## 16. 主题�?Token 页面边界

- 主题文件、壁纸和主题配置 IPC 已迁移到 `themeIpc.js`�?- 主题列表、编辑器和预览控制已迁移�?`themeController.js`�?- Token 监控主页面已迁移�?`tokenMonitorController.js`；反代来源分页仍�?`gatewayController.js` 管理�?- 本地 Token 日志与反�?Token 调用记录均固定每�?20 条；修改分页时必须同时检�?`window.pageSize` �?`USAGE_PAGE_SIZE`�?
## 17. 运行时作用域�?CSS 交付边界�?026-07-26�?
- `themeIpc.js` 必须自行显式引入 Node `crypto`，不能依�?`main.js` 的模块作用域�?- 社区登录、注册和反馈 handler 仍在 `main.js`，其 `API_BASE` �?`authFilePath` 必须位于这些 handler 可访问的模块作用域；不得移动�?`accountIpc.js` 的注册函数内部�?- `runtimeScope.test.js` 固化以上边界，避免文件拆分后再次出现皮肤、登录和反馈同时失效�?- Electron/ASAR 环境下，本地嵌套 CSS `@import` 没有作为可靠交付方式通过验证。`style.css` 必须包含实际规则，并�?`tokenDashboardLayout.test.js` 检�?Token 四卡片布局�?- 修改界面不能只检�?CSS 文本；涉及布局时至少核对浏览器计算样式或打包后 `app.asar` 中的实际运行文件�?
## 18. 汉化补丁备份状态机�?026-07-26�?
- `patchBackupManager.js` 是汉化注入备份的单一事实来源，`main.js` 只负责编排停止客户端、安装和重启�?- `patchController.js` 是补丁页面行为的单一入口，`renderer.js` 只调用其 `init()`；脚本必须在 `index.html` 中先�?`renderer.js` 加载�?- Antigravity `resources` 目录只长期保留三种状态：当前 `app.asar`、唯一官方原版 `app.asar.original`、唯一上一版汉�?`app.asar.previous`�?- 三种状态的 `app.asar.unpacked` 必须成对保存与恢复；原版�?unpacked 时，还原必须清除当前汉化 unpacked�?- 第一次从官方客户端注入时创建 `.original`，之后永不被同版本汉化覆盖；再次注入汉化时只覆盖 `.previous`�?- 客户端官方版本变化时，必须从新版本官方文件重新建立唯一原版，并清除旧版本的上一版汉化，禁止跨版本还原�?- �?`app.asar.backup_*`、`app.asar.unpacked.backup_*` �?`backups.json` 只用于一次迁移，成功注入后清理，不再无限增长�?- 三个按钮语义固定为“注入中文汉化补丁”“退回上一版汉化”“还原官方英文原版”，不得复用同一个还原目标�?- 修改此功能时至少联动检�?`patchBackupManager.js`、`main.js`、`preload.js`、`patchController.js`、`index.html`、`patchBackupManager.test.js` �?`patchBackupUi.test.js`�?
## 19. 第一阶段稳定性边界（2026-07-26�?
- `logTailReader.js` �?Antigravity `main.log` 尾读和短缓存的单一实现。Token 状态查询不得重新使�?`readFileSync` 读取完整日志�?- `tokenMonitorController.js` 只允许在“本地账�?�?Token 监控”页面真实可见时轮询；离开页面、窗口隐藏或文档不可见后必须清理两个定时器�?- `gatewayHttp.js` 使用异步 zlib 解压，默认限制为编码�?32MB、解压后 64MB。超限必须返�?413，压缩格式不支持返回 415，JSON 损坏返回 400，不能统一伪装�?502�?- `retryPolicy.js` 是生成请求自动重试的统一边界。只有响应头之前明确发生的连接建立失败可以自动重试；收到 HTTP 状态、响应头、首个字节或任何输出后不得透明重放�?- `patchWorker.js` 承担补丁校验、哈希、目录遍历、备份、复制和完整性检查。`main.js` 只负�?Worker 编排以及 Antigravity 生命周期�?- 注入取消只允许发生在最终写入前；Worker 发出 `commit-started` 后前端必须禁用取消按钮，避免留下半写入状态�?- 第一阶段专项 smoke �?`smoke-first-phase.js`，验�?Token 离页停止轮询、注入取消按钮显示和最终写入阶段禁用�?

## 20. 第二、三阶段结构入口�?026-07-26�?
第二、三阶段已完�?Skill 增量 AI 翻译、社区主进程数据边界、原子写与损坏文件保护、DOM/URL 安全、Marketplace Presenter/Layout、Navigation Controller、Gateway Config Store、CI、LICENSE 和打包白名单。后续修改前必须阅读 `docs/PHASE2_PHASE3_ARCHITECTURE.md`，不得把社区请求重新放回 Renderer，也不得绕过 `fsUtils.js` 直接覆盖关键 JSON�?