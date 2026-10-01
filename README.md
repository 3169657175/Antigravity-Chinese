# Antigravity 中文增强与 AGY Hub

[![Release](https://img.shields.io/github/v/release/3169657175/Antigravity-Chinese?display_name=tag&sort=semver)](https://github.com/3169657175/Antigravity-Chinese/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/3169657175/Antigravity-Chinese/total)](https://github.com/3169657175/Antigravity-Chinese/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-2563eb?logo=windows)](#运行环境)
[![AGY Hub](https://img.shields.io/badge/AGY%20Hub-1.2.3-0A7D5A)](#当前版本)
[![Antigravity](https://img.shields.io/badge/Antigravity-2.17.0-5B5BD6)](#当前版本)

这是面向 Windows 版 Google Antigravity 的中文增强与桌面管理项目。当前主线已经统一为 **AGY Hub 桌面管家**，仓库根目录就是最新版完整源码，不再把真正源码藏在二级目录中。

## 当前版本

- AGY Hub：**1.2.3**
- Antigravity 兼容基线：**2.17.0**
- 补丁格式：v2，基于官方底包构建并保留官方 `app.asar.unpacked`
- Electron：31.x
- Windows：10 / 11 x64

最新安装包请直接前往 [Releases](https://github.com/3169657175/Antigravity-Chinese/releases/latest) 下载。

## 主要能力

### Antigravity 汉化与安全补丁

- 自动识别 Antigravity 安装目录与版本。
- 基于当前官方 `app.asar` 构建兼容补丁。
- 注入前执行结构、语法、关键能力和哈希校验。
- 固定保留官方原版与上一版汉化，支持安全回退。
- 当前补丁构建链已适配 Antigravity 2.17.0。

### 本地账号与额度

- 读取 Antigravity 本地账号并展示额度。
- 支持账号切换、状态检查、重新授权提示。
- 凭据只在 Electron 主进程中处理，敏感字段不直接暴露到渲染层。

### Codex 接入

- 在 `127.0.0.1:8046` 提供 OpenAI Responses 兼容接口。
- 支持 Antigravity 实际可用模型与 Codex 可见模型别名映射。
- 支持当前 Gemini 3.8 / 3.7 / 3.6、Gemini 3.1 Pro 与 Claude 4.6 路由。
- 支持流式输出、工具调用、长对话、compaction 与 reasoning summary。
- 自定义 Responses Provider 与 Antigravity 路由相互隔离。

### Claude Code / Claude Desktop 接入

- 提供 Anthropic Messages 与 `count_tokens` 兼容接口。
- 支持 Claude Desktop 配置写入、备份与恢复。
- Codex 与 Claude 的账号、模型和路由状态相互隔离。

### Token、MCP、Skill 与主题

- 统计本地 Antigravity 与反代请求的 Token 和缓存使用情况。
- 提供 MCP / Skill 市场、安装、配置检查与显式深度验证。
- 支持内置主题、自定义壁纸和主题配置同步。

## 当前模型目录

当前 AGY Hub 内置模型目录包括：

- Gemini 3.8 Flash：High / Medium / Low
- Gemini 3.7 Flash：High / Medium / Low
- Gemini 3.6 Flash：High / Medium / Low
- Gemini 3.1 Pro：High / Low
- Claude Opus 4.6 Thinking
- Claude Sonnet 4.6

实际可用模型仍以 Antigravity 当前账号返回的实时目录为准。

## 仓库结构

```text
Antigravity-Chinese/
├─ main.js                         Electron 主进程
├─ preload.js                      安全 IPC 桥
├─ renderer.js                     前端入口
├─ index.html                      主界面
├─ style.css                       运行时完整样式
├─ codexGateway.js                 本地 8046 网关
├─ codexModels.js                  Codex 模型目录与别名
├─ anthropicGateway.js             Anthropic Messages 转换
├─ claudeDesktopConfig.js          Claude Desktop 配置管理
├─ accountIpc.js                   本地账号与额度
├─ tokenUsage.js                   Token 统计
├─ marketplaceController.js        MCP / Skill 市场
├─ patch-workbench/                Antigravity 补丁构建与兼容层
├─ assets/app.asar                 当前发布补丁
├─ assets/patch-manifest.json      补丁版本和哈希清单
├─ docs/                           架构与维护文档
├─ *.test.js                       自动化测试
├─ package.json                    Electron / electron-builder 配置
└─ README.md
```

历史上的 `patch/`、`install.ps1`、`restore.ps1`、`bundle.js` 和 BAT 手动补丁链已从当前主分支移除，避免与现在的 AGY Hub / patch-workbench 双轨并存。旧实现仍可通过 Git 历史查看。

## 开发

安装依赖：

```powershell
npm install
```

本地启动：

```powershell
.\node_modules\.bin\electron.cmd .
```

运行测试：

```powershell
npm test
```

重建并验证 Antigravity 补丁：

```powershell
npm run patch:rebuild
npm run patch:verify
```

构建 Windows 安装包并同步到本机运行目录：

```powershell
npm run dist:sync
```

## 发布文件

正式 Release 使用以下文件：

- `agy-hub-setup-1.2.3.exe`
- `agy-hub-setup-1.2.3.exe.blockmap`
- `latest.yml`

自动更新目标已经配置为：

```text
3169657175/Antigravity-Chinese
```

## 开发与运行目录

本机开发时建议保持单一源码基线：

```text
C:\Users\niu\.gemini\antigravity\scratch\agy-hub
```

构建后的实际运行目录：

```text
D:\ang\agy-hub
```

后续修改应优先进入正式开发目录，完成测试和构建后再同步运行目录，避免两边长期分叉。

## 测试与发布门禁

发布前至少执行：

```powershell
npm run patch:rebuild
npm run patch:verify
npm test
```

当前 1.2.3 基线已通过完整自动化测试；真实 MCP live 测试依赖本机外部环境，因此按设计可跳过。

涉及补丁发布时还需要确认：

- `dist/main.js`、`dist/preload.js`、`dist/ipcHandlers.js` 等关键文件通过语法检查；
- `dist/accountVault.js` 存在；
- 当前补丁 SHA-256 与 manifest 一致；
- 官方原版与上一版汉化具备恢复路径。

## 安全说明

- 本项目不是 Google、OpenAI 或 Anthropic 的官方产品。
- 不要公开 API Key、Refresh Token、账号存档或未脱敏日志。
- 本地网关默认只监听 `127.0.0.1`，不要直接改成公网监听。
- Antigravity 官方更新后，应先重新执行兼容构建与验证，再进行注入。
- 第三方模型中转服务的隐私和账号风险由使用者自行评估。

## License

AGY Hub 源码按仓库中的 [MIT License](LICENSE) 发布。