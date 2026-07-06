# Antigravity 2.0 汉化与优化补丁 v2 (模块化重构版)

## 功能特色
1. **100% 独立与汉化安全**：保留全部免 TUN/代理、汉化机制、自动升级检测、多账号快捷切换。
2. **全新模块化架构**：`preload.js` 现已精减到仅 80 余行（核心 API 暴露），所有的具体逻辑已经分类拆入 `patch/core/` 与 `patch/modules/` 目录下。
3. **更方便二次开发**：
   - 词典文件在 `patch/modules/dictionary.js` 统一维护，一目了然。
   - 额外功能在 `patch/modules/` 对应文件修改，逻辑解耦。
   - 在 `patch/core/loader.js` 中可以根据需要自由开启或关闭某项具体优化逻辑。

## 目录结构
- `install.ps1` / `安装汉化与优化补丁.bat`：一键打包 app.asar 并安装
- `restore.ps1` / `一键还原官方原版.bat`：一键卸载并恢复为官方英文版
- `patch/`：所有的补丁代码
  - `preload.js`：注入页面的 preload 入口
  - `core/`：核心架构文件（loader / dom）
  - `modules/`：功能子模块

## 安装说明
直接双击运行 `安装汉化与优化补丁.bat` 即可，需要以管理员权限执行以写入本地安装目录。
