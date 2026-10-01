# AGY Hub 综合评估与改进建议

> 评估日期：2026-07-26  
> 评估对象：AGY Hub 1.1.9 当前源码  
> 评估方式：源码结构、关键业务流程、配置写入、测试资产和发布流程静态审查

## 一、结论先说

AGY Hub 已经不是“简单的小助手”，而是一个功能相当完整的 Windows AI 工具控制台。它最有价值的部分，是把 Antigravity 账号与额度、Codex/Claude 接入、本地协议转换、Token 统计、汉化补丁和主题管理串成了闭环。

目前真正限制它继续成长的，不是功能数量不足，而是以下四件事：

1. **核心卖点过多，用户第一眼不知道它究竟最擅长什么。**
2. **核心代码集中在少数巨型文件里，改一个页面或路由容易产生跨功能回归。**
3. **Codex、Claude Code、自定义 Provider 共用一个网关实例和部分持久化状态，隔离还不够彻底。**
4. **缺少让陌生用户放心安装的工程信任体系：代码签名、隐私说明、诊断导出、CI、清晰文档和可复现发布。**

以个人项目标准看，它的功能完成度很高；以面向公众的软件标准看，当前重点应该从“继续加功能”切换到“可靠性、可解释性和信任建设”。

## 二、综合指标

| 维度 | 评分 | 判断 |
|---|---:|---|
| 功能完整度 | 8.5 / 10 | 已形成汉化、账号、反代、监控、主题、扩展、更新闭环 |
| 差异化 | 8.0 / 10 | Antigravity → Codex/Claude 的一体化 GUI 接入具有明显辨识度 |
| 易用性 | 6.5 / 10 | 熟悉 AI 工具的用户能用，新用户仍会被端口、Provider、模型映射等概念劝退 |
| 稳定性 | 6.5 / 10 | 测试资产不错，但真实上游、长对话和跨客户端共享状态仍是高风险区 |
| 可维护性 | 4.5 / 10 | 巨型主进程、渲染文件和 CSS 已成为主要瓶颈 |
| 安全与隐私 | 5.5 / 10 | 本地监听和备份意识较好，但多个 Key 明文持久化，缺少完整威胁模型 |
| 可观测性 | 6.0 / 10 | 有终端反馈和网关日志，但缺少统一请求 ID、诊断包和用户可理解的故障分层 |
| 发布成熟度 | 5.0 / 10 | 有自动更新和三件套构建，但缺少 CI、签名、CHANGELOG、LICENSE 文件和可复现说明 |
| 市场吸引力 | 6.5 / 10 | 产品有价值，但定位、首屏表达、演示素材和信任门槛影响转化 |

这些评分是工程判断，不是自动化测量结果。它们用于确定优先级，而不是作为质量认证。

## 三、当前做得好的地方

### 1. 产品已经形成真实闭环

很多同类个人工具只能“改配置”或“开一个代理”。AGY Hub 已覆盖：发现账号 → 查看额度 → 选择模型 → 测试 → 接入客户端 → 记录 Token → 出错诊断 → 恢复配置。这个业务闭环是项目最强的资产。

### 2. 对客户端配置破坏的防范意识较强

`codexConfig.js` 和 `claudeDesktopConfig.js` 都实现了首次接入备份与恢复；Claude 还同时考虑普通配置、3P 配置库和注册表策略。补丁工作台也保留稳定基线、构建报告和验证报告。这些设计比普通个人项目成熟。

### 3. 对长对话和工具历史做了针对性修复

`codexGateway.js` 已包含历史 ID 清洗、工具调用缓存、压缩请求优化、本地紧急摘要、SSE 转换、断流前安全重试和上游错误分类。这说明项目不是只支持简单问答，而是在解决真实的 Agent 长对话问题。

### 4. 已经有一定测试基础

当前有 13 个测试文件，静态可见约 92 个普通测试用例，覆盖网关、Anthropic 转换、Claude 配置/生命周期、Codex 生命周期、模型路由、Token、MCP、导航性能、路由隔离和更新文本。对个人 Electron 项目而言，这是明显优点。

### 5. 本地安全边界基本正确

8046 网关默认只监听 `127.0.0.1`，Electron 开启 `contextIsolation`、关闭 `nodeIntegration`，账号 refresh token 只在主进程通过系统安全存储解密。这些基础方向是正确的。

## 四、需要优先解决的问题

## P0：直接影响可靠性和用户数据安全

### P0-1. 网关仍是“一个实例、一份活动配置”

证据：`CodexGateway` 只维护一个 `this.config`，其中同时包含 `mode`、`accountId`、`model`、`claudeModel`、`customBaseUrl`、`customApiKey` 和 `customModels`；`/v1/models` 与 `/v1/responses` 会根据全局 `mode` 决定是 Antigravity 还是自定义 Provider。

目前测试请求已经通过 `probeUpstream()` 做快照恢复，这是正确修复，但它只解决“测试误改配置”。当用户真正接入自定义 Provider、Codex Antigravity 和 Claude Code 时，仍然存在共享端口、共享本地 Key、共享账号默认值和共享活动模式。

建议目标：

- 将路由配置拆为 `codexAntigravity`、`codexCustom`、`claudeAntigravity` 三个 profile。
- 请求到达后按路径和客户端身份选择 profile，而不是先读一个全局 `mode`。
- 各 profile 独立保存账号、默认模型、模型控制权、fallback 和健康状态。
- “测试”使用不可持久化的 request-scoped 配置。

预期收益：避免“在一个页面点击测试/接入，另一个客户端突然 401、502 或模型变化”。

### P0-2. 敏感 Key 明文持久化

证据：

- `codex-gateway.json` 保存 `apiKey` 和 `customApiKey`。
- `codex-provider-profiles.json` 保存 Provider `apiKey`。
- Codex 的 `auth.json` / `config.toml` 需要保存本地网关 Key。
- Claude 的 profile 和 HKCU 托管策略需要保存网关 Key。

客户端配置里保存本地 Key有协议上的必要性，但第三方 Provider 的真实 Key不应在多个 JSON 中重复明文保存。

建议：

- 使用 Electron `safeStorage` 加密自定义 Provider Key，配置文件只保存密文和版本。
- 本地 8046 Key和上游 Provider Key分开，前者可轮换，后者永不返回渲染进程明文。
- UI 只显示末四位和“已保存”状态。
- 增加“清除所有凭据”和“轮换本地 Key”操作。

### P0-3. 上游依赖缺少明确的兼容层版本

项目依赖 Antigravity Cloud Code 的内部端点、事件结构、模型 ID 和工具 schema 行为。上游只要改变模型名称、配额接口、SSE 事件或 JSON Schema 限制，就可能出现“Antigravity 客户端能用，但 AGY Hub 测试失败”。

建议：

- 为每种上游响应保存脱敏的 golden fixture。
- 启动时执行轻量 capability discovery，区分“模型不存在”“账号无额度”“schema 不兼容”“上游临时失败”。
- 建立适配器版本，例如 `cloudCodeAdapter/v1`，避免转换逻辑散落在一个文件中。
- 对实验模型标注“实验性”，不能加入默认自动路由，除非通过能力探测。

### P0-4. 补丁发布和应用发布仍可能混淆

AGY Hub 自身应用与 Antigravity 的 `app.asar` 补丁是两套发布物。历史上多次发生“改了小助手但没有更新源包”“改了补丁但没有注入”“桌面运行目录不是最新”的混淆。

建议把版本拆成：

- `appVersion`：AGY Hub 安装包版本。
- `patchVersion`：Antigravity 汉化补丁版本。
- `targetAntigravityVersion`：适配的客户端版本。
- `patchSha256`：内置源包哈希。

在“关于/诊断”页同时显示四者和当前运行路径。

## P1：影响迭代速度和长期质量

### P1-1. 四个巨型文件是主要回归来源

当前体积大致为：

- `renderer.js`：约 251 KB。
- `style.css`：约 132 KB。
- `main.js`：约 112 KB。
- `codexGateway.js`：约 81 KB。
- `index.html`：约 74 KB。

这些文件分别承担过多职责。页面卡顿、界面消失、样式空白、测试改变路由、汉化反复好坏等问题，很多都与这种高耦合结构有关。

建议保持 Electron 模块化单体，不需要上微服务或复杂框架，但应逐步拆分：

```text
src/
  main/
    ipc/
      accounts.js
      gateway.js
      patch.js
      themes.js
      updates.js
    services/
  gateway/
    responses/
    anthropic/
    upstream/
    profiles/
  renderer/
    pages/
      accounts/
      gateway/
      token-usage/
      themes/
    shared/
  styles/
    tokens.css
    layout.css
    pages/
```

拆分应按测试保护逐块迁移，不能一次性重写。

### P1-2. 前端是全局 DOM 和全局状态模式

`renderer.js` 在一个文件里缓存大量 DOM、注册全部页面事件、管理多个页面分页和网络请求。一个 ID 改名或初始化异常可能让后续整个脚本停止，表现为“四个界面一起消失”。

建议：

- 每个页面有独立 `mount()` / `unmount()` 或惰性 `ensureInitialized()`。
- 页面异常由局部 error boundary 捕获并显示，不影响其他导航页。
- 数据请求与 DOM 渲染分开。
- 用统一状态机表达 `idle / testing / connecting / connected / error`，不再由按钮文本临时推断状态。

### P1-3. 主进程同时承担业务逻辑和 IPC 编排

`main.js` 中有主题、MCP、Skill、账号、OAuth、反馈、补丁、自动更新和客户端接入的大量实现。IPC handler 很难独立测试，错误处理也不一致。

建议让 `main.js` 只负责应用生命周期和注册 handler，业务移入 service。IPC 统一返回：

```json
{
  "success": false,
  "code": "UPSTREAM_SCHEMA_REJECTED",
  "message": "给用户看的中文说明",
  "details": "已脱敏的诊断信息",
  "retryable": false,
  "requestId": "..."
}
```

### P1-4. 测试入口与文档不完整

已确认的问题：

- README 写了 `npm start`，但 `package.json` 没有 `start`。
- 没有统一的 `npm test`，现有脚本只列出三组测试，容易漏跑其余测试。
- README 链接 `LICENSE`，当前源码根目录没有该文件。
- 没有 `.github/workflows`、CHANGELOG、正式 `docs/` 和 LICENSE 文件；虽然已经有 `.gitignore`，但工程文档与发布治理仍不完整。

建议先完成最小工程治理：补 `start`、`test`、`test:smoke`、CI、LICENSE、CHANGELOG、gitignore 和发布校验脚本。

### P1-5. 缺少统一诊断中心

现在有页面终端、状态卡和 `codex-gateway.log`，但普通用户遇到错误时仍只能发截图。截图经常缺少请求路径、活动 profile、模型映射、上游状态和配置实际写入位置。

建议增加“一键复制诊断报告”，默认脱敏，包含：

- 应用/补丁/目标客户端版本。
- 真实运行目录和 userData 目录。
- 8046 监听状态、网关 profile、请求路径和最近 request ID。
- Codex/Claude 配置是否存在、是否由 AGY Hub 管理、备份是否可恢复。
- 账号 ID 哈希、模型 ID、上游 HTTP 状态、错误分类。
- 最近 50 条结构化日志，但不含 Key、Token 和完整对话。

## P2：影响体验、传播和用户增长

### P2-1. 新用户缺少三分钟上手流程

当前导航同时展示汉化、账号、反代、主题、MCP、Skill、反馈和管理功能，第一次打开的人不知道先做什么。

建议增加“首次使用向导”：

1. 检测 Antigravity / Codex / Claude 是否安装。
2. 检测本地账号和额度。
3. 让用户选择目标：只汉化、接入 Codex、接入 Claude、只看额度。
4. 自动完成最少步骤并进行真实验证。
5. 成功后再引导主题、MCP、Skill 等高级功能。

### P2-2. 产品定位需要收束

对外宣传不应平铺所有功能。推荐主定位：

> **把 Antigravity 的账号与模型能力，一键接入 Codex 和 Claude Code，并可视化管理额度与 Token。**

汉化、主题、MCP、Skill 是增强卖点，而不是首句里并列的八项功能。这样用户更容易立刻理解“为什么要下载”。

### P2-3. “测试成功”和“真实可用”之间缺少解释

用户多次遇到小助手测试成功，但客户端实际报错。原因可能是测试负载过小、客户端会发送复杂工具 schema、长对话历史或不同模型别名。

建议把测试分三级：

- **网络检查**：端口和鉴权。
- **模型检查**：最小文本请求。
- **客户端兼容检查**：带工具 schema、流式输出和多轮历史的协议测试。

UI 应显示通过了哪一级，不能统一写“测试成功”。

### P2-4. 社区和管理员功能不应干扰核心桌面工具

反馈、用户管理、公告发布直接嵌入桌面客户端，增加了远程 API、登录态和管理权限的复杂度。对普通用户而言，这些不是核心流程。

建议：

- 普通客户端只保留反馈和公告读取。
- 用户管理、公告发布移动到独立 Web 管理后台或至少只在管理员模式加载。
- 远程 API 基址统一配置，不要同时散落在 `main.js` 和 `renderer.js`。

### P2-5. Windows 信任门槛仍然较高

面向公众分发的未签名 Electron 安装包容易触发 SmartScreen 或杀毒软件警告。再加上软件会改 `~/.codex`、Claude 注册表和 Antigravity `app.asar`，陌生用户天然会担心安全。

建议提供：

- 代码签名。
- 发布文件 SHA-256。
- “软件会修改哪些文件”的透明清单。
- 隐私政策和本地数据说明。
- 可复现构建或至少 GitHub Actions 自动构建。
- 每次写配置前的差异预览与一键恢复。

## 五、推荐的实施顺序

### 第一阶段：稳定性冲刺（优先于加新功能）

1. 将 Codex Antigravity、Codex Custom、Claude Antigravity 拆为独立路由 profile。
2. 给所有测试操作增加配置指纹断言，保证前后完全一致。
3. 建立三级连接测试和统一错误码。
4. 加入脱敏诊断包和真实配置落盘检查。
5. 用 `safeStorage` 加密自定义 Provider Key。

### 第二阶段：工程治理

1. 从 `main.js` 抽出 IPC/service。
2. 从 `renderer.js` 拆出页面模块和状态机。
3. 从 `codexGateway.js` 拆出协议适配器、上游客户端、路由 profile 和日志。
4. 补齐 `npm start`、`npm test`、CI、LICENSE、CHANGELOG、gitignore。
5. 为上游协议保存脱敏 fixture，增加故障注入测试。

### 第三阶段：用户增长

1. 三分钟首次使用向导。
2. 首页只突出“接入 Codex / 接入 Claude / 查看额度”三个入口。
3. 制作真实端到端演示 GIF 和一分钟视频。
4. README 首屏增加兼容矩阵、风险说明、恢复方式和下载入口。
5. 把管理员功能从普通用户主流程中降级或拆出。

## 六、建议暂时不要做的事情

- 不要改成微服务：本地单用户 Electron 应用不需要分布式复杂度。
- 不要一次性换 React/Vue 并重写全部 UI：当前回归风险太高，应先模块化再决定框架。
- 不要继续增加更多模型名称而没有能力探测和契约测试。
- 不要开放 8046 到局域网/公网而没有 TLS、用户鉴权、权限隔离和限流。
- 不要为了“企业级外观”再做一次全局视觉重构；目前更重要的是状态一致、故障可解释和首次使用顺畅。

## 七、成功标准

下一阶段如果能达到以下标准，AGY Hub 会从“功能丰富的个人项目”明显迈向“可公开推荐的软件”：

- Codex、自定义 Provider、Claude Code 同时配置时互不影响。
- 任何测试按钮都不会改变活动路由。
- 长对话、工具调用、压缩和流式断线有可重复测试。
- 用户一键导出的诊断信息足以让 AI 在新对话中定位问题。
- Provider Key 不再明文散落。
- 新用户三分钟内完成第一次真实调用。
- 每个 Release 都由 CI 测试、构建并输出哈希和变更日志。
- 所有配置修改都能在 UI 中看到目标路径、差异和恢复点。

达到这些目标后，再继续扩展模型、市场和主题，收益会比现在单纯增加功能更高。
