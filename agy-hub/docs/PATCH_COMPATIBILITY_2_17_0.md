# Antigravity 2.17.0 托盘补丁启动故障

核对日期：2026-09-27。

## 原因

安装后的主进程在加载 `dist/tray.js` 时抛出 `ReferenceError: insertTrayMenuItem is not defined`。
官方 2.17.0 在 `createTray` 和 `updateTrayAgentCount` 之间新增了
`insertTrayMenuItem`，用于异步加入 WSL 等托盘菜单。
旧 `buildTray` 从菜单初始化语句一直替换到数量更新函数之前，误删了新增函数，
但保留了模块顶部的导出，因此在模块加载阶段就失败。
旧实现还用载荷替换数量更新函数直至文件末尾，存在丢失未来官方函数的风险。

## 修复

- 只替换菜单初始化的两条语句，插入既有汉化和托盘点击行为。
- 数量更新只替换标签表达式，保留官方函数及模块其余部分。
- 增加带惰性依赖桩的托盘模块加载验证，检查官方导出完整性。
- 合并后的运行时规则再次通过同一检查；发布验证也检查模块加载。
- 2.17 及以后发布验证要求存在 `insertTrayMenuItem` 导出。
- 官方 `tray-2.17.0.js.txt` 是原版测试样本，不参与安装包运行。

## 验证结果

从实际安装文件中只读提取的坏模块可稳定复现同一个异常。
官方 2.17.0 六个模块经过完整兼容合并，四条运行时规则命中，
七个生成模块（含新增 `accountVault.js`）语法通过，托盘模块加载通过。
测试覆盖 WSL 插入、超出菜单长度的位置、初始化前调用、中文标签、
数量更新、单击和双击事件注册、官方后续函数保留，以及坏模块被验证器拒绝。
全量测试：206 项，202 通过，4 项环境相关测试跳过，0 失败。

隔离验证文件位于 `.codex-stage/antigravity-2.17.0-validation/`，
未打包发布，未替换安装文件，未关闭 AGY Hub 或重启 Antigravity。
主进程真实启动及窗口验收尚未执行。

## 应用与恢复

当前 Antigravity 的 `app.asar.original` 和 `app.asar.unpacked.original` 均存在，
且原版包版本为 2.17.0。可通过小助手“还原官方英文原版”恢复相应版本。
需要中文功能时，必须先更新小助手内的兼容生成器，再重新注入；
旧安装版继续注入会重复生成坏托盘模块。
应用阶段应沿用 `patchBackupManager`、Worker 和既有发布检查，
不得将托盘文件修改当成可跳过备份、配对 unpacked、哈希验证的理由。
依据根目录 `AGENTS.md`，注入、重启和发布打包需要用户明确要求。

## D 盘安装版已更新（2026-09-27）

用户明确要求直接修改 `D:\ang\agy-hub` 后，已替换：

- `resources/app.asar`：只更新 `patch-workbench/compatibility.js` 和
  `patchWorker.js`，其余 425 个文件逐一比较完全一致。
- `resources/patch/app.asar`：以当前官方 2.17.0 为基线重建并通过发布校验。
- `resources/patch/patch-manifest.json`：版本和 SHA-256 与新补丁匹配。

Worker 对预构建补丁也执行托盘模块加载检查，并要求 2.17+ 的菜单插入导出；
不再只对动态生成的补丁进行这一检查。
语言服务器验证允许官方 options 增加字段，同时要求保留 2.17 的 `wsl` 字段。
全量测试使用真实 2.17.0 底包在隔离目录模拟 Worker 注入：
207 项，204 通过，3 项环境相关跳过，0 失败。

安装包 SHA-256：
`fe81e8719bd8c6a2b450d3c9c955151f9d6a2911ff236b7712ae228db6688dba`。
源码和 D 盘离线补丁 SHA-256 一致：
`91c21864fc0e2c7635f8acdd74ecfe75dfd8822404088fee733ffbb4481511df`。
原版和旧安装资源完整备份位于：
`D:\ang\agy-hub\upgrade-backups\antigravity-2.17.0-2026-09-27T10-56-23-564Z`。

替换时确认 AGY Hub 未运行，没有关闭任何进程。
没有改写或重启 C 盘的 Antigravity，用户需打开更新后的小助手再执行注入。
尚未执行真实 Antigravity 窗口启动验收。
