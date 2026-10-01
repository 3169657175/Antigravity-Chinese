# Antigravity 中文增强与 AGY Hub

[![Release](https://img.shields.io/github/v/release/3169657175/Antigravity-Chinese?display_name=tag&sort=semver)](https://github.com/3169657175/Antigravity-Chinese/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/3169657175/Antigravity-Chinese/total)](https://github.com/3169657175/Antigravity-Chinese/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-2563eb?logo=windows)](#运行环境)
[![AGY Hub](https://img.shields.io/badge/AGY%20Hub-1.3.0-0A7D5A)](#当前版本)
[![Antigravity](https://img.shields.io/badge/Antigravity-2.19.1-5B5BD6)](#当前版本)

面向 Windows 版 Google Antigravity 的中文增强与桌面管理项目。当前主线统一为 **AGY Hub 桌面管家**，提供汉化补丁、账号额度、Codex / 自定义 Provider 接入、Token 统计、MCP / Skill、主题、社区和更新能力。

## 当前版本

- AGY Hub：**1.3.0**
- Antigravity 兼容基线：**2.19.1**
- Electron：31.x
- Windows：10 / 11 x64

最新安装包请直接前往 [Releases](https://github.com/3169657175/Antigravity-Chinese/releases/latest) 下载。

## 1.3.0 重点更新

- **更新下载提速**：Windows 自动更新关闭 blockmap 差分下载，改为完整安装包单次下载，保留 SHA512 校验、进度与自动安装。
- **版本链统一**：更新、源码和 Release 统一到 `3169657175/Antigravity-Chinese`，读取更新说明时兼容 `1.3.0` / `v1.3.0` 标签。
- **社区即时响应**：反馈、回复、点赞和删除改为本地乐观更新，失败自动回滚；搜索只做本地过滤，不再反复闪骨架屏。
- **社区容灾**：只读请求支持可配置备用 HTTPS 源和最后成功数据缓存；写操作不会自动重放，避免重复提交。
- **按需加载**：社区、Codex、MCP / Skill 等较重页面在首次打开时再初始化。
- **统一交互与诊断**：新增 Toast / 确认框、错误分类、Feature Flag 与 Release Guard。
- **Claude Code**：入口暂时隐藏，底层实现继续保留；Codex 反代、8046、Token 统计、自定义 Provider 和三级测试保持现有逻辑。

## 主要能力

### Antigravity 汉化与安全补丁

- 自动识别 Antigravity 安装目录与版本。
- 基于当前官方 `app.asar` 构建兼容补丁。
- 注入前执行结构、语法、关键能力和哈希校验。
- 固定保留官方原版与上一版汉化，支持安全回退。
- 当前补丁构建链已适配 Antigravity 2.19.1。

### 本地账号与额度

- 读取 Antigravity 本地账号并展示额度。
- 支持账号切换、状态检查与重新授权提示。
- 凭据只在 Electron 主进程中处理，敏感字段不直接暴露到渲染层。

### Codex 与 Provider 接入

- 在 `127.0.0.1:8046` 提供 Codex 所需的 OpenAI Responses 兼容入口。
- 支持 Antigravity 实际可用模型与客户端别名映射。
- 支持流式输出、工具调用、长对话、compaction 与 reasoning summary。
- 自定义 Provider、Token 统计和三级测试继续保持独立。
- Claude Code 底层实现仍保留，但 1.3.0 默认通过 Feature Flag 隐藏入口，待链路完善后再开放。

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

仓库首页只保留必要入口和配置，具体实现按职责归档：

```text
Antigravity-Chinese/
├─ src/                    AGY Hub 业务与运行时模块
│  └─ marketplace/         MCP / Skill 市场模块
├─ tests/                  自动化测试
├─ scripts/                构建、Smoke 与维护脚本
├─ assets/                 图标、主题与发布补丁资源
├─ styles/                 页面与组件样式
├─ patch-workbench/        Antigravity 补丁构建与兼容层
├─ community-backend/      社区后端源码
├─ docs/                   架构、维护文档与截图
├─ build/                  Windows 安装器配置
├─ main.js                 Electron 主进程入口
├─ preload.js              安全 IPC 桥
├─ renderer.js             渲染进程入口
├─ index.html              主界面
├─ style.css               主运行时样式
├─ package.json            项目与 electron-builder 配置
├─ LICENSE
└─ README.md
```

历史上的旧 `patch/`、`install.ps1`、`restore.ps1`、`bundle.js` 和 BAT 手动补丁链已从当前主分支移除，避免新旧实现混杂；需要时仍可通过 Git 历史查看。

## 开发

安装依赖：

```powershell
npm install
```

本地启动：

```powershell
.\node_modules\.bin\electron.cmd .
```

运行完整测试：

```powershell
npm test
```

重建并验证 Antigravity 补丁：

```powershell
npm run patch:rebuild
npm run patch:verify
```

构建 Windows 安装包：

```powershell
npm run release:build
```

本机开发者如需同步构建结果到自己的运行目录，可使用项目中的 `scripts/sync-d.js` 或自行调整同步目标。

## 测试与发布门禁

当前 1.3.0 基线已通过：

- **218 项自动化测试**；
- **0 项失败**；
- 3 项真实 MCP live 测试依赖外部环境，按设计跳过；
- Electron 31.7.7 `--dir` 打包验证通过；
- 打包后的 `app.asar` 已确认包含 `src/`、渲染入口和补丁兼容模块。

正式发布前建议至少执行：

```powershell
npm run patch:rebuild
npm run patch:verify
npm test
```

## 发布文件

1.3.0 Release 使用：

- `agy-hub-setup-1.3.0.exe`
- `agy-hub-setup-1.3.0.exe.blockmap`
- `latest.yml`

自动更新目标：`3169657175/Antigravity-Chinese`。

## 安全说明

- 本项目不是 Google、OpenAI 或 Anthropic 的官方产品。
- 不要公开 API Key、Refresh Token、账号存档或未脱敏日志。
- 本地网关默认只监听 `127.0.0.1`，不要直接改成公网监听。
- Antigravity 官方更新后，应先重新执行兼容构建与验证，再进行注入。
- 第三方模型中转服务的隐私和账号风险由使用者自行评估。

## License

AGY Hub 源码按仓库中的 [MIT License](LICENSE) 发布。
