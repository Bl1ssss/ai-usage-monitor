# AI Usage Monitor

> Windows 桌面 AI 用量仪表盘 — 实时追踪 DeepSeek / Codex / OpenCode Go / Cursor 的余额、用量与限额。

![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)
![Rust](https://img.shields.io/badge/Rust-2021-000000?logo=rust)

<p align="center">
  <img src="public/tauri.svg" width="120" alt="AI Usage Monitor" />
</p>

一个轻量级桌面小组件，在一个固定置顶的小窗口里集中展示多个 AI 服务商的实时用量。后台用 Rust 拉取各平台 API / 网页数据，前端用 React 渲染卡片面板，自带磁盘缓存与定时刷新。

---

## 支持的平台

| 平台 | 数据来源 | 展示内容 |
|------|----------|----------|
| **DeepSeek** | [`api.deepseek.com/user/balance`](https://api.deepseek.com/user/balance) | CNY 余额（赠送金 + 充值金）、低余额告警 |
| **Codex** | ChatGPT / Codex API (`/backend-api/wham/usage`) | Primary / Secondary 窗口用量百分比、重置倒计时、Plan 类型、额度信息 |
| **OpenCode Go** | [`opencode.ai`](https://opencode.ai) Workspace Dashboard HTML | 5 小时滚动用量、周用量、月用量、可用模型数 |
| **Cursor** | — （待接入） | 预留卡片位，当前为静态示例 |

---

## 界面预览

```
┌──────────────────────────────────────┐
│  AI USAGE MONITOR          SHENZHEN  │
│  Windows Desktop Widget     31°C     │
├──────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐         │
│  │ DEEPSEEK │  │  CODEX   │         │
│  │  ¥12.34  │  │ 45%      │         │
│  │  low bal │  │  S 12%   │         │
│  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐         │
│  │  CURSOR  │  │OP.CODE GO│         │
│  │   20%    │  │ 5h 67%   │         │
│  │          │  │ W 45%    │         │
│  └──────────┘  └──────────┘         │
├──────────────────────────────────────┤
│  last updated: 14:30  |  ok          │
│  [refresh]  [settings]               │
└──────────────────────────────────────┘
```

窗口固定 620×420，支持置顶（`alwaysOnTop`），适合放在屏幕角落做常驻监控。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | [Tauri 2](https://v2.tauri.app/) |
| 前端 | React 19 + TypeScript + Vite 7 |
| 后端 | Rust (reqwest, serde, chrono, regex) |
| IPC | Tauri `invoke` → Rust `#[tauri::command]` |
| 缓存 | `%APPDATA%\ai-usage-monitor\cache.json` |
| 设置 | 前端 `localStorage` |

---

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) ≥ 18
- [Rust](https://www.rust-lang.org/tools/install) toolchain (stable, 2021 edition)
- Windows 10+ (应用使用 `windows_subsystem = "windows"`，以原生窗口运行)

### 安装依赖 & 启动开发服务器

```bash
# 安装前端依赖
npm install

# 启动 Tauri 开发模式（同时启动 Vite dev server 和 Tauri 窗口）
npm run tauri dev
```

### 构建生产版本

```bash
npm run tauri build
```

产物在 `src-tauri/target/release/bundle/` 下，支持 `.msi` / `.exe` / NSIS 安装包。

---

## 配置指南

点击窗口右下角的 **settings** 按钮打开设置面板。

### DeepSeek

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `API Key` | DeepSeek 平台 API Key | — |
| `Low Balance Threshold` | 余额低于该值（CNY）时显示告警 | `5` |

### Codex

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `Auth Path` | `codex login` 生成的 `auth.json` 路径 | 自动查找（`%USERPROFILE%\.codex\auth.json` 等） |
| `Base URL` | API 基础地址 | `https://chatgpt.com` |
| `Proxy URL` | HTTP 代理地址 | `http://127.0.0.1:7890` |
| `Warning Threshold` | 用量超过该百分比时告警 | `80` |

### OpenCode Go

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `Config Path` | 包含 `workspaceId` 和 `authCookie` 的 JSON 配置文件路径 | 自动查找 `%APPDATA%\ai-usage-monitor\opencode-go.json` |
| `Warning Threshold` | 任一窗口用量超过该百分比时告警 | `80` |

#### opencode-go.json 格式

```json
{
  "workspaceId": "ws_xxxxxxxxxxxxx",
  "authCookie": "your-auth-cookie-from-opencode.ai"
}
```

在浏览器上登录 [opencode.ai](https://opencode.ai) 后，从开发者工具复制 Cookie 中的 `auth` 值填入 `authCookie` 或直接粘贴完整的 Cookie 字符串。

### 全局

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `Refresh Interval` | 自动刷新间隔（分钟） | `5` |

---

## 项目结构

```
ai-usage-monitor/
├── src/                          # React 前端
│   ├── App.tsx                   # 主布局、刷新调度、告警逻辑
│   ├── components/
│   │   ├── UsageCard.tsx         # 用量展示卡片组件
│   │   └── SettingsPanel.tsx     # 设置面板组件
│   ├── providers/
│   │   ├── cache.ts              # 缓存读写 Tauri 命令桥接
│   │   ├── deepseek.ts           # DeepSeek 余额查询桥接
│   │   ├── codex.ts              # Codex 用量查询桥接
│   │   └── opencodeGo.ts         # OpenCode Go 用量查询桥接
│   ├── types/
│   │   ├── metrics.ts            # 用量数据类型定义
│   │   └── settings.ts           # 设置类型 & localStorage 读写
│   └── utils/
│       └── format.ts             # 货币/百分比/时间格式化工具
│
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/
│   │   ├── main.rs               # 入口（隐藏控制台窗口）
│   │   ├── lib.rs                # Tauri Builder、注册命令
│   │   ├── deepseek.rs           # DeepSeek API 余额查询
│   │   ├── codex.rs              # Codex auth 读取 + usage API 调用
│   │   ├── opencode_go.rs        # OpenCode Go dashboard HTML 抓取 & 解析
│   │   └── cache.rs              # 磁盘缓存读写
│   ├── Cargo.toml
│   └── tauri.conf.json           # 窗口配置（620×420, 置顶）
│
├── public/                       # 静态资源
├── package.json
└── README.md
```

---

## 工作原理

1. **启动时** — 先从 `%APPDATA%\ai-usage-monitor\cache.json` 读取上一次的缓存数据立即渲染，避免空白等待。
2. **首次拉取** — 并行调用三个平台的 Rust 后端命令：
   - `deepseek_balance` → HTTP `GET https://api.deepseek.com/user/balance`
   - `codex_usage` → 读取本地 auth.json，带 Bearer Token 请求 Codex usage API
   - `opencode_go_usage` → 带 Cookie 抓取 OpenCode Workspace Dashboard 并正则解析 HTML 中的用量 JSON
3. **写入缓存** — 所有请求完成后将结果写入 `cache.json`。
4. **定时刷新** — 按设定的间隔（默认 5 分钟）重复步骤 2-3。
5. **告警** — 余额低于阈值或用量超过阈值时卡片显示警告状态。

---

## License

MIT
