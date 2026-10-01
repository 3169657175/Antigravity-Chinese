# AGY Hub 补丁工作台

本目录维护 Antigravity 一键注入使用的兼容补丁。当前流程不再使用冻结基线、文本翻译规则或 preload 头尾拼接。

## 当前构建模型

```text
当前安装的 Antigravity 官方 app.asar
+ legacy-payload.asar 中的 AGY 必要增量
+ runtime-rules.json 中启用的精确兼容规则
→ assets/app.asar
```

构建始终以当前官方客户端为底包，因此 Antigravity 更新后，应重新基于新官方 `app.asar` 生成，而不是继续覆盖旧版完整 ASAR。

## 关键文件

- `compatibility.js`：把 AGY 的必要能力合并到官方代码树。
- `legacy-payload.asar`：兼容构建所需的增量载荷。当前仍包含历史冗余，后续应缩减为必要文件。
- `runtime-rules.json`：带匹配次数校验的版本适配规则；生产文件只保留已启用、仍需要的规则。
- `build-patch.js`：定位当前官方 `app.asar` 并生成 `assets/app.asar`。
- `verify-patch.js`：校验补丁结构、语法、版本和必要能力。
- `last-build-report.json`、`last-verify-report.json`：最近一次构建与验证报告。
- `injections/preload-footer.js`、`injection-smoke.js`：旧工作台遗留的分析材料，不参与当前标准构建；在增量载荷最小化前暂时保留。

## 构建与验证

在项目根目录执行：

```powershell
npm.cmd run patch:rebuild
npm.cmd run patch:verify
npm.cmd test
```

`patch:rebuild` 默认读取：

```text
%LOCALAPPDATA%\Programs\Antigravity\resources\app.asar
```

也可以显式指定：

```powershell
$env:ANTIGRAVITY_OFFICIAL_ASAR='完整的官方 app.asar 路径'
npm.cmd run patch:rebuild
```

只有 `patch:verify` 输出 `"ok": true` 且自动测试全部通过后，才能注入或打包发布。

## 一键注入的备份边界

注入逻辑由 `patchBackupManager.js` 和 `patchWorker.js` 管理，只维护：

- 当前安装版本；
- 唯一的上一版汉化补丁；
- 唯一的当前官方原版。

不要在补丁工作台创建时间戳 ASAR 备份，也不要把 `app.asar.unpacked` 复制进源包。格式 v2 会保留目标 Antigravity 自己的官方 unpacked 依赖。

## 修改规则

1. 不直接批量改写完整 `assets/app.asar`。
2. 不恢复 `app.asar.baseline_stable`、`translation-rules.json` 或 `patch:baseline` 旧流程。
3. 新的版本适配优先写入 `compatibility.js` 或一条可验证命中次数的 `runtime-rules.json` 规则。
4. 不把禁用规则长期留在生产规则文件；历史原因写入文档。
5. 不替换官方 `app.asar.unpacked`，除非新格式经过独立兼容测试。
6. 每次修改后必须运行补丁验证和完整测试。

## Antigravity 更新后的处理

1. 保留新版本官方 `app.asar`。
2. 执行 `patch:rebuild`。
3. 如果精确规则无法命中，检查官方对应文件结构，再只更新失效的兼容边界。
4. 执行 `patch:verify` 和 `npm.cmd test`。
5. 完成真实注入测试后再生成 AGY Hub 安装包。

这样可以把“官方更新适配”限制在兼容层，而不是每次重新维护一份完整旧客户端。
