# 第二、三阶段结构说明

这两阶段在 2026 年 7 月完成。本文保留仍适用的模块边界，当前维护和发布流程见 [维护指南](MAINTENANCE_GUIDE.md)。

## Skill 增量翻译

`skillTranslationStore.js` 用 Skill ID 与英文简介 SHA-256 缓存翻译。`skillTranslationService.js` 负责提示词、分批和结果解析。`marketplaceController.js` 负责交互与合并，`marketplace/marketplacePresenter.js` 负责文本来源与展示。

已有中文或有效缓存时直接复用，简介变化后才重新排队。后台目录同步不自动消耗模型额度。显式请求的批量限制以服务实现和测试为准。远端简介作为待翻译内容处理。

## 社区边界

调用顺序为页面、`communityController.js`、`preload.js`、`communityIpc.js`、`communityClient.js`。路径、方法与上传在 IPC 中校验，认证信息与网络错误处理留在主进程。`urlPolicy.js` 验证 URL，`safeDom.js` 负责文本转义和图片安全展示。

新增社区操作时同步更新白名单和相应测试。对外接口独立于 Electron 工程，位于公开仓库 `community-backend/`。

## 原子写入与模块管理

- `fsUtils.js` 提供 `writeTextAtomic`、`writeJsonAtomic`、`readJsonSafe`。损坏的 JSON 可保留副本以便恢复。ASAR 注入由 Worker 和备份模块管理自己的事务。
- `navigationController.js` 管理页面导航，页面 Controller 负责具体业务。新增页面脚本时检查 `index.html` 加载顺序、打包白名单和 `runtimeDeps.test.js`。
- `gatewayConfigStore.js` 管理网关配置，`gatewayHttp.js` 负责读取和限制请求体，协议转换由各适配模块处理，自动重试由 `retryPolicy.js` 统一约束。
- Electron 运行时直接载入完整的根 `style.css`。在 `styles/` 维护样式职责，修改后检查根样式和实际页面。
- CI 以仓库 `app/` 为桌面端工作目录，使用 Node 24，并校验补丁和架构边界。安装升级与真实客户端验证采用隔离环境。
