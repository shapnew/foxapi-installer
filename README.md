# Codex & CC-switch 安装程序

## 项目简介

这是一个自动化安装程序，用于一键安装：
- **Codex 桌面端** - AI 编程助手（从 Microsoft Store 安装）
- **CC-switch** - Claude Code 配置切换工具（从指定 URL 下载）

## 📋 配置说明

### 1. 配置 CC-switch 下载链接

编辑 `src-tauri/config.json`，填入 CC-switch 的真实下载链接：

```json
{
  "downloads": {
    "cc_switch": {
      "urls": {
        "windows": "https://your-server.com/cc-switch-setup.exe",
        "macos": "https://your-server.com/cc-switch.dmg",
        "linux": "https://your-server.com/cc-switch.AppImage"
      }
    }
  }
}
```

或者直接修改 `src-tauri/src/installer.rs`：

```rust
/// CC-switch 下载配置
const CCSWITCH_DOWNLOAD_URL: &str = "https://your-server.com/cc-switch-setup.exe";
```

### 2. 配置中转站 API

修改 `src-tauri/config.json`：

```json
{
  "proxy": {
    "validate_url": "https://your-proxy.com/v1/models",
    "api_url": "https://your-proxy.com/v1"
  }
}
```

## 🚀 开发运行

### 前置要求

- Node.js >= 18
- pnpm >= 8
- Rust >= 1.70
- Visual Studio Build Tools (Windows)

### 安装依赖

```bash
# 安装前端依赖
pnpm install

# Rust 依赖会自动安装
```

### 开发模式

```bash
# 启动开发服务器（仅前端预览）
pnpm dev

# 启动完整 Tauri 应用
pnpm tauri dev
```

### 构建打包

```bash
# 构建生产版本
pnpm tauri build
```

构建产物在 `src-tauri/target/release/bundle/` 目录。

## 📦 打包体积

- **Windows**: ~5-8 MB (.exe)
- **macOS**: ~5-8 MB (.dmg)
- **Linux**: ~5-8 MB (.AppImage)

## 🔧 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS 4
- **后端**: Rust + Tauri 2
- **UI 设计**: Claude 暖橙色主题

## 🎨 界面特色

- ✅ Claude 经典暖橙色配色
- ✅ 6 步向导式安装流程
- ✅ 柔和渐变背景
- ✅ Logo 光晕动画
- ✅ 舒适的行距和间距
- ✅ 自定义标题栏（无边框）

## 📁 项目结构

```
installer/
├── src-tauri/              # Rust 后端
│   ├── Cargo.toml          # Rust 依赖
│   ├── config.json         # 配置文件
│   ├── tauri.conf.json     # Tauri 配置
│   └── src/
│       ├── main.rs         # 入口
│       ├── lib.rs          # 命令定义
│       ├── installer.rs    # 安装逻辑
│       └── system.rs       # 系统检测
├── src/                    # React 前端
│   ├── App.tsx             # 主应用
│   ├── styles/
│   │   └── global.css      # 全局样式
│   └── components/
│       ├── Welcome.tsx     # 欢迎页（API Key）
│       ├── License.tsx     # 许可协议
│       ├── ComponentSelect.tsx  # 组件选择
│       ├── ProxyConfig.tsx # 代理配置
│       ├── Progress.tsx    # 安装进度
│       └── Complete.tsx    # 完成页面
├── package.json            # 前端依赖
└── README.md               # 本文件
```

## ⚠️ 注意事项

1. **Codex 安装**
   - 需要 Windows 10/11
   - 需要 Microsoft Store 访问权限
   - 首次安装可能需要 Microsoft 账号

2. **CC-switch 下载**
   - 确保下载链接有效
   - 确保文件未被篡改（建议提供 SHA256 校验）

3. **权限问题**
   - Windows: 可能需要管理员权限
   - macOS: 可能需要 sudo 权限
   - Linux: 确保有写入权限

## 🐛 常见问题

### Q: Codex 安装失败 / 提示"无法启动 winget"？
A: 程序会自动按四层兜底，**Codex 失败不会影响 CC-switch 和 FoxAPI 配置**：
1. 在 PATH 和标准位置（`%LOCALAPPDATA%\Microsoft\WindowsApps`）查找 winget 并静默安装；
2. winget 不可用或安装失败（国内 msstore 源不稳常见）→ 自动打开**微软商店 App** 的 Codex 页面，用户点【获取】即可；
3. 系统没有商店（LTSC/精简版）→ 自动在浏览器打开 **Codex 官网页面**（apps.microsoft.com/detail/9plm9xgg6vks），页面上有官方安装/下载按钮；
4. 以上均完成或失败后，继续安装其余组件，绝不中断。

### Q: CC-switch 下载失败？
A: 检查下载链接是否正确，网络是否通畅。

### Q: 权限不足？
A: Windows 右键"以管理员身份运行"，macOS/Linux 使用 sudo。

## 🔧 本次修复说明（前后端打通版）

这一版把安装器从"前端演示壳"改成了真正会调用后端、显示真实进度的可用程序。主要改动：

**前后端打通（核心）**
- `Welcome.tsx`：改为调用后端 `validate_api_key` 做真实验证，成功后填入后端返回的真实端点（不再是 `your-proxy.com` 占位符）；API Key 输入框改成密码类型，并提供"显示/隐藏"切换。
- `ProxyConfig.tsx`：「测试连接」改为调用后端 `test_connection`，真实请求 `{endpoint}/v1/models`。
- `Progress.tsx`：改为调用真实的 `run_installation`，并通过 Tauri **Channel** 接收后端实时进度（CC-switch 下载是真实百分比）；新增失败提示与「重试」；加了防 React StrictMode 重复执行的保护。
- 非 Tauri（浏览器 `pnpm dev`）环境下，以上组件自动降级为模拟流程，方便单独调 UI。

**后端加固（`installer.rs` / `lib.rs` / `system.rs`）**
- 新增 `ProgressUpdate` 进度事件与 `test_connection` 命令；删除空壳命令 `select_directory`。
- 下载改为流式并上报进度；HTTP 客户端加超时。
- 修复下载链接：由 `/releases/latest/download/ + 写死文件名`（发新版即 404）改为**锁定版本的 tag 地址** `/releases/download/v3.16.1/...`，版本号统一由 `CCSWITCH_VERSION` 常量维护。
- 写 CC-switch 数据库前设置 `busy_timeout`，降低 CC-switch 运行时写库报 `database is locked` 的概率。
- 无论成功失败都会清理临时文件（不再只在成功路径清理）。
- `system.rs` 用 `sysinfo` 返回**真实磁盘可用空间**（替换硬编码的 128.5 GB）；`InstallPath.tsx` 改为调用 `get_system_info` 拿真实系统类型和磁盘空间（同时修掉了之前 `window.__TAURI_INTERNALS__?.os?.platform` 这个无效的平台判断）。

**新增依赖**：`Cargo.toml` 增加了 `sysinfo = "0.33"`；`package.json` 增加了 `@tauri-apps/plugin-dialog`(选择文件夹对话框,原项目漏装)。

**新图标**：替换了 `src-tauri/icons/` 下的图标(暖橙狐狸),并在 `tauri.conf.json` 的 `bundle.icon` 登记了 `32x32.png / 128x128.png / 128x128@2x.png / icon.ico`。根目录 `app-icon.png` 是 1024 主图;运行 `pnpm tauri icon app-icon.png` 可一键生成含 macOS `.icns` 的全平台图标。

### ⚠️ 仍需你处理（本环境无法替你完成）
1. **代码签名**：`tauri.conf.json` 里 `certificateThumbprint` 仍为 null。未签名的安装包在 Windows 会触发 SmartScreen 警告、macOS 会被 Gatekeeper 拦截。正式分发前请配置签名证书。
2. **管理员权限**：`msiexec /quiet` 静默安装通常需要管理员权限。建议给程序加 UAC 提权清单（manifest `requireAdministrator`），或在失败时提示用户"以管理员身份运行"（后端已在报错信息里提示）。
3. **macOS / Linux 真实安装**：目前 Windows 路径已打通；macOS/Linux 仅做到"下载 + 保存 + 打开/赋权 + 明确提示手动安装"，没有自动静默安装（代码里留了 TODO）。请在对应系统上验证并按需补全。
4. **下载校验**：尚未校验下载文件的 SHA256/签名，存在被篡改风险，建议补上。

## 🚀 构建与测试

```bash
cd installer
pnpm install          # 安装前端依赖（Rust 依赖在首次 tauri 命令时自动拉取）

pnpm dev              # 仅前端预览（模拟流程，验证 UI）
pnpm tauri dev        # 完整应用（真实调用后端，建议在 Windows 上测试）
pnpm tauri build      # 构建发布版（C 盘需 6GB+ 空间）
```

> 提示：仅 `pnpm dev` 时没有 Tauri 运行时，验证/测试/安装会走模拟分支，不会真正安装软件。要测真实流程请用 `pnpm tauri dev`。

## 🔁 配置机制改版：改用 CC-switch 官方 deeplink 导入（重要）

经核对 CC-switch v3.16 源码发现：早期"安装程序直接写 CC-switch 的 SQLite 数据库"的做法，与新版字段格式系统性不一致（如 Claude 的 `claudeDesktopModelRoutes`/`claudeDesktopMode` 实为驼峰、取值为 `direct`/`proxy`；Codex 的 `apiFormat` 实为 `openai_chat`/`openai_responses`、`modelCatalog` 在 `meta` 且为数组、`config.toml` 用 `[model_providers.custom]` 等），直接写库容易导致"导入后测试无效"。

因此本版**不再手写数据库**，改为调用 CC-switch 官方的 `ccswitch://` 深链接导入：

```
ccswitch://v1/import?resource=provider&app=claude&name=FoxAPI&apiKey=<KEY>&endpoint=<ENDPOINT>&enabled=true
ccswitch://v1/import?resource=provider&app=codex&name=FoxAPI&apiKey=<KEY>&endpoint=<ENDPOINT>&enabled=true&model=gpt-5.5
```

由 CC-switch 自己解析并写出**格式正确**的供应商配置（`enabled=true` 会设为当前供应商）。`installer.rs` 用 `rundll32 url.dll,FileProtocolHandler`（Windows）/ `open`（macOS）/ `xdg-open`（Linux）打开链接。已移除 `rusqlite` 依赖与全部手写建表/UPSERT 代码。

注意：
- 导入时 **CC-switch 会被唤起并显示导入的供应商**（不是全程无感，但对小白"装完即见到配好"更直观）。
- `ccswitch://` 协议由 CC-switch 安装时注册，所以导入在"先装 CC-switch、再导入"的顺序下进行。
- Codex 默认按 Responses API（`wire_api="responses"`）导入；若你的 FoxAPI 端点是 Chat Completions 形、需要本地路由转换，在 CC-switch 的「设置 → 本地路由」里给 Codex 打开开关即可（一个开关）。
- ⚠️ **此机制必须在装有 CC-switch 的 Windows 上实测**：确认 `ccswitch://` 能被唤起、导入成功、供应商可用。我无法在构建环境中验证 deeplink 的真实行为。

## ⬇️ CC-switch 下载：自动最新版 + 国内加速

- **自动取最新版**：通过 GitHub API（`/repos/farion1231/cc-switch/releases/latest`）解析最新发布，按当前系统/架构自动选对应安装包（Windows `.msi` / macOS `.dmg` / Linux `.AppImage`），不再写死版本号。
- **国内网络加速 + 多源回退**：下载链接会依次尝试国内可达的 GitHub 加速镜像，最后回退直连，解决"国内下 GitHub releases 经常失败"的问题。镜像清单在 `installer.rs` 的 `GH_MIRRORS` 常量里，可按需增删：
  ```rust
  const GH_MIRRORS: &[&str] = &[
      "https://ghfast.top/",
      "https://gh-proxy.com/",
      "https://ghproxy.net/",
      "https://github.moeyy.xyz/",
  ];
  ```
  > 这类公共加速镜像随时可能失效，若以后下载又变慢/失败，把上面换成当时可用的镜像即可。GitHub API 也会同样尝试镜像；若全部不可达，则回退到内置版本 `CCSWITCH_FALLBACK_VERSION`（请偶尔更新它）。
- 安装进度面板会实时显示"正在尝试第 N 个下载源 / 某源失败换下一个"，方便排查。

## 🖥️ 跨平台支持（Windows / macOS / Linux）

本程序已做成跨平台。**但 Tauri 不能跨系统打包**——要哪个平台的安装包,就在哪个平台上 build:

| 平台 | 在该平台运行 | 产物 |
|---|---|---|
| Windows | `pnpm tauri build` | `bundle\nsis\*-setup.exe`、`bundle\msi\*.msi` |
| macOS | `pnpm tauri build` | `bundle/dmg/*.dmg`、`bundle/macos/*.app` |
| Linux | `pnpm tauri build` | `bundle/appimage/*.AppImage`、`bundle/deb/*.deb` |

各平台的安装行为:

| 步骤 | Windows | macOS | Linux |
|---|---|---|---|
| **Codex** | winget 从商店安装 | **自动跳过**（商店应用仅 Windows） | **自动跳过** |
| **CC-switch** | 静默装 MSI | 挂载 dmg → 拷贝 .app 到 `/Applications`（不可写则退回 `~/Applications`）→ 去隔离 | 放置 AppImage 到 `~/.local/bin` + chmod + 建 `.desktop`（含 `ccswitch://` 协议） |
| **导入 FoxAPI** | `ccswitch://` deeplink | 同（安装后会启动一次 CC-switch 以注册协议） | 同（`update-desktop-database` 注册协议） |

> 前端会自动检测系统:**非 Windows 上"选择组件"页不显示 Codex**,只装 CC-switch + 导入 FoxAPI。

⚠️ **macOS / Linux 的安装与 deeplink 必须在对应系统上实测**(我无法替你验证):
- macOS:拷贝到 `/Applications` 若遇权限,会自动退回 `~/Applications`;首次 `ccswitch://` 若没反应,手动打开一次 CC-switch 再重试。
- Linux:协议处理依赖桌面环境支持 `x-scheme-handler`;若 deeplink 没反应,先手动运行一次 `~/.local/bin/cc-switch.AppImage`。

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

- 作者: [你的名字]
- 邮箱: [你的邮箱]
- 中转站: [你的中转站地址]
