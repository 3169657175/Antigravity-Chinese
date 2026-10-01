# Codex 长对话自动压缩修复

日期：2026-07-26

## 现象

自定义 Responses Provider 的长对话在 Codex 显示“上下文已自动压缩”之前，可能先出现一到两次 `stream disconnected before completion`。

## 已确认原因

旧模型目录向 Codex 宣告：

- `context_window = 400000`
- `effective_context_window_percent = 80`
- `auto_compact_token_limit = 320000`

现场会话在当前上下文约 291,749 Token 时出现断流，随后才进入自动压缩。压缩完成后上下文降至约 25,056 Token。说明 8046 的压缩转换可以完成，但第三方上游在 Codex 原生触发点之前已经接近不稳定区。

## 修复原则

不在 8046 中擅自删除历史或工具调用，而是继续使用 Codex 原生压缩，只修正自定义 Provider 的模型能力声明：

- `context_window = 300000`
- `effective_context_window_percent = 80`
- `auto_compact_token_limit = 240000`

Codex 会在有效窗口进一步接近自身原生阈值时提前压缩，从而为请求序列化、工具输出增长和上游差异保留约 50K 以上的安全余量。

Antigravity 路由继续保持原来的 360K/75% 策略，不受此修复影响。

## 修改文件

- `codexModels.js`：长对话窗口策略的单一事实来源。
- `codexConfig.js`：生成落盘模型目录。
- `gatewayIpc.js`：接入自定义 Provider 时写入相同策略。
- `codexGateway.js`：`/v1/models` 返回相同策略。
- `longContextCompaction.test.js`：防止某个入口重新写回 400K。

## 生效方式

现有 Codex 模型目录只会在重新接入自定义 Provider 时覆盖。安装新版本后，在“小助手 → 反代接入 → 自定义 Provider”重新点击接入，Codex 重启后新线程和恢复线程会读取新的目录。
