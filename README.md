# AGY Hub 桌面管家

![Electron](https://img.shields.io/badge/Electron-31.x-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Release](https://img.shields.io/badge/AGY%20Hub-1.3.5-0A7D5A.svg)
![Antigravity](https://img.shields.io/badge/Antigravity-2.19.1-5B5BD6.svg)

AGY Hub 是面向 Windows 版 Google Antigravity 的本地桌面管家，把汉化补丁、账号与额度、Codex / 自定义 Provider 接入、Token 统计、主题、MCP / Skill、社区与更新能力集中到一个 Electron 应用中。

当前源码基线已经与本机实际运行版本 `D:\ang\agy-hub\resources\app.asar` 对齐；Antigravity 汉化补丁构建基线为 **2.19.1**。

## 1.3.5 重点更新

- 注入链路恢复到 1.3.0 已验证的稳定实现，同时保留 Antigravity 2.19.1 的当前兼容补丁。
- 账号切换不再单独强杀 `language_server.exe`，避免连续触发 Language Server 崩溃计数。
- Skill 市场同步支持 GitHub Raw、jsDelivr 与 GitHub API 多源回退；简介翻译与 Antigravity 运行态隔离，并支持失败降级。
- 更新链统一到 `3169657175/Antigravity-Chinese`，当前 Release 使用 `1.3.5` / `v1.3.5` 标签。
- Windows 自动更新关闭 blockmap 差分下载，改为完整安装包单次下载，保留 SHA512 校验、进度与自动安装。
- Claude Code 入口改由 Feature Flag 控制，默认隐藏，底层实现继续保留。
- 社区反馈、回复、点赞和删除改为本地乐观更新，失败自动回滚；搜索只做本地过滤，不再重复闪骨架屏。
- 社区 GET 支持可配置备用 HTTPS 源与最后成功数据缓存；写操作绝不自动重放到备用源。
- 反代、社区、市场等重型页面改为首次打开时再加载。
- 新增统一 Toast / 确认框 / 错误诊断和 Release Guard，避免版本、仓库、安装包再次分叉。

## 主要能力

- **汉化补丁与安全回退**：基于当前官方 `app.asar` 构建兼容补丁，支持注入、退回上一版汉化和恢复官方英文原版。
- **本地账号与额度**：读取 Antigravity 本地账号，展示额度、状态与重置时间，并提供账号切换和异常分类。
- **Codex 接入**：本地 `127.0.0.1:8046` 提供 OpenAI Responses 兼容接口，支持流式输出、工具调用、长上下文与模型映射。
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
| `C:\Users\niu\.gemini\antigravity\scratch\agy-hub` | 正式开发源码，后续修改的唯一基准 |
| `D:\ang\agy-hub` | 已构建应用的实际安装 / 运行目录，不应直接作为长期开发目录 |
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
├─ assets/                         图标、主题和发布用补丁资源
├─ docs/                           架构、维护与兼容文档
└─ *.test.js                       Node.js 自动化测试
```

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
.\node_modules\.bin\electron-builder.cmd
```

需要同时同步到 `D:\ang\agy-hub` 时才执行：

```powershell
npm run dist:sync
```

不要为了构建或测试强制关闭正在运行的 AGY Hub，也不要在未明确要求时自动注入或重启 Antigravity。

## 发布产物

正式 Release 使用以下三个核心文件：

```text
agy-hub-setup-1.3.5.exe
agy-hub-setup-1.3.5.exe.blockmap
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