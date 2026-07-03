# Antigravity-Chinese (Antigravity 2.0 汉化与体验优化补丁)

<p align="center">
  <img src="https://img.shields.io/badge/Language-Chinese%20%26%20English-brightgreen.svg?style=for-the-badge" alt="Bilingual">
  <img src="https://img.shields.io/badge/Platform-Windows-blue.svg?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-orange.svg?style=for-the-badge" alt="License">
</p>

这是一个针对 Google 出品的强大智能体编码助手 **Antigravity 2.0** 桌面客户端的开源无损汉化补丁、免 TUN 代理网络优化与桌面体验增强引擎。

This is an open-source, non-destructive Chinese localization patch, proxy auto-resolver, and UX enhancement engine for **Antigravity 2.0**, the agentic AI coding assistant desktop client by Google.

---

## 🌟 核心特性 | Features

### 🇨🇳 100% 深度汉化覆盖 | 100% Deep Localization
- **云端字典热更新**：启动时采用 `localStorage` 本地缓存进行秒级启动翻译，并在后台自动、异步拉取最新共享词库进行静默热更新合并，用户无需重复运行补丁即可享受校对更新。
- **高精度编辑器防护**：精确跳过 Monaco Editor 代码编辑区、富文本输入框、终端运行日志，**绝对禁止篡改用户正在打字的任何代码字符**，即便代码中包含与字典同名的英文关键字（如 `const Default = 'Default';`）也绝不影响显示。
- **系统组件全覆盖**：完美翻译了 native 应用菜单栏、系统托盘指示器、设置中心所有配置项以及新手 onboarding 引导窗口。
- **OS 标题栏汉化**：拦截劫持 `document.title`，使得操作系统的任务栏预览和窗口顶部标题栏均正确显示中文。

### 🚀 桌面端体验极致优化 | Desktop UX Enhancements
- **0 毫秒瞬间还原（免 Loading 重载）**：拦截窗口关闭行为。当您开启“常驻后台”时，点击右上角“叉号”会将窗口**隐藏而非销毁**。重新打开时直接从内存秒开，**完全告别重新加载的 `loading antigravity` 进度条**，并完美保留您关闭前的输入框草稿及滚动条位置。
- **系统托盘一键唤醒**：为任务栏系统托盘图标绑定了左键单击和双击事件，现在**只需左键单击或双击托盘图标即可立即还原并聚焦主窗口**，无需再右键选择。
- **关闭直接退出选项**：若您在设置中关闭了“常驻后台”，点击右上角“叉号”会直接触发 `app.quit()` 退出应用，绝不残留多余后台子进程。

### 🌐 免 TUN 代理网络优化 | Proxy Auto-Sniffing (No TUN Required)
- **子进程代理传递**：启动时自动侦测 Chromium 客户端的系统代理设置，并将解析出的 IP 和端口格式化后，自动注入到后台智能体进程（`language_server`）的 `HTTP_PROXY` 和 `HTTPS_PROXY` 启动环境变量中。
- **免 TUN 模式使用**：使后台核心能够无感走普通系统代理端口与谷歌服务进行通信。**您再也不用每次启动软件时都特意去代理软件中开启耗费系统资源的 TUN 模式了！**

---

## 💾 快速安装指南 | Installation Guide

> [!IMPORTANT]
> 本补丁采用**本地动态重包技术**，它会自动查找您本地的 Antigravity 路径并对其进行无损编译和打包，因此完美兼容任何官方小版本升级。
>
> 运行本脚本前，**请确保您的系统已安装 Node.js 运行环境 (npm/npx)**（Antigravity 开发者通常已默认安装）。

### 方式 A：本地一键双击安装（推荐 ⭐⭐⭐）
1. 克隆或下载本仓库的 zip 包解压至本地。
2. **双击运行 `安装汉化与优化补丁.bat`**。
3. 脚本会自动申请管理员权限，关闭正在运行的客户端，并执行备份与重包逻辑。
4. 安装完成后，手动重新打开客户端即可享受全新体验。

### 方式 B：PowerShell 命令安装
以管理员身份打开 PowerShell 窗口，切换到本仓库根目录，执行以下命令：
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\install.ps1
```

### 一键卸载与还原
如果您需要还原回官方纯英文版，只需去您的 Antigravity 安装目录下（默认为 `C:\Users\您的用户名\AppData\Local\Programs\antigravity\resources\`）：
1. 删除被修改的 `app.asar`。
2. 将首次运行自动生成的备份文件 `app.asar.backup` 重命名还原为 `app.asar` 即可。

---

## 📁 仓库结构 | Project Structure
```text
Antigravity-Chinese/
├── patch/                  # 核心优化及汉化源码文件 (注入 dist)
│   ├── preload.js          # DOM 扫描、云端字典及标题劫持引擎
│   ├── menu.js             # 系统顶部原生菜单翻译
│   ├── tray.js             # 系统托盘左键点击唤醒与翻译
│   ├── main.js             # 主进程生命周期与 Mac 适配优化
│   ├── utils.js            # 0ms 隐藏唤醒逻辑与配置读取
│   ├── languageServer.js   # 免 TUN 代理侦测与传递
│   └── ideInstall/         
│       └── wizardPreload.js # 引导窗口汉化
├── 安装汉化与优化补丁.bat    # Windows 双击运行启动器
├── install.ps1             # PowerShell 核心安装脚本 (自动解/重包 ASAR)
└── README.md               # 使用与配置说明书
```

---

## ⚖️ 免责声明 | Disclaimer
- 本项目仅为个人学习 Electron 运行时注入、代理拦截技术的开源研究成果，不含任何商业用途。
- 汉化所涉及的界面文案及客户端软件版权归原官方所有。若您喜欢该软件，请支持官方正版。
