# AGY Hub 维护指南

适用基线为 AGY Hub 1.4.7 和 Antigravity 2.34.0。目录映射、启动命令和发布位置见 [源码布局](REPOSITORY_LAYOUT.md)。

## 从问题找到代码

| 问题 | 主要入口 | 验证重点 |
| --- | --- | --- |
| 注入失败、版本识别或恢复 | `patchController.js`、`patchVersionInfo.js`、`patchRuntimeBuilder.js`、`patchWorker.js`、`patchBackupManager.js` | 先确认官方基线、ASAR 和 unpacked 对应，新结构在写入前校验。运行补丁兼容、备份和发布包验证 |
| 注入后账号面板、额度、切换失效 | `patch-workbench/compatibility.js`、`antigravitySwitchBridge.js` | 执行成品的 IPC 注册路径，验证官方返回值和注入 handler 均保留。仅通过语法检查无法发现不可达代码 |
| AGY Hub 账号、额度、导入导出 | `accountIpc.js`、`accountTransfer.js`、`accountQuota.js`、`accountQuotaCache.js`、`localAccountsController.js` | 当前账号查 Language Server，其他账号分开查。覆盖 0%、未返回、缓存过期和账号切换。导入时检验格式、加密保存并保留同一账号记录 |
| 反代模型、协议或测试异常 | `gatewayIpc.js`、`gatewayProfiles.js`、`gatewayTestRunner.js`、`codexGateway.js`、`inboundProtocolAdapters.js` | 运行协议、路由和 `routeIsolation.test.js`。验证探测前后活动配置一致 |
| Codex / Claude 客户端接入和恢复 | `codexConfig.js`、`codexAppLifecycle.js`、`claudeDesktopConfig.js`、`claudeDesktopLifecycle.js` | 验证配置备份、原子写入、恢复和状态回读。Codex 模型目录先落盘并校验，再发布引用它的 `config.toml` |
| 主题或页面布局异常 | `themeIpc.js`、`themeController.js`、根 `style.css`、`styles/` | 区分主题资源和运行时代码，验证打包后的实际计算样式 |
| Token 统计 | `tokenUsage.js`、`tokenStatsStore.js`、`tokenMonitorController.js`、`logTailReader.js` | 本地统计与网关调用按来源区分，保持每页 20 条和离页停止轮询 |
| MCP / Skill | `marketplaceController.js`、`mcpLaunchConfig.js`、`mcpProbe.js`、`skillTranslationService.js` | 配置检查与深度握手分开，进程探测有超时，后台同步不自动消耗模型额度 |
| 社区、公告或更新 | `communityIpc.js`、`communityClient.js`、`updaterService.js`、`appShellController.js` | 检查 IPC 白名单、脱敏显示、下载重试、发布元数据和更新弹窗 |

## 状态与存储

- Electron `app.getPath('userData')` 包含网关配置、用量统计、接入备份、代理配置和社区会话。读取时先确认实际运行目录，诊断输出须去除账号凭据和密钥。
- 网关的三个独立 Profile 为 `codex-antigravity`、`codex-custom`、`claude-antigravity`。连接测试只发临时请求。
- `assets/app.asar` 与 `assets/patch-manifest.json` 是待交付补丁。动态适配使用 `patch-workbench/legacy-payload.asar`、兼容规则和外置构建资源。
- `patchBackupManager.js` 管理 `app.asar.original` 和 `app.asar.previous`。配套 unpacked 目录一并处理。官方升级后先匹配新版本的可信原版，禁止用旧版备份覆盖新版客户端。Worker 进入最终提交阶段后不可取消。
- `app-update.yml` 指向官方 GitHub 发布源。打包目录与发布页的 `latest.yml` 必须匹配 EXE 和 blockmap。更新安装目录中的留存清单前，先备份旧清单并比对三个文件的哈希。

## 日常验证

1. 对改动的 JavaScript 执行 `node --check`，运行对应单测，必要时用 `npm test` 检查整套回归。
2. 影响 UI 时执行 `scripts/smoke/` 下对应验证，界面脚本顺序同时由 `runtimeDeps.test.js` 约束。架构边界用 `npm run test:architecture` 检查。
3. 发布时执行 `npm run release:build`。验证后区分源码测试、隔离安装／注入和真实账号验收，并保留产物哈希。
4. 公开源码同步至仓库 `app/`，分别检查主分支和 Release 标签。发布附件先通过版本和哈希校验，标签应指向实际构建源码。

更多结构约束见 [架构决策](ADR-001-modular-monolith.md)和 [第二、三阶段结构说明](PHASE2_PHASE3_ARCHITECTURE.md)。
