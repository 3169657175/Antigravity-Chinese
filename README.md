# AGY Hub 桌面管家

![Electron](https://img.shields.io/badge/Electron-31.x-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Release](https://img.shields.io/badge/AGY%20Hub-1.4.0-0A7D5A.svg)
![Antigravity](https://img.shields.io/badge/Antigravity-2.24.0-5B5BD6.svg)

AGY Hub 是面向 Windows 版 Google Antigravity 的本地桌面管家，把汉化补丁、账号与额度、Codex / 自定义 Provider 接入、Token 统计、主题、MCP / Skill、社区与更新能力集中到一个 Electron 应用中。

当前发布版本为 **AGY Hub 1.4.0**；汉化补丁基于 **Antigravity 2.24.0** 构建与验证。客户端更新后按版本、官方文件哈希与结构自动构建并校验；如果官方移除必要能力，会在写入前停止，不能保证未知结构的任意未来版本均兼容。

[下载 1.4.0 安装包](https://github.com/3169657175/Antigravity-Chinese/releases/download/v1.4.0/agy-hub-setup-1.4.0.exe) · [最新版 Release](https://github.com/3169657175/Antigravity-Chinese/releases/latest) · [完整更新说明](docs/RELEASE_NOTES_1.4.0.md)

安装后打开 AGY Hub，点击“注入中文汉化补丁”应用新版汉化。覆盖安装会按安装目录识别并关闭正在运行的管家。

## 1.4.0 重点更新

- 修复动态页面更新时分片扫描提前结束造成的汉化遗漏，并加入实际 Chromium 页面与成品汉化引擎的回归验证。
- 修复成品安装后自动适配新版时找不到 `accountQuota.js` 的问题；额度模块同时保留在 Hub 主包、外置构建资源和汉化包中，并校验三处内容一致。
- Hub 与注入窗口使用相同的多账号额度代码；4 个真实账号的两套额度接口均完整返回 Gemini / Claude 的 5 小时与每周额度。
- 修复注入后立即显示 `unknown`：版本检测改用物理 ASAR 快照，独立读取客户端与补丁版本，完成注入后刷新选定的客户端，无需重启管家。
- 自动适配比较官方文件哈希，支持同版本官方文件变化、不同换行格式及基于同版本原版备份的重复注入；结构不支持时，在关闭客户端和写入前拒绝。
- 新增成品 Worker 冒烟门禁，验证当前 2.24.0、模拟新版本、重复注入、同版本文件变化与失败保护；继续保留覆盖安装自动关闭功能。

## 1.3.9 重点更新

- 修复多账号额度读取：先通过各账号的 `loadCodeAssist` 查询真实项目，再获取 Gemini / Claude 的 5 小时与每周额度，避免固定虚拟项目返回不完整数据。
- Hub 与 Antigravity 账号弹窗共用额度查询模块；缺失字段显示未知，不再伪造 100% 或导致所有额度无法查看。
- 反代 Gemini 列表更新为 3.8 Flash High / Medium / Low，清理旧缓存与默认列表中的停用版本，保留 Claude 与 GPT-OSS。
- 查询和验证不会切换当前账号、Provider 或网关模式。
- 修复从 1.3.8 升级时误报“无法关闭”的安装问题；覆盖安装按目录识别，不再依赖版本名单，检测到程序运行时自动关闭并继续。

## 1.3.8 重点更新

- 修复新版本 Antigravity（已在 2.22.0 上做兼容构建检查）注入时找不到汉化词典和运行资源的问题，统一从安装包外置 patch 资源读取。
- 官方更新期间避免 AGY Hub 直接锁住安装目录的 app.asar，新增独立快照扫描和安装器检测，检测到更新将暂停汉化注入。
- 修复反馈帖已有评论时因 `replyActions` 自引用触发 `ReferenceError`、导致评论区无法打开的问题；已在 Electron 页面中验证同一帖子连续三次打开/关闭均正常。
- 完善评论弹窗关闭计时与再次打开状态，并补充无评论、已有评论、多条评论及发送中评论的回归测试。

## 1.3.7 重点更新

- 本地 8046 反代升级为统一多协议兼容网关，同时支持 **OpenAI Responses、OpenAI Chat Completions、Anthropic Messages、Gemini Native**。
- 新增 `/v1/chat/completions`，兼容文本、图片 `image_url`、system/developer 消息、Tools / Function Calling、工具结果、JSON 与 SSE 流式输出。
- 新增 Gemini Native `generateContent` / `streamGenerateContent`、`/v1beta/models` 模型发现，兼容 `systemInstruction`、`inlineData`、`fileData`、`functionCall` / `functionResponse`。
- 公共 OpenAI `/v1/models` 返回真实 Antigravity 模型 ID（`gemini-*` / `claude-*`）；Codex 专用 `gpt-*` 兼容别名只保留在 Codex 私有 `model_catalog_json`，不再污染普通 API 客户端的模型发现。
- 对 embeddings、audio、images、moderations、files、batches、fine-tuning 等当前上游不具备的能力返回明确的结构化 `501`，不再伪装成模型或 API Key 错误。
- API 接入页同步展示四套真实协议、对应 Base URL 与可用路由，移除“Chat Completions 不支持”的旧提示。
- 新增协议适配层与真实 HTTP 路由回归测试，主网关继续保持模块化和 1650 行维护预算。
- 固定 UI 汉化改为“小型静态界面即时翻译、大型动态 DOM 分片处理”，修复项目/复杂内容展开时数秒延迟，同时保持 Thought / Analyzed 等思考与工具过程原文不做实时翻译。
- 修复历史对话、计划任务、自定义功能页面的主题语义识别与主内容毛玻璃背景，并补齐 MCP 目录中的固定描述汉化。
- 修复 Windows 同版本覆盖安装：1.3.0～1.3.7 旧卸载链路和任意同版本重装均走安全覆盖迁移，避免错误的“应用无法关闭”循环提示。
- 保留 1.3.6 已验证的账号、注入、Token、MCP / Skill、社区、更新和回滚能力。
- 此版本的历史 Release 使用 `1.3.8` / `v1.3.8` 标签；当前版本见页面顶部。

## 第三方 Agent / API 接入

本地网关默认监听 `127.0.0.1:8046`，API Key 在 AGY Hub 的“反代接入 → API 接入”页面查看。四套协议于 1.3.7 引入并在本机真实网关上验证模型发现、非流式、SSE 流式与 Function/Tool Calling；1.3.8 继续保留这些能力。

| 客户端协议 | Base URL | 主要端点 | Agent 能力 |
| --- | --- | --- | --- |
| OpenAI Chat Completions | `http://127.0.0.1:8046/v1` | `/v1/chat/completions` | 文本、图片、SSE、Tools / Function Calling |
| OpenAI Responses | `http://127.0.0.1:8046/v1` | `/v1/responses` | 非流式、SSE、Function Calling、上下文压缩 |
| Anthropic Messages | `http://127.0.0.1:8046` | `/v1/messages` | Messages、SSE、tool_use、`count_tokens` |
| Gemini Native | `http://127.0.0.1:8046/v1beta` | `models/{model}:generateContent` | generate/stream、functionCall / functionResponse |

公共模型发现：`GET /v1/models`；Gemini 模型发现：`GET /v1beta/models`。当前 live catalog 包含 Gemini 3.8 / 3.7 / 3.6 Flash High/Medium/Low、Gemini 3.1 Pro High/Low、Claude Opus 4.6 Thinking 与 Claude Sonnet 4.6。

> Codex 为了适配自身模型白名单仍使用 `gpt-*` 兼容槽位，但这些别名只写入 Codex 私有模型目录；普通 API 客户端始终看到并使用真实 Gemini / Claude 模型 ID。

## 主要能力

- **汉化补丁与安全回退**：基于当前官方 `app.asar` 构建兼容补丁，支持注入、退回上一版汉化和恢复官方英文原版。
- **本地账号与额度**：读取 Antigravity 本地账号，展示额度、状态与重置时间，并提供账号切换和异常分类。
- **统一 API 反代**：本地 `127.0.0.1:8046` 同时提供 OpenAI Responses、OpenAI Chat Completions、Anthropic Messages 与 Gemini Native，支持流式输出、工具调用、图片、长上下文与模型映射。
- **Claude Code 底层兼容（暂时隐藏入口）**：相关实现仍保留在源码中，当前版本默认通过 Feature Flag 关闭 UI，待链路完善后可直接重新开放。
- **当前模型目录**：支持 Gemini 3.8 / 3.7 / 3.6 Flash 的 High / Medium / Low、Gemini 3.1 Pro High / Low，以及 Claude Opus 4.6 / Sonnet 4.6。
- **自定义 Provider**：支持 OpenAI Responses 兼容服务，测试不会改变当前已连接线路。
- **Token 与缓存监控**：区分本地 Antigravity、Codex 和 Claude Code 调用，统计输入、输出、缓存与命中率。
- **主题皮肤**：内置主题并支持本地自定义壁纸。
- **MCP / Skill**：提供市场、配置检查、显式深度握手、Skill 增量翻译与缓存。
- **社区与在线更新**：内置公告、反馈、诊断和 GitHub Release 更新能力。

## 源码与运行目录

| 路径 | 用途 |
| --- | --- |
| `<仓库克隆目录>` | 开发源码和构建目录 |
| `<AGY Hub 安装目录>` | 应用安装与运行目录，不建议直接作为长期开发目录 |
| `dist\` | Windows 安装包、blockmap 和 `latest.yml` 发布产物 |

开发时请先阅读 `AGENTS.md`、`AI_PROJECT_GUIDE.md` 和 `docs/MAINTENANCE_GUIDE.md`。

## 项目结构

```text
agy-hub/
├─ main.js                         Electron 生命周期与主进程编排
├─ preload.js                      安全 IPC 桥
├─ renderer.js                     前端全局入口
├─ index.html                      主界面
├─ gatewayController.js            反代页面控制器
├─ codexGateway.js                 本地 8046 统一网关
├─ codexModels.js                  Codex 模型目录与别名
├─ antigravityModelCatalog.js      Antigravity 动态模型目录
├─ anthropicGateway.js             Anthropic Messages 协议转换
├─ accountIpc.js                   本地账号与额度 IPC
├─ tokenUsage.js                   Token 统计
├─ marketplaceController.js        MCP / Skill 市场
├─ patch-workbench/                Antigravity 补丁构建与兼容验证
├─ assets/                         图标、主题、截图和发布用补丁资源
│  └─ screenshots/                 社区界面预览截图
├─ docs/                           架构、维护与兼容文档
├─ tests/
│  └─ unit/                       单元测试、协议与回归测试（65 个文件）
└─ scripts/
   └─ smoke/                      Electron 页面、UI 和注入冒烟验证脚本
```

### 源码目录整理说明

测试源码统一放在 `tests/unit/`，Electron 冒烟测试放在 `scripts/smoke/`，社区预览图片放在 `assets/screenshots/`，避免占据 GitHub 仓库首页。Electron 主进程、渲染进程和网关模块保留原有路径，确保 **1.3.8 运行与安装包资源布局不受影响**。目录整理不会改变现有 Release 安装包。

## 开发与验证

安装依赖：

```powershell
npm install
```

本地启动：

```powershell
.\node_modules\.bin\electron.cmd .
```

全量测试：

```powershell
npm test
```

汉化补丁发布门禁：

```powershell
npm run patch:rebuild
npm run patch:verify
npm test
```

Windows 安装包：

```powershell
npm run release:build
```

发布流程包含 `npm run test:installer-upgrade`，会用独立应用身份验证全新安装、覆盖升级、同版本重装、自动退出和强制关闭兜底，并清理测试注册表与缓存。成品构建后还会执行 `npm run test:packaged-patch`，直接使用安装包内的 Worker 在官方副本上验证，以及 `npm run test:translation-dom -- --packaged`，验证动态页面汉化与聊天内容保护。

需要将构建产物同步到本机的应用运行目录时才执行：

```powershell
npm run dist:sync
```

不要为了构建或测试强制关闭正在运行的 AGY Hub，也不要在未明确要求时自动注入或重启 Antigravity。

## 发布产物

正式 Release 使用以下三个核心文件：

```text
agy-hub-setup-1.4.0.exe
agy-hub-setup-1.4.0.exe.blockmap
latest.yml
```

`latest.yml` 与安装包必须来自同一次构建。发布前应确认补丁校验通过、全量测试通过，并记录安装包 SHA-256。

## 安全边界

- 网关默认只监听 `127.0.0.1`，不要直接暴露到公网。
- API Key、Refresh Token、账号凭据和完整私人日志不得提交到仓库或公开 Issue。
- “测试”只能做临时探测；只有明确“接入”操作才允许写入 Codex / Claude 配置。
- Antigravity 官方版本变化后必须重新建立官方基线并通过兼容构建，不能强行复用旧补丁。

## License

基于 [MIT License](LICENSE) 开源。
