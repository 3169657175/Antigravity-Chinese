# Antigravity 中文增强与 AGY Hub

[![Release](https://img.shields.io/github/v/release/3169657175/Antigravity-Chinese?display_name=tag&sort=semver)](https://github.com/3169657175/Antigravity-Chinese/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/3169657175/Antigravity-Chinese/total)](https://github.com/3169657175/Antigravity-Chinese/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-2563eb?logo=windows)](#运行环境)
[![AGY Hub](https://img.shields.io/badge/AGY%20Hub-1.2.3-0A7D5A)](#agy-hub-桌面管家)
[![Antigravity](https://img.shields.io/badge/Antigravity-2.17.0-5B5BD6)](#运行环境)

这是一个面向 Windows 版 Google Antigravity 的中文增强与本地 AI 工具管理项目。

仓库现在同时包含：

- **Antigravity 中文与体验优化补丁**：汉化、主题、托盘、账号与额度、网络体验增强及安全回退。
- **AGY Hub 桌面管家完整源码**：补丁注入与回退、账号管理、Codex / Claude Code 接入、Token 监控、MCP / Skill、诊断、社区与在线更新。

当前 AGY Hub 应用版本为 **1.2.3**，汉化补丁构建基线已适配 **Antigravity 2.17.0**。本次公开源码已与实际运行版本重新对齐，并通过补丁校验和全量自动化测试。

> Antigravity 更新可能改变内部 Electron 文件结构。不要把旧补丁强行注入新版本；应先重新建立官方基线并通过兼容构建和验证。

## 下载与安装

### AGY Hub 安装（推荐）

1. 打开 [Releases](https://github.com/3169657175/Antigravity-Chinese/releases/latest)。
2. 下载 `agy-hub-setup-*.exe`。
3. 安装并启动 AGY Hub。
4. 在“汉化注入”页面确认识别到的 Antigravity 版本。
5. 执行注入；需要回退时可分别选择“退回上一版汉化”或“恢复官方英文原版”。

自动更新同时使用同一 Release 中的 `.blockmap` 与 `latest.yml`。

### 手动补丁脚本

仓库根目录继续保留原来的 PowerShell / BAT 方式，适合补丁开发、调试或手动控制：

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\install.ps1
```

恢复官方版本：

```powershell
.\restore.ps1
```

也可以双击 `安装汉化与优化补丁.bat` 和 `一键还原官方原版.bat`。

## AGY Hub 桌面管家

AGY Hub 是一个 Electron 本地桌面应用，默认只在 `127.0.0.1` 提供本地服务，不把模型网关直接暴露到公网。

### 汉化补丁与安全回退

- 基于当前官方 `app.asar` 动态构建兼容补丁。
- 注入前检查结构、关键 JavaScript 语法和必要能力。
- 固定维护当前汉化、上一版汉化、当前官方原版三个状态。
- Antigravity 客户端版本变化时重新建立官方基线，避免跨版本错误恢复。
- 当前补丁构建/验证基线：**Antigravity 2.17.0**。

### 当前模型目录

当前实装模型目录以 Antigravity 实时 `fetchAvailableModels` 为准，并保留稳定的客户端映射。当前已适配：

- Gemini 3.8 Flash：High / Medium / Low
- Gemini 3.7 Flash：High / Medium / Low
- Gemini 3.6 Flash：High / Medium / Low
- Gemini 3.1 Pro：High / Low
- Claude Opus 4.6 Thinking
- Claude Sonnet 4.6

已经移除的旧模型不会因为历史配置重新出现在当前目录中；旧配置会迁移到当前可用默认模型。

### Codex 接入

- 本地 `http://127.0.0.1:8046/v1` 提供 OpenAI Responses 兼容接口。
- 支持流式输出、工具调用、图片输入、Reasoning Summary、长上下文和本地压缩恢复。
- Codex 可见模型使用客户端允许的别名，网关内部保持真实 Antigravity 模型映射。
- 自定义 Responses Provider 与 Antigravity Provider 分离；“测试”不会改变正在使用的线路。

### Claude Code / Claude Desktop

- 支持 Anthropic Messages 与 `count_tokens`。
- 模型路由、账号和连接状态与 Codex 分离。
- 支持真实 Claude Desktop 配置写入、备份与恢复。
- Claude 客户端显示兼容路由名，转发时还原为用户实际选择的 Antigravity 模型。

### 本地账号与额度

- 自动识别 Antigravity 本地账号。
- 支持账号保存、导入、切换、状态检查和额度读取。
- 授权失效、临时配额、网络异常等错误进行可读分类。
- 敏感凭据只在本地主进程处理，不应提交到仓库或公开日志。

### Token 与缓存监控

- 分开统计本地 Antigravity、Codex 和 Claude Code 反代调用。
- 展示输入、输出、总 Token、缓存读取量和缓存命中率。
- 支持 JSON、SSE、protobuf / gRPC UsageMetadata。
- 采用增量记录和有界历史，避免长期运行时日志无限增长。

### MCP / Skill

- MCP 与 Skill 市场、分类、搜索、分页和响应式布局。
- MCP 配置快检与显式深度 `initialize` 握手分离。
- Skill 简介支持按内容哈希进行增量翻译和缓存。
- 安装前校验命令、包名和固定版本，拒绝明显不可审计的启动配置。

### 主题、社区与更新

- 内置多套主题并支持自定义本地壁纸。
- 社区公告、反馈与管理边界位于主进程侧。
- GitHub Release 自动更新支持安装包、blockmap 和 `latest.yml`。
- 长任务提供统一进度和诊断反馈。

## 操作边界

| 操作 | 行为 | 是否改变当前线路 |
| --- | --- | --- |
| 测试模型 | 使用草稿配置做临时探测 | 否 |
| 启动服务 | 确保本地网关监听 | 不应暗中切换 Provider |
| 接入 Codex | 写入 Codex 配置和模型目录 | 是 |
| 接入 Claude | 写入 Claude 配置并准备本地网关 | 是 |
| 一键注入 | 修改 Antigravity 补丁文件 | 与反代线路无关 |
| 退回上一版汉化 | 恢复上一份汉化补丁 | 与反代线路无关 |
| 恢复官方英文原版 | 恢复当前版本官方文件 | 与反代线路无关 |

## 仓库结构

```text
Antigravity-Chinese/
├─ patch/                         传统脚本版 Antigravity 补丁源码
├─ install.ps1                    手动安装脚本
├─ restore.ps1                    官方原版恢复脚本
├─ auto_heal.ps1                  脚本版更新恢复辅助
├─ bundle.js                      沙盒 preload 模块打包器
├─ 安装汉化与优化补丁.bat
├─ 一键还原官方原版.bat
└─ agy-hub/                       AGY Hub 桌面管家完整源码
   ├─ main.js
   ├─ preload.js
   ├─ renderer.js
   ├─ codexGateway.js
   ├─ antigravityModelCatalog.js
   ├─ gatewayController.js
   ├─ patch-workbench/
   ├─ assets/
   ├─ docs/
   └─ *.test.js
```

`agy-hub/` 现在就是公开仓库内的完整桌面管家源码，不再需要跳转到另一个仓库才能查看核心实现。

## 开发与验证

进入桌面管家源码：

```powershell
cd .\agy-hub
npm install
```

本地启动：

```powershell
.\node_modules\.bin\electron.cmd .
```

完整测试：

```powershell
npm test
```

补丁发布门禁：

```powershell
npm run patch:rebuild
npm run patch:verify
npm test
```

构建 Windows Release：

```powershell
.\node_modules\.bin\electron-builder.cmd --win nsis --x64
```

本次同步验证结果：

- Antigravity 2.17.0 补丁重建：通过
- 补丁结构与关键 JS 语法校验：通过
- 自动化测试：207 项，0 失败，3 项真实 MCP live 测试按设计跳过
- Windows NSIS 安装包、blockmap、`latest.yml`：同一次构建生成

## 运行环境

| 项目 | 当前状态 |
| --- | --- |
| Windows 10 / 11 | 支持 |
| Antigravity 2.17.0 | 当前兼容构建已验证 |
| Codex | 支持 Responses 接入 |
| Claude Code / Claude Desktop | 支持 Anthropic Messages 接入 |
| 自定义 OpenAI Responses Provider | 支持 |
| macOS / Linux | 暂无完整安装与注入支持 |

## 安全说明

- 本项目不是 Google、OpenAI 或 Anthropic 官方产品。
- 不要向公开 Issue、日志或仓库提交 API Key、Refresh Token、账号存档或私人对话内容。
- 网关默认监听回环地址；不要简单改成 `0.0.0.0` 暴露到公网。
- 真实“接入”操作会写本地客户端配置，执行前会保留恢复路径。
- Antigravity 更新后应先保存新的官方原版，再重新生成兼容补丁。

## 参与项目

提交 Issue 时建议提供：Antigravity / AGY Hub 版本、使用的接入线路、三级测试失败层级、脱敏后的诊断报告，以及最短复现步骤。

## 致谢

项目在账号管理、界面挂载和客户端增强设计上参考了：

- [BigPizzaV3/CodexPlusPlus](https://github.com/BigPizzaV3/CodexPlusPlus)
- [lbjlaq/Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager)
- [farion1231/cc-switch](https://github.com/farion1231/cc-switch)

感谢所有提交测试结果、错误日志、汉化校对和兼容反馈的使用者。