# 仓库源码布局

仓库根目录保留 README、许可证、文档、CI 和独立工程入口。AGY Hub 桌面端的完整工程位于 `app/`，社区后端位于 `community-backend/`。

| 位置 | 桌面端测试与构建 | 接手文档 |
| --- | --- | --- |
| 本机正式开发目录 `D:\AGY-Hub-Dev` | 工程根目录 | 根目录的 `AGENTS.md` 和 `AI_PROJECT_GUIDE.md` |
| GitHub 仓库克隆 | `app/` | `docs/development/` 中的 `AGENTS.md` 和 `AI_PROJECT_GUIDE.md` |
| 本机安装目录 `D:\ang\agy-hub` | 已安装应用的运行文件 | 当前保留的本地发布文件与备份 |

## 桌面端开发

```powershell
cd app
npm ci
npm test
npm run patch:verify
.\node_modules\.bin\electron.cmd .
```

在 `app/` 运行 `npm run release:build` 构建安装包，输出为 `app/dist/`。汉化补丁的重建需要本机可用的 Antigravity 官方基线。

`app/package.json` 是桌面端唯一的包配置。运行模块、HTML/CSS、构建钩子、补丁资源、测试和脚本一起移动，保留内部相对路径及安装包内的文件布局。CI 从 `app/` 安装依赖、校验补丁并运行测试。

## 源码同步规则

- 更新桌面端源码时，更新 `app/` 中的对应文件。
- 不要把桌面端模块复制回仓库根目录，也不要保留第二套旧 `src/` 副本。
- 文档和版本说明放在根目录 `docs/`；独立后端工程保留在 `community-backend/`。
- 检查标签所指提交的 `app/package.json` 与安装包版本一致，再公开发布。发布附件的 EXE、blockmap 和 `latest.yml` 从同次构建取得。
- 已发布标签如需修正，先核对旧提交和目标提交并记录变更。更新主分支后，已有标签仍指向原提交。
- 本机同步到 GitHub 时将平铺的桌面端工程映射至 `app/`，保留独立社区后端。运行目录、账号缓存、构建日志、安装包和用户配置不进入源码提交。
