# Antigravity 主题资源安全边界

## 接手项目之前

任何 AI 或开发者在修改本项目之前，必须先完整阅读根目录的
[`AI_PROJECT_GUIDE.md`](./AI_PROJECT_GUIDE.md)。该文档记录了当前源码位置、运行目录、
模块职责、配置写入位置、关键业务流程、验证命令和不可破坏的功能边界。

特别注意：

- 不要把工作区顶层的临时 `patch-*.js`、`fix-*.js` 当作正式源码。
- 不要为了验证而关闭正在运行的 AGY Hub；用户可能正在通过它连接 Codex。
- 不要把“测试模型”实现成会改变当前账号、Provider、模型或网关模式的操作。
- Codex、Claude Code、自定义 Provider 与 Antigravity 测试必须保持配置隔离。
- 除非用户明确要求，不要自动注入补丁、重启 Antigravity 或构建发布包。

## 壁纸任务

当用户只要求新增、替换或调整壁纸时：

- 只允许修改对应主题图片、主题清单中的图片文件名/定位参数，以及用户主题配置。
- 禁止修改 `preload.js`、`ipcHandlers.js`、`main.js`、`accountVault.js` 和其他运行时代码。
- 禁止为了单纯换图执行字符串拼接、脚本合并或重新生成 JavaScript 文件。
- 禁止直接覆盖客户端或 AGY Hub 的 `app.asar`。
- 先在外部稳定主题目录和运行时主题缓存中验证图片，再由专门的发布流程更新安装资源。

## 发布门禁

只有用户明确要求发布或重新打包插件时，才允许更新 ASAR。发布前必须：

1. 对 `dist/main.js`、`dist/preload.js`、`dist/ipcHandlers.js` 运行 `node --check`。
2. 确认补丁包包含 `dist/accountVault.js`。
3. 比较源码包、构建包、D 盘注入包的 SHA-256。
4. 保留上一份已验收 ASAR，失败时自动回滚。

任何一步失败都必须停止，不能软放行或覆盖客户端。
