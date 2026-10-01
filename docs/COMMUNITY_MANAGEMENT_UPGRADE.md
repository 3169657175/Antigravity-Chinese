# 用户管理与社区排序改进

## 本地客户端

- 用户列表：15 行分页，用户名搜索，角色、状态筛选，注册时间、发言量、用户名排序。
- 详情：注册时间、最近登录、账号状态、角色、管理员备注、反馈与回复、最近 20 条管理记录。
- 管理：重置密码、禁用/恢复、调整角色、保存备注、清理发言、删除账号。
- 旧服务端兼容：详情接口返回旧数组时，保留密码重置和单条反馈管理，隐藏尚未支持的操作。
- 反馈：默认最新发布；热门和待回复通过服务器筛选排序后读取最近 200 条，搜索筛选当前加载的数据。
- 公告：创建时间降序，编号作为同一时间的稳定排序；编辑不改创建时间。历史列表提供搜索、正序和倒序、全文折叠；公告不再自动强弹。
- 配图：列表缩略图，点击查看原图；编辑公告时保留原图片。

## 配套服务端

源码位置：`C:/Users/niu/.gemini/antigravity/scratch/nhw1029/functions`。
测试副本：`community-backend/functions`，原始文件备份：`community-backend/before-upgrade`。

- `GET /api/auth/users` 返回账号资料和发言统计，不返回密码哈希或 Token。
- `GET /api/auth/users?username=...&detail=true` 返回资料、反馈、回复与管理记录；旧请求仍返回反馈数组。
- `POST /api/auth/users` 接受 `username` 与 `action`：`disable`、`enable`、`role`、`note`、`clear-content`、`delete`。
- 用户管理通过独立 `user_management` 表保存状态、备注、最近登录和会话版本；`admin_audit` 记录操作人、目标、操作与时间。
- 所有鉴权调用校验数据库中的角色、状态和会话版本。禁用/恢复、角色修改、密码重置撤销旧会话。
- 当前管理员不能禁用、删除自己或修改自己的角色。管理员需先降为普通用户才可禁用或删除；最后一位管理员不能被降级。
- 删除内容使用 D1 batch 事务，先清理点赞再清理回复/反馈。删除账号保留会话撤销记录，避免相同用户名重新注册后旧 Token 复活。
- 老账号的最近登录只从更新后首次登录开始记录；已有 JWT 的版本默认按 0 兼容。
- 数据表通过 `CREATE TABLE IF NOT EXISTS` 创建，不改写旧 `users` 表，不删除线上数据用于验证。

## 验证与上线

`node --test communityManagement.test.js communityClient.test.js`：真实隔离 SQLite 验证鉴权、会话撤销、资料返回、级联删除与排序。
`node smoke-community-ui.cjs`：Chrome 浏览器加载真实客户端页面，模拟社区 API；验证搜索、分页、详情、账号操作、转义与排序并生成截图。

服务端源码更新并不等于线上接口已更新。正式部署到 Cloudflare Pages 后，客户端才启用完整云端账号管理。部署不应进行任何真实账号删除、禁用、改密码或发公告来测试。

## 本次交付记录

- 全量回归：203 项，199 通过、4 跳过、0 失败。
- 浏览器交互：搜索、15 行分页、资料详情、账号状态操作、密码隐藏、内容转义、反馈三种排序、公告正倒序和取消强弹均通过；使用模拟账号/API。
- 服务端原有密码/JWT 验证脚本通过；新增 SQLite 行为验证通过。没有对真实用户执行管理操作。
- 本地安装目录：`D:/ang/agy-hub`，已同步构建资源与 EXE。
- 安装 ASAR SHA-256：`AEB532C5225BBC80C0CB9AF41390873F875FE5CA8AE7344B04FD879E64D0035B`，与构建产物一致。
- 上一版 ASAR / EXE 备份：`D:/ang/agy-hub/upgrade-backups/community-20260926-215856`。
- 打包使用本地已安装的 Electron 31.7.7，避免构建器联网校验等待：`electron-builder --config.electronDist=node_modules/electron/dist`。
- 配套服务端源码已更新，线上 Cloudflare Pages 发布待确认。
