# 自定义 Provider 2.0 结构说明

## 用户界面位置

所有 Provider 能力继续位于“反代接入 → 自定义 Provider”二级页，不增加新的一级导航。

- 协议、认证、主地址、备用地址、模型发现：Provider 编辑页。
- 兼容性与健康状态：Provider 卡片徽章和三级测试结果区。
- 配置快照、请求时间线、一键诊断：反代接入页右上角统一工具区。
- 首次使用引导：只在反代接入 Codex 概览页出现，可永久隐藏。
- Antigravity 兼容性预检：一键汉化页“客户端检测”卡片内。

按产品要求，本阶段没有增加 Provider 额度/余额，也没有增加工具管理中心。

## 协议适配

`providerProtocol.js` 是自定义 Provider 的协议边界：

| 协议 | 上游端点 | AGY Hub 行为 |
|---|---|---|
| OpenAI Responses | `/responses` | 原样转发 |
| OpenAI Chat Completions | `/chat/completions` | 将 Responses 请求和结果双向转换 |
| Anthropic Messages | `/messages` | 转换消息、工具和用量 |
| Gemini Native | `/models/{model}:generateContent` | 转换内容、工具和用量 |

Codex 对外仍只看到稳定的 OpenAI Responses API。非 Responses 上游当前采用“上游非流式、下游合成标准 Responses SSE”的兼容策略，优先保证工具历史和客户端结构正确。

## 认证与模型发现

支持 `Authorization: Bearer`、`x-api-key`、`api-key`、Query Key 和自定义 Header JSON。自定义 Header 中使用 `{{API_KEY}}` 作为密钥占位符。

“获取模型”通过 Provider 的 `/models` 读取模型列表，并写入编辑区，不会改变当前活动路由。

## 密钥安全

- `secretCodec.js` 封装 Electron `safeStorage`。
- `gatewayConfigStore.js` 对 `codex-gateway.json` 中的上游 Key 透明加解密。
- `codexProviderProfiles.js` 只保存 `apiKeyEncrypted`，Renderer 只收到 `keySaved` 和 `keyTail`。
- 旧版明文配置在下一次读取并保存时自动迁移，不要求用户重新创建卡片。

本地 8046 Key 仍需写入 Codex/Claude 客户端配置，这是协议运行所需；第三方上游 Key 不会返回给 Renderer。

## 健康检查和故障切换

- `providerHealthStore.js` 保存最近一次三级测试结果、耗时和通过级别。
- Provider 卡片展示“健康 3/3”“需要检查”或“未检测”。
- `fallbackBaseUrls` 按填写顺序尝试；只有连接失败或 5xx 才切换，已经收到正常业务响应后不会重放请求。
- 切换事件写入脱敏网关诊断日志。

## 配置快照与时间线

- `configSnapshotStore.js` 只保存已列入白名单的本地配置文件，最多在 UI 中展示最近 30 个快照。
- 恢复快照后需要重启 AGY Hub 才能让内存态和落盘配置完全一致。
- 请求时间线直接复用一键诊断中的最近脱敏日志，不显示 API Key、Token 或对话正文。

## 修改时必须联动

修改协议或鉴权：`providerProtocol.js`、`gatewayIpc.js`、`codexGateway.js`、`gatewayTestRunner.js`。

修改 Provider 表单：`index.html`、`gatewayController.js`、`style.css`、`preload.js`。

修改持久化：`codexProviderProfiles.js`、`gatewayProfiles.js`、`gatewayConfigStore.js`、`secretCodec.js`。

修改快照/健康：`configSnapshotStore.js`、`providerHealthStore.js`、`gatewayIpc.js`。

最低验证：

```powershell
npm.cmd test
npm.cmd run test:architecture
```

涉及真实中转站时，再分别对四种协议执行三级测试；测试按钮必须保持只读，不能切换活动 Provider。
