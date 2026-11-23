# AGY Hub 项目接手说明

本文以 AGY Hub 1.4.7 和 Antigravity 2.34.0 为基线，于 2026-11-23 核对。维护入口见 [维护指南](../MAINTENANCE_GUIDE.md)。

## 找到正确的工程

| 位置 | 用途 |
| --- | --- |
| `D:\AGY-Hub-Dev` | 本机正式开发目录。桌面端源码平铺在根目录，构建输出在 `dist\` |
| `D:\ang\agy-hub` | AGY Hub 安装和运行目录 |
| GitHub `3169657175/Antigravity-Chinese` 的 `app/` | 公开桌面端工程，构建输出在 `app/dist/` |
| GitHub 根目录的 `docs/`、`community-backend/` | 项目文档和独立的社区后端 |

开始前确认目录、版本和 Git 改动。保留工作区已有改动。旧 C 盘开发副本和顶层临时 `patch-*.js`、`fix-*.js` 不作为正式源码。

## 架构和业务入口

AGY Hub 是 Electron 模块化单体，界面通过 Controller 和 `preload.js` 的白名单 API 调用主进程 IPC。文件、系统配置、账户凭据和云端请求由主进程处理。架构决策见 ADR-001，具体文件和测试入口见维护指南。

| 功能 | 主要文件 |
| --- | --- |
| Electron 生命周期与导航 | `main.js`、`preload.js`、`renderer.js`、`navigationController.js`、`appShellController.js` |
| 抽取官方基线、构建和注入 | `patch-workbench/`、`patchRuntimeBuilder.js`、`patchWorker.js`、`patchBackupManager.js`、`patchController.js` |
| 账号和额度 | `accountIpc.js`、`accountTransfer.js`、`accountQuota.js`、`antigravityLanguageServerQuota.js`、`antigravitySwitchBridge.js` |
| 网关和接入 | `gatewayIpc.js`、`gatewayController.js`、`codexGateway.js`、`gatewayProfiles.js` |
| Token 监控、主题、MCP / Skill | `tokenMonitorController.js`、`themeIpc.js`、`marketplaceController.js`、`mcpProbe.js` |
| 社区和自动更新 | `communityIpc.js`、`communityClient.js`、`communityController.js`、`updaterService.js` |

## 关键约束

- 保持运行中的 AGY Hub，避免中断经由 `127.0.0.1:8046` 使用的连接。未经用户明确要求，不注入补丁或重启 Antigravity，也不构建发布包。
- Codex、Claude 与自定义 Provider 的 Profile 分开保存。“测试”只使用临时参数，“接入”才允许写客户端配置和切换活动路由。恢复应使用接入前的备份。
- 网关默认只监听回环地址。网关实现兼容 Responses、Chat Completions、Anthropic Messages 和 Gemini Native。Claude Code 一键接入按钮默认隐藏。自定义 Provider 的接入以 OpenAI Responses 为基准。
- 本地账号位于用户目录下的 `.gemini/antigravity/tools`。当前账号额度优先使用 Language Server，非当前账号走各自的查询和缓存。账号切换后要校验响应所属账号。凭据不进入渲染进程或日志。
- 只换壁纸时按 AGENTS.md 的主题资源边界处理。Electron 载入完整的 `style.css`，样式职责文件在 `styles/`。涉及布局时核对运行时样式。
- 补丁保留当前包、可信官方原版和同版本上一版汉化。ASAR 与 unpacked 目录配套管理。写入前校验官方版本与结构，失败时保留回退路径。

## 验证与发布

本机在 `D:\AGY-Hub-Dev` 执行，GitHub 克隆在 `app/` 执行：

~~~powershell
npm ci
npm test
npm run patch:verify
npm run release:verify
~~~

修改 JavaScript 后先运行 `node --check` 和受影响的测试。涉及活动网关，运行 `routeIsolation.test.js`。只有要求发布时才运行 `npm run release:build`。它串联补丁构建、校验、单测、安装升级测试、安装包、成品补丁和动态汉化验证。按 AGENTS.md 比对补丁哈希并保留上一份已验收 ASAR。

Release 的 EXE、blockmap 和 `latest.yml` 来自同一次构建。公开发布前先核对标签对应的源码版本，并记录产物哈希。正式更新从 GitHub Release 读取元数据，安装目录中的 `latest.yml` 属于本地留存的发布文件。
