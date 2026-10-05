# 汉化词库与中文活动提示

2026-10-04：汉化通过 `patch-workbench/localization.js` 合成到官方版本的 preload 中；不修改官方渲染组件，也不改模型生成的思考正文。应用户要求移除侧边活动卡片、活动回调和计时器；对话内原有状态标签继续汉化。

## 修改入口

- `patch-workbench/locales/zh-CN.json` 是新增和修正翻译的入口。`messages` 用于整句/完整片段；`templates` 是有起止锚点的数字模板；`fragments` 仅用于已识别的指导语上下文。
- 原有载荷的 exact 字典及动态规则仍被接入，但禁止把 `of` 等任意词全局替换。`preload-footer.js` 中的后续词条不再自动参与构建，应统一写入 JSON。
- `translation-enhancement.js` 管理索引、缓存、上下文、增量 DOM 观察、Shadow DOM、输入/代码/正文保护与原文留存。词库修正后可重新翻译已显示的文字和属性。
- 官方活动数量 IPC 保持原样，不再挂接额外卡片或界面活动监听。
- `native-localization.js` 在主进程处理原生菜单和对话框的显示字段；保留按钮顺序、取消项、返回值、窗口对象、文件路径、菜单 ID、快捷键与回调。

## 安装资源审计

本轮读取了当前 Antigravity 2.19.1 安装目录。桌面外壳位于 `resources/app.asar`，真正的网页界面则内嵌在 `resources/bin/language_server.exe` 的 ZIP 中；已发现 304 个资源，其中 `main.js` 为 9,623,670 字节，并与正在运行的客户端提供的静态脚本逐字节核对一致。另读取了内置技能元信息及官方插件市场缓存中的公开说明。

新增词库现为 2,866 条，覆盖设置、权限、MCP、插件市场、内置技能说明、任务计划、工具状态、对话操作和文件预览。模型公告还包含后台动态数据，因此新增了限定格式的模型版本、停用通知、合法日期及词元用量规则。保留品牌、模型名称、命令、路径、技能标识和模型思考正文。

`audit-localization.js` 可重复扫描后续版本，输出文件哈希、候选文案、源码上下文、当前译文和待审查项。它是只读工具，不采集对话数据库、账号密码或令牌，不把候选项自动改写成代码。候选项仍可能包含库内部提示、开发者界面或产品名，不能把候选数量当成界面漏译数量。

```powershell
npm run localization:audit -- --root 'C:\Users\niu\AppData\Local\Programs\antigravity' --out '.codex-stage\localization-audit\next-version'
```

默认使用已安装的 `@babel/parser`；没有解析器时提供保守的字面量扫描。可通过 `--parser` 或 `BABEL_BUNDLE_PATH` 指定现有 Babel parser / Playwright Babel bundle，启用 AST 上下文分析，无需安装生产依赖。本轮报告使用 AST 模式。默认同时读取 `~/.gemini/antigravity/builtin/skills`、`cache/marketplaces/*/marketplace.json`，以及相邻 `~/.gemini/config/plugins/*/plugin.json` 中的显示名称和说明，可通过 `--dataRoot` 指定数据目录。

## 词库热更新

AGY Hub 启动时将安装资源 `resources/patch/zh-CN.json` 的路径写入原有 `agy-hub-integration.json`，保留其他设置。注入后的客户端在窗口获得焦点时读取词库变化，不需要再次生成 ASAR。

实际客户端使用 `contextIsolation: true` 的沙盒 preload，不能直接 `require('fs')`。词库热更新通过 `agy:i18n:catalog` 通道由主进程读取固定配置路径，只允许本机界面请求，返回经过校验的翻译数据；不开放任意路径读取，不返回账号、令牌或配置对象。Node 开发验证环境保留直接读取文件的后备路径。

用户可选词库为 `%APPDATA%/Antigravity/agy-translations.zh-CN.json`，格式可以是普通原文到中文的对象，也可以是 `{ "messages": { ... } }`。只接受有限长度的字符串数据，不接受可执行脚本；损坏文件不覆盖已加载的有效译文。热更新仅处理 `messages`，模板和执行代码变化仍需重建并重新注入。

已知词条可以复用；全新功能的未知句子仍需要补充译文。不存在无需词库/翻译服务就能准确翻译任意模型正文的能力。本次用户选择只显示中文状态、保留英文思考原文，不自动调用翻译模型。

## 验证与交付

1. `node --test translationEnhancement.test.js translationCatalog.test.js activityFeedback.test.js nativeLocalization.test.js localizationAudit.test.js`
2. `node smoke-localization.cjs` 验证拆分句、任意数字、属性、受保护文本、动态节点、Shadow DOM、热更新、中文状态及活动卡片已移除。
3. `npm run patch:rebuild`、`npm run patch:verify`、`npm test` 和 `node releaseGuard.js`。设置 `LOCALIZATION_PATCH_ASAR=assets/app.asar` 可让 smoke 直接验证构建包中的脚本。
4. 同步安装资源时须包含兼容构建模块、引擎、词库以及外部词库。保留上一版，核对源码补丁/安装补丁 SHA-256。AGY Hub 正在运行时只暂存，禁止强制退出或覆盖运行中的归档。

浏览器 smoke 是离线夹具，不代表已经在用户账号和当前在线会话中验收；实际生效需要从更新后的 AGY Hub 注入补丁。
