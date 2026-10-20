# 仓库源码布局

仓库根目录保留 README、许可证、文档、CI 和独立工程入口。AGY Hub 桌面端的完整工程位于 `app/`，社区后端位于 `community-backend/`。

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
- 已发布的版本标签记录当时的源码快照；目录整理通过新的主分支提交保存，历史标签不重写。

本机维护目录 `C:\Users\niu\.gemini\antigravity\scratch\agy-hub` 仍是既有的平铺工程。同步到 GitHub 时应将该工程映射到仓库 `app/`；运行目录 `D:\ang\agy-hub` 不作为源码发布目录。
