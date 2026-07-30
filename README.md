# Antigravity 中文增强与 AGY Hub

[![Release](https://img.shields.io/github/v/release/3169657175/Antigravity-Chinese?display_name=tag&sort=semver)](https://github.com/3169657175/Antigravity-Chinese/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/3169657175/Antigravity-Chinese/total)](https://github.com/3169657175/Antigravity-Chinese/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-2563eb?logo=windows)](#运行环境)

这是一个面向 Windows 版 Google Antigravity 的中文增强项目。

项目包含两部分：

- **Antigravity 中文与体验优化补丁**：负责界面汉化、主题皮肤、账号与额度组件、托盘和网络体验优化。
- **AGY Hub 桌面管家**：负责补丁注入与回退、账号管理、Codex/Claude Code 接入、Token 监控、MCP/Skill 管理、诊断和在线更新。

推荐普通用户直接安装 AGY Hub。仓库中的 PowerShell 与 BAT 脚本主要用于手动安装、调试和补丁开发。

> 当前 AGY Hub 开发版补丁构建链已适配 Antigravity 2.4.3；公开安装包的支持范围以对应 Release 说明为准。Antigravity 更新后可能改变内部文件结构，请不要把旧补丁强行注入新版本。

<p align="center">
  <img src="https://github.com/user-attachments/assets/6b41253e-5ba3-4a63-80aa-a8cc9f4cfba0" alt="Antigravity 中文主题界面" width="92%">
</p>

## 下载与安装

### 使用 AGY Hub 安装（推荐）

1. 打开 [Releases](https://github.com/3169657175/Antigravity-Chinese/releases/latest)。
2. 下载名称中包含 <code>agy-hub-setup</code> 的 Windows 安装包。
3. 安装并打开 AGY Hub。
4. 进入“汉化注入”，确认识别到的 Antigravity 版本。
5. 点击“一键注入”，完成后重新打开 Antigravity。

README 不写死安装包版本号，实际文件名以最新 Release 附件为准。

### 使用仓库脚本安装

适合需要查看补丁源码或手动控制安装过程的用户。

1. 下载仓库 ZIP 并完整解压。
2. 确保系统已安装 Node.js。
3. 双击 <code>安装汉化与优化补丁.bat</code>，或在 PowerShell 中运行：

~~~powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\install.ps1
~~~

恢复官方版本：

~~~powershell
.\restore.ps1
~~~

也可以直接双击 <code>一键还原官方原版.bat</code>。

## 功能总览

### 中文补丁与安全回退

- 覆盖菜单、设置、引导、账号、权限、额度、项目和常用操作界面。
- 对编辑器、代码块、终端和日志区域做隔离，避免把代码内容误翻译。
- 基于当前官方 <code>app.asar</code> 动态生成兼容补丁，不再长期覆盖一份旧客户端。
- 注入前验证补丁结构、JavaScript 语法和必要能力。
- 固定保留三个状态：当前版本、上一版汉化补丁、当前官方原版。
- 支持“一键注入”“回退上一版”“恢复官方原版”，不会每次注入生成一批时间戳备份。
- Antigravity 更新后重新读取官方底包，只在兼容层处理发生变化的部分。

### 主题与界面增强

- 内置哆啦 A 梦、蜡笔小新、线条小狗、海贼王、狐妖小红娘等主题。
- 支持导入本地图片作为自定义皮肤。
- 主题背景、磨砂层、侧边栏、卡片、输入区和选中状态保持统一。
- 针对 Antigravity 2.4.3 的侧边栏结构变化提供兼容适配。
- 自定义主题可同时出现在 AGY Hub 和 Antigravity 的主题列表中。

<p align="center">
  <img src="https://github.com/user-attachments/assets/c28cde51-ab98-4a4b-b2b4-8a23908795af" alt="Antigravity 设置界面主题效果" width="92%">
</p>

### 本地账号与额度

- 自动识别 Antigravity 本地登录账号。
- 支持账号保存、切换、导入、导出和状态检查。
- 凭据使用 Electron Safe Storage 保护，并兼容旧存档迁移。
- 分别展示 Gemini 与 Claude 的额度和重置时间。
- 账号授权失效时显示可理解的重新登录提示，不直接暴露接口 JSON。
- 本地账号 Token 记录按每页 20 条分页。
- 活跃和后台状态使用不同刷新频率，降低无意义请求。

### Codex 接入

- 将 Antigravity 模型接入 Codex，支持 OpenAI Responses 与流式输出。
- 支持 Gemini、Claude 等 Antigravity 可用模型。
- 可以切换账号、查看额度并选择实际模型。
- 支持自定义 OpenAI 兼容 Provider，例如 Sub2API。
- 自定义 Provider 与 Antigravity Provider 相互隔离，测试模型不会改变当前已连接线路。
- 修复工具调用历史、重复输出、长对话 ID 和兼容性问题。
- 长对话达到阈值时支持压缩请求和本地恢复摘要。
- Gemini 思考内容可转换为 Codex reasoning summary 事件。

### Claude Code 与 Claude Desktop 接入

- 提供 Anthropic Messages 与 <code>count_tokens</code> 兼容接口。
- Claude Code 可以显示模型列表并选择 Antigravity 中的真实模型。
- 对外使用 Claude 兼容别名，转发时恢复为用户选择的真实 Gemini/Claude 模型。
- 支持账号切换、额度查看、模型路由和连接状态检测。
- 接入后可以自动启动或重启 Claude Desktop。
- 写入真实的 Claude Desktop 配置和 Windows 托管配置，不只修改界面显示。
- Codex 与 Claude 使用独立账号、模型和连接状态。

### 三路反代配置隔离

AGY Hub 分别保存和管理：

1. Codex 使用 Antigravity；
2. Codex 使用自定义 Provider；
3. Claude Code/Claude Desktop 使用 Antigravity。

每条线路拥有独立的账号、模型、测试状态和连接状态。点击“测试”只验证草稿配置，只有明确点击“接入”才会改变正在使用的路由。

~~~mermaid
flowchart LR
    C[Codex] -->|Responses API| G[AGY Hub 127.0.0.1:8046]
    D[Claude Code / Desktop] -->|Anthropic Messages| G
    G --> A[Antigravity / Cloud Code]
    G --> S[自定义 Provider / Sub2API]
    A --> M[Gemini 与 Claude 模型]
    S --> U[自定义渠道与模型]
~~~

### 三级测试与诊断报告

反代接入按层检查：

1. **配置层**：地址、端口、密钥、模型和本地配置；
2. **连接层**：本地服务、模型接口和上游连通性；
3. **真实调用层**：使用目标协议完成一次最小模型请求。

一键诊断报告会汇总当前线路、本地端口、配置写入结果、上游连通性、最近路由日志、补丁版本和处理建议。报告会隐藏 API Key、Token、账号 ID 和对话内容。

### Token 与缓存监控

- 分别统计本地 Antigravity 与反代请求。
- 展示输入、输出、总 Token、缓存读取量和缓存命中率。
- 区分上游返回的官方数据与本地估算数据。
- 支持 JSON、SSE、protobuf 和 gRPC protobuf 中的 UsageMetadata。
- 日、周、月及明细视图使用分页和增量存储。
- Token 日志不会把普通 Cloud Code POST 请求误判为模型生成。

### MCP 与 Skill 市场

- 展示可用 MCP 和 Skill，并提供分类、序号、搜索和分页。
- 页面根据窗口尺寸重新计算布局。
- Skill 英文简介支持按内容哈希缓存的增量中文翻译。
- 新增或变化的简介会重新进入待翻译状态。
- MCP 安装前检查命令、包名和固定版本，拒绝危险或不可审计的启动参数。
- 支持配置检查和显式深度握手，避免页面长期停留在“正在启动并执行握手”。

### 社区、更新与运行反馈

- AGY Hub 内置公告、反馈和问题提交入口。
- 更新说明会清理 HTML 标签并保留基本段落结构。
- 支持 GitHub Release 更新检查、下载安装和安全退出。
- 长时间操作在全局区域显示进度。
- 测试、接入、注入和诊断使用可覆盖的页面内反馈，减少连续弹窗。

## 自定义 Sub2API

如果已经通过 Docker 运行 Sub2API，可以在 AGY Hub 的“自定义 Provider”中填写它提供的 OpenAI 兼容地址、API Key 和模型名。

常见本地地址示例：

~~~text
http://127.0.0.1:8080/v1
~~~

AGY Hub 的本地网关通常监听：

~~~text
http://127.0.0.1:8046
~~~

- <code>8080</code> 是 Sub2API 自己的上游兼容接口；
- <code>8046</code> 是 AGY Hub 提供给 Codex 和 Claude Code 的本地统一入口。

只点击“测试”不会切换当前线路。确认测试通过后，需要点击“接入”才会写入 Codex 配置。

## 操作边界

| 操作 | 会做什么 | 会不会改变当前使用线路 |
|---|---|---|
| 测试模型 | 使用当前表单做只读探测 | 不会 |
| 接入 Codex | 写入 Codex Provider 与模型目录 | 会 |
| 接入 Claude | 写入 Claude 配置并准备本地网关 | 会 |
| 一键注入 | 修改 Antigravity 的补丁文件 | 与反代线路无关 |
| 回退上一版 | 恢复上一份汉化补丁 | 与反代线路无关 |
| 恢复官方原版 | 恢复当前客户端对应的官方文件 | 与反代线路无关 |

## 运行环境

| 项目 | 支持情况 |
|---|---|
| Windows 10/11 | 支持 |
| Antigravity 2.4.3 | 当前 AGY Hub 开发版兼容构建已适配 |
| Antigravity 后续版本 | 需要先通过兼容构建与真实注入验证 |
| Codex | 支持 Responses 接入 |
| Claude Code / Claude Desktop | 支持 Anthropic Messages 接入 |
| 自定义 OpenAI 兼容服务 | 支持，例如 Sub2API |
| macOS / Linux | 当前未提供完整安装和注入支持 |

## 常见问题

### Antigravity 更新后还能直接注入吗？

不要直接沿用旧补丁。AGY Hub 会读取当前官方 <code>app.asar</code> 并生成兼容补丁；如果官方结构变化导致规则失效，验证阶段会阻止安装。

### 测试成功，Codex 或 Claude 仍然报错怎么办？

“测试成功”只代表指定测试层通过。先确认是否已经点击“接入”，再运行三级测试或导出诊断报告。长对话、工具调用和普通短测试使用的请求结构不同。

### 为什么会出现 502？

502 可能来自上游容量、地区限制、模型下线、请求格式、工具历史或临时网络波动。AGY Hub 会尽量把错误分类为可重试、需要更换模型、需要重新授权或历史不兼容。

### 需要开启 TUN 模式吗？

补丁支持把代理环境传递给 Antigravity 的语言服务，大多数情况下不要求开启全局 TUN。实际效果取决于使用的代理软件和网络环境。

### 数据会上传到项目服务器吗？

账号凭据、Token 统计和本地配置默认保存在本机。社区反馈、更新检查以及主动配置的模型上游会产生网络请求。分享诊断报告前仍建议人工检查。

## 仓库结构

~~~text
Antigravity-Chinese/
├─ patch/                         Antigravity 补丁源码
│  ├─ locales/                    中文词典
│  ├─ themes/                     内置主题图片
│  ├─ ideInstall/                 安装向导增强
│  ├─ main.js                     主进程增强
│  ├─ preload.js                  渲染进程注入入口
│  ├─ ipcHandlers.js              账号、额度及 IPC
│  └─ languageServer.js           语言服务启动与代理环境
├─ install.ps1                    手动安装脚本
├─ restore.ps1                    官方原版恢复脚本
├─ auto_heal.ps1                  脚本版更新恢复辅助
├─ bundle.js                      沙盒 preload 模块打包器
├─ 安装汉化与优化补丁.bat
└─ 一键还原官方原版.bat
~~~

AGY Hub 桌面管家的完整源码位于：

[3169657175/any-sub](https://github.com/3169657175/any-sub)

桌面管家源码已经按账号、反代、协议转换、Token、MCP、Skill、补丁和主题等领域拆分，并配有自动化测试与维护文档。

## 开发与验证

仓库根目录保留脚本版补丁源码和安装/恢复脚本。AGY Hub 开发与补丁验证请在桌面管家源码仓库中执行：

~~~powershell
npm install
npm test
npm run patch:rebuild
npm run patch:verify
npm run dist:sync
~~~

补丁修改后至少验证：

- Antigravity 可以正常启动，不白屏；
- 登录、账号切换和额度读取正常；
- 内置及自定义主题正常；
- Codex Responses 和 Claude Messages 可以完成真实请求；
- 长对话、工具调用和流式输出正常；
- 回退上一版与恢复官方原版分别可用。

## 安全说明

- 本项目不是 Google、OpenAI 或 Anthropic 的官方产品。
- 注入前请确认客户端版本和补丁支持范围。
- 不要向他人分享 API Key、Refresh Token、账号存档或未脱敏日志。
- 使用第三方模型中转服务时，请自行确认其隐私政策和账号风险。
- 官方客户端更新后，应先保留新的官方原版，再重新生成对应补丁。

## 参与项目

提交 Issue 时建议附上：

- Antigravity 与 AGY Hub 版本；
- 使用的是 Codex、Claude 还是自定义 Provider；
- 三级测试中失败的层级；
- 脱敏后的一键诊断报告；
- 可以稳定复现问题的最短步骤。

请不要在公开 Issue 中粘贴密钥、Token、完整账号 ID 或私人对话内容。

## 致谢

项目在账号管理、界面挂载和客户端增强设计上参考了：

- [BigPizzaV3/CodexPlusPlus](https://github.com/BigPizzaV3/CodexPlusPlus)
- [lbjlaq/Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager)
- [farion1231/cc-switch](https://github.com/farion1231/cc-switch)

感谢所有提交测试结果、错误日志、汉化校对和兼容反馈的使用者。
