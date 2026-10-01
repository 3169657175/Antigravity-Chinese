# Antigravity 2.4.3+ 汉化补丁兼容架构

更新时间：2026-07-30

## 目标

解决两个长期问题：

1. Antigravity 更新后，旧版完整 `app.asar` 不能再安全覆盖新客户端。
2. 官方 `app.asar.unpacked` 属于当前客户端版本，不能被小助手中的旧目录替换或删除。

## 当前实现

补丁格式为 `formatVersion: 2`。构建和注入都遵循以下流程：

```text
当前官方 app.asar
  -> 读取 package.json 和 ASAR unpack 元数据
  -> 解包到临时目录
  -> 按语义锚点应用 AGY 增量代码
  -> JavaScript 语法与能力检查
  -> 按官方 unpack 规则重新打包
  -> SHA-256 校验
  -> 备份状态机
  -> 事务替换 app.asar
```

### 文件职责

- `patch-workbench/compatibility.js`：增量合并和锚点唯一性校验。
- `patch-workbench/legacy-payload.asar`：稳定 AGY 功能载荷来源，只用于提取增量代码，绝不直接覆盖客户端。
- `patchRuntimeBuilder.js`：以当前目标客户端为基线现场生成补丁，并保留官方 unpack 元数据。
- `patch-workbench/build-patch.js`：生成随 AGY Hub 发布的当前版本预构建补丁和格式 2 清单。
- `patch-workbench/verify-patch.js`：验证版本、哈希、必需能力、语法、AGY 标记和官方 unpack 标记。
- `patchWorker.js`：预检、必要时动态构建、等待用户确认、备份、事务写入和回滚。
- `patchBackupManager.js`：唯一官方原版与唯一上一版汉化的状态机。

## 版本更新时的行为

- 预构建补丁版本与客户端一致：直接使用已经验证的补丁，速度更快。
- 客户端版本更新：先读取当前官方 `app.asar`，在临时目录动态生成兼容补丁；所有检查通过前不写客户端。
- 关键文件或语义锚点变化：停止注入并显示不兼容原因，不做软放行。
- 当前目标已经是未知版本汉化包：禁止把它当官方基线继续套补丁，要求先恢复同版本官方原版。

## `app.asar.unpacked` 规则

格式 2 清单固定使用：

```json
{
  "unpackedMode": "preserve-official"
}
```

注入只替换 `app.asar`。当前客户端的 `app.asar.unpacked` 保持原样。重打包时会读取官方 ASAR 中标记为 `unpacked` 的路径，使新 ASAR 继续引用同一个官方外置目录。

## 备份规则

Antigravity `resources` 目录长期只保留：

- `app.asar`：当前版本。
- `app.asar.original`：当前客户端版本唯一官方英文原版。
- `app.asar.previous`：当前客户端版本唯一上一版汉化，仅在同版本重复注入时存在。
- 三者对应的 unpacked 目录按实际状态成对管理。

客户端升级后：

1. 旧 `.original` 和 `.previous` 都视为旧版本状态。
2. 用升级后的当前官方文件重新生成唯一 `.original`。
3. 删除旧版本 `.previous`。
4. 禁止把旧版官方或旧版汉化恢复到新客户端。

## 验证命令

```powershell
npm run patch:rebuild
npm run patch:verify
node --test *.test.js
```

关键回归：

- `patchCompatibility.test.js`：新客户端可现场生成补丁，官方 unpacked 不被替换。
- `patchWorker.test.js`：格式 2 注入和取消行为。
- `patchBackupManager.test.js`：升级后重建唯一原版、清理旧上一版、同版本滚动备份。

截至 2026-07-30，Antigravity 2.4.3 离线构建、格式检查、动态生成注入和项目全量测试均已通过；真实安装目录尚未被自动注入。
