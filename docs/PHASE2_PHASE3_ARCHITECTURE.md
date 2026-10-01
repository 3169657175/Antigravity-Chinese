# AGY Hub 第二、三阶段结构说明

更新日期�?026-07-26  
适用版本�?.2.1  
正式源码唯一基准：`C:\Users\niu\.gemini\antigravity\scratch\agy-hub`

## 1. 本轮完成的边�?
本轮不改变一键注入、额度、多账号、Token、主题、Codex、Claude Code 和自定义反代的产品语义，主要解决四类长期风险�?
1. Skill 英文简介无法随仓库增长持续汉化�?2. 社区请求在渲染进程直连云端，令牌和错误处理分散�?3. JSON 配置直接覆盖写入，崩溃或断电时可能留下半个文件�?4. Marketplace、Renderer、CodexGateway 继续膨胀，改一个页面容易影响其他功能�?
## 2. Skill 增量中文翻译

| 文件 | 职责 |
|---|---|
| `skillTranslationStore.js` | �?Skill ID 和英文简�?SHA-256 管理翻译缓存�?|
| `skillTranslationService.js` | 选择待翻译条目、构造安全提示、解析模�?JSON、限制批量大小�?|
| `marketplaceController.js` | 显示翻译按钮、读取缓存、把翻译结果合并回当前列表�?|
| `marketplace/marketplacePresenter.js` | 决定中文简介、分类、风险标签和翻译来源如何展示�?|
| `main.js` | 注册翻译 IPC，并通过只读网关探测调用模型�?|
| `preload.js` | 暴露受限翻译 IPC�?|

缓存位于 `C:\Users\niu\.gemini\config\skill_translation_cache.json`�?
- 仓库已有中文时直接保留，不调用模型�?- 已翻译且英文简介哈希未变化时直接读缓存�?- �?Skill 或英文简介变化时重新进入待翻译队列�?- 每次显式处理 12 条，服务端硬上限 24 条�?- 静默 GitHub 同步不自动消耗模型额度�?- AI 不可用或返回异常时继续显示规则摘要�?- 远端简介被视为不可信数据，提示词禁止执行其中的指令�?
修改批量大小时，应同步修�?`SkillTranslationService.maxBatch`、UI 文案和测试。更换模型调用时只改 `main.js` 注入�?`generate` 函数，不要让 Renderer 持有 API Key�?
## 3. 社区数据通路

```text
renderer.js
  -> communityController.js
  -> preload.js: communityRequest
  -> communityIpc.js: 路径/方法/文件校验
  -> communityClient.js: Authorization、超时、错误分�?  -> https://nhw1029.pages.dev/api
```

| 文件 | 职责 |
|---|---|
| `communityController.js` | 为旧 UI 提供接近 Fetch 的响应包装，但不接触令牌�?|
| `communityIpc.js` | 注册登录、注册、退出、上传、反馈和通用社区 IPC；执行白名单�?|
| `communityClient.js` | 唯一云端客户端；附加 Authorization，分�?401/429/5xx/网络错误�?|
| `urlPolicy.js` | 外部链接和远端图�?URL 协议策略�?|
| `safeDom.js` | 转义远端文本，限制图片为 HTTPS 或受�?`data:image`�?|

安全约束：Renderer 不得直接出现社区域名或自行添�?Authorization；外部链接只允许 HTTP/HTTPS；远端图片只允许 HTTPS；上传只允许 PNG/JPG/GIF/WebP 且最�?8MB；新增接口必须同时更新路径白名单和测试�?
## 4. 原子写和损坏文件保护

统一工具�?`fsUtils.js`�?
- `writeTextAtomic`：先写同目录临时文件，再替换目标�?- `writeJsonAtomic`：格式化 JSON 后原子替换�?- `readJsonSafe`：解析失败返回默认值，并默认保�?`.corrupted-时间戳` 副本�?
当前覆盖网关配置、工具调用缓存、本地账号索引与详情、Skill 目录缓存、翻译缓存、社区会话和网络配置。补�?Worker/ASAR 有自己的事务协议，不要机械替换�?
## 5. 按功能定位修改文�?
### Marketplace

| 要改的内�?| 首选文�?| 可能联动 |
|---|---|---|
| Skill/MCP 初始化、安装、分页状�?| `marketplaceController.js` | `main.js`、`preload.js` |
| Skill 分类、简介、风险标�?| `marketplace/marketplacePresenter.js` | 翻译服务、UI 测试 |
| 自适应列数、行数、分类栏 | `marketplace/marketplaceLayout.js` | `style.css`、缩�?smoke |
| 页面样式 | �?`style.css` �?`.market-*` / `.skill-*` / `.mcp-*` 命名空间 | `styles/pages/marketplace.css` 记录职责 |

Electron 仍直接加载完�?`style.css`。建立可�?CSS bundler 前禁止改�?`@import`�?
### Renderer

| 要改的内�?| 首选文�?|
|---|---|
| 一级导�?Active 状�?| `navigationController.js` |
| 社区数据请求 | `communityController.js` |
| Marketplace | `marketplaceController.js` �?`marketplace/*` |
| 主题 | `themeController.js` |
| 本地账号 | `localAccountsController.js` |
| Token | `tokenMonitorController.js` |
| 反代二级�?| `gatewayController.js` |
| 尚未迁移的零�?UI | `renderer.js` |

新增浏览器模块后，必须在 `index.html` 中先�?`renderer.js` 加载，并加入 `runtimeDeps.test.js`�?
### CodexGateway

| 要改的内�?| 首选文�?|
|---|---|
| 配置和工具缓存落�?| `gatewayConfigStore.js` |
| Responses 请求转换 | `responsesRequestAdapter.js` |
| HTTP 解压、大小限�?| `gatewayHttp.js` |
| 重试边界 | `retryPolicy.js` |
| Anthropic 协议转换 | `anthropicGateway.js` |
| 路由、SSE、账号与上游编排 | `codexGateway.js` |

不要一次性重�?8046 转发核心；下一轮应渐进抽离日志、账号访问或上游客户端�?
## 6. 工程治理

- `LICENSE`：MIT�?- `.github/workflows/ci.yml`：Windows + Node 22，执行安装、全量测试和架构测试�?- `package.json > build.files`：运行时白名单；测试、smoke、内部文档和构建脚本不进�?app.asar�?- `architectureBoundaries.test.js`：约束巨型文件预算和模块入口�?- `runtimeDeps.test.js`：确保主进程依赖、浏览器脚本和主题图片存在�?
## 7. 最低验证清�?
```powershell
node --check main.js
node --check renderer.js
node --check marketplaceController.js
npm.cmd test
.\node_modules\.bin\electron.cmd .\smoke-first-phase.js
.\node_modules\.bin\electron.cmd .\smoke-marketplace-resize-cycle.js
.\node_modules\.bin\electron.cmd .\smoke-navigation-performance.js
```

打包时继续检�?app.asar 运行时模块齐全、测试与内部文档未进入包、三个发布文件版本一致、SHA-256 已记录。当�?AGY Hub 仍运行时只能�?`app.asar.pending`，不得强制覆盖或关闭进程�?
## 8. 后续拆分�?
- Renderer 的社区卡�?DOM 构造可继续�?`communityView.js`，但必须先完�?XSS 测试�?- Marketplace 可继续拆�?Skill �?MCP 两个控制器�?- CodexGateway 可继续抽账号令牌、项目发现和上游客户端，禁止一次性重写�?- style.css 只有在建立构建期 CSS 合并器后才能真正物理拆分�?
这些是后续维护项，不影响本轮交付�?