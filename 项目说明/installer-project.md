# Codex & CC-switch 自动化安装程序 — 项目审查说明

## 一、项目背景

**FoxAPI** 是一个 AI API 中转站（OpenAI/Claude 兼容代理），为客户提供 GPT-5.4、GPT-5.5 等模型的 API 访问。本项目是一个面向终端用户的**一键安装程序**，自动完成以下任务：

1. 安装 **Codex** 桌面端（OpenAI 的 AI 编程助手，通过 winget 从 Microsoft Store 安装）
2. 安装 **CC-switch**（Claude Code 多配置切换工具，从 GitHub releases 下载安装）
3. 自动配置 FoxAPI 中转站：向 CC-switch 的 SQLite 数据库写入供应商配置，包含 API Key、端点地址、本地路由映射和模型目录

安装完成后，用户打开 CC-switch 即可看到 FoxAPI 供应商，点击测试连接即可使用。

## 二、技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 前端 | React 19 + TypeScript + Tailwind CSS 4 | Vite 6.4 构建 |
| 后端 | Rust + Tauri 2 | Tauri 2.11, rusqlite 0.31 |
| 图标 | Lucide React | v0.511 |
| HTTP | reqwest 0.12 (tokio async) | |
| 数据库 | rusqlite (bundled SQLite) | 写入 CC-switch 数据库 |

## 三、项目结构

```
C:\Users\14769\projects\installer\
├── src-tauri/                     # Rust 后端
│   ├── Cargo.toml                 # Rust 依赖
│   ├── tauri.conf.json            # Tauri 配置（800x600 无边框窗口）
│   ├── capabilities/default.json  # Tauri 权限（dialog, shell）
│   ├── config.json                # 可选外部配置（下载链接等）
│   └── src/
│       ├── main.rs                # 程序入口
│       ├── lib.rs                 # Tauri 命令定义 + 插件注册
│       ├── installer.rs           # 核心安装逻辑 + CC-switch 数据库写入
│       └── system.rs              # 系统信息检测（简化实现）
├── src/                           # React 前端
│   ├── main.tsx                   # React 入口
│   ├── App.tsx                    # 主应用：7步向导状态机
│   ├── styles/global.css          # Claude 暖橙色主题 + 动画
│   └── components/
│       ├── TitleBar.tsx           # 自定义无边框标题栏
│       ├── Welcome.tsx            # 第1步：API Key 验证
│       ├── License.tsx            # 第2步：许可协议
│       ├── ComponentSelect.tsx    # 第3步：选择安装组件
│       ├── ProxyConfig.tsx        # 第4步：代理配置确认
│       ├── InstallPath.tsx        # 第5步：安装路径选择（含文件夹对话框）
│       ├── Progress.tsx           # 第6步：安装进度展示
│       └── Complete.tsx           # 第7步：安装完成
├── package.json                   # 前端依赖
└── README.md                      # 项目文档
```

## 四、核心安装流程

```
用户输入 API Key → 验证 Key 有效性 → 选择组件 → 确认代理配置
  → 选择安装路径 → 执行安装 → 完成
```

### 安装执行逻辑 (`installer.rs`)

```rust
run_installation(api_key, api_endpoint, install_codex, install_ccswitch, install_path)
  ├── 1. install_codex  → download_and_install_codex()   // winget install from msstore
  ├── 2. install_ccswitch → download_and_install_ccswitch() // GitHub release download + silent install
  ├── 3. configure_ccswitch(api_key, api_endpoint)          // 写入 CC-switch SQLite 数据库
  └── 4. cleanup_temp()                                     // 清理临时文件
```

### CC-switch 数据库配置（核心）

安装程序直接写入 `~/.cc-switch/cc-switch.db`，为三个应用类型创建 FoxAPI 供应商：

| app_type | 用途 | settings_config | meta 特殊字段 |
|----------|------|-----------------|--------------|
| `claude` | Claude Code | `env.ANTHROPIC_API_KEY` + `ANTHROPIC_BASE_URL` | `apiFormat: "anthropic"` |
| `claude-desktop` | Claude Desktop | 同上 | `claude_desktop_model_routes`（本地路由映射） |
| `codex` | Codex | `auth.OPENAI_API_KEY` + `config`(TOML) + `modelCatalog` | `apiFormat: "openai"` |

**数据库表结构**（与 CC-switch v3.8+ 一致）：
- `providers` — 供应商主表，复合主键 `(id, app_type)`
- `provider_endpoints` — 自定义端点列表
- `provider_health` — 供应商健康状态

**每个供应商记录包含**：
- `id` = `"foxapi"`（所有 app_type 共用）
- `name` = `"FoxAPI"`
- `is_current` = `1`（设为当前供应商）
- `icon_color` = `"#D97757"`（Claude 橙色）
- `meta` JSON 中包含：apiFormat、apiKeyField、customEndpoints、providerType
- claude-desktop 额外包含：`claude_desktop_model_routes`（3 条路由映射）
- codex 额外包含：`modelCatalog`（4 个模型）

### 预配置的模型

**Codex 模型目录** (`settings_config.modelCatalog`)：
| id | name | contextWindow |
|----|------|--------------|
| gpt-5.4 | GPT-5.4 | 256000 |
| gpt-5.4-mini | GPT.5.4 Mini | 128000 |
| gpt-5.5 | GPT-5.5 | 256000 |
| gpt-image-2 | GPT Image 2 | 128000 |

**Claude Desktop 本地路由映射** (`meta.claude_desktop_model_routes`)：
| Claude 模型名 (key) | 映射到 FoxAPI 模型 (value) |
|---------------------|--------------------------|
| claude-sonnet-4-20250514 | gpt-5.4 |
| claude-haiku-4-20250414 | gpt-5.4-mini |
| claude-opus-4-20250514 | gpt-5.5 |

## 五、已知问题与待改进

### 🔴 需要修复

1. **Welcome.tsx API Key 验证是模拟的**（第 28-29 行）：
   ```typescript
   // TODO: 调用后端验证 API Key
   await new Promise((resolve) => setTimeout(resolve, 1500)); // 模拟验证
   ```
   应该调用 `invoke("validate_api_key", { apiKey })` 后端命令。验证成功后应自动填入 `apiEndpoint`。

2. **ProxyConfig.tsx 连接测试是模拟的**（第 23-24 行）：
   ```typescript
   // TODO: 调用后端测试连接
   await new Promise((resolve) => setTimeout(resolve, 1000));
   ```
   应该调用后端实际测试 API 端点连通性。

3. **Progress.tsx 安装进度完全是模拟的**（第 50-78 行）：
   - 使用 `setTimeout` 模拟进度，没有调用后端 `invoke("run_installation")`
   - 实际安装应该在后端执行，前端通过事件或轮询获取真实进度
   - 当前后端没有进度回调机制

4. **select_directory 命令是空壳**（`lib.rs` 第 37-40 行）：
   ```rust
   async fn select_directory() -> Result<Option<String>, String> {
       Ok(None)  // 由前端 dialog 插件实现
   }
   ```
   前端 `InstallPath.tsx` 已用 `@tauri-apps/plugin-dialog` 实现了文件夹选择，这个命令可以删除。

### 🟡 建议改进

5. **system.rs 磁盘空间检测是硬编码的**（始终返回 128.5 GB），应使用 `sysinfo` 或平台 API 获取真实值。

6. **安装路径参数 `_install_path` 未使用**（`installer.rs` 第 73 行）：`run_installation` 接收 `install_path` 但从未使用。Codex 通过 winget 安装到默认位置，CC-switch 通过 MSI 安装到默认位置。如果用户自定义了安装路径，应该传递给安装命令。

7. **无进度回调机制**：后端安装过程没有进度上报（`ProgressCallback` 类型曾存在但已被删除），前端无法知道真实安装进度。

8. **错误处理不够细致**：安装失败时没有回滚机制，临时文件可能残留。

9. **CC-switch 可能正在运行时写入数据库**：`configure_ccswitch` 直接操作 SQLite，如果 CC-switch 正在运行可能造成数据竞争。应检查进程或在安装后提示重启 CC-switch。

10. **硬编码的版本号**：CC-switch 版本 `v3.16.1` 硬编码在 `get_ccswitch_download_url()` 中，应从配置读取或使用 GitHub API 获取最新版。

### 🟢 已完成的正确实现

- ✅ CC-switch 数据库写入逻辑正确（UPSERT + is_current 标志）
- ✅ 三个 app_type 的 settings_config 格式正确
- ✅ meta JSON 结构与 CC-switch 源码一致
- ✅ Claude Desktop 本地路由映射格式正确
- ✅ Codex 模型目录格式正确
- ✅ Tauri 对话框插件集成完成（文件夹选择）
- ✅ 自定义无边框标题栏正常工作
- ✅ Claude 暖橙色主题完整实现

## 六、构建与运行

```bash
# 安装依赖
cd C:\Users\14769\projects\installer
pnpm install

# 开发模式
pnpm tauri dev

# 构建生产版本
pnpm tauri build

# 注意：C 盘空间需要 6GB+（Tauri 构建产物较大）
# 如果 C 盘空间不足，可设置 CARGO_TARGET_DIR 指向 D 盘
```

## 七、外部依赖关系

- **CC-switch** (github.com/farion1231/cc-switch)：Claude Code 多配置切换工具
  - 本安装程序直接写入其 SQLite 数据库（`~/.cc-switch/cc-switch.db`）
  - CC-switch 首次运行会自动导入数据库中的供应商配置
  - 数据库 schema 版本：v3.8+（providers 复合主键 `(id, app_type)`）

- **Codex** (Microsoft Store ID: `9plm9xgg6vks`)：OpenAI AI 编程助手
  - 通过 winget 安装，使用默认安装路径
  - 配置文件：`~/.codex/auth.json` + `~/.codex/config.toml`（由 CC-switch 切换时写入）

- **FoxAPI 中转站** (foxapi.chat)：AI API 代理服务
  - 端点：`https://foxapi.chat/v1`
  - 验证接口：`GET /v1/models`（Bearer token 认证）
  - 支持 OpenAI 和 Anthropic API 格式

## 八、审查重点

请重点审查以下方面：

1. **安全性**：API Key 在安装过程中的传输和存储是否安全？SQLite 写入是否有注入风险？
2. **健壮性**：网络下载失败、磁盘空间不足、权限不足等异常场景的处理
3. **数据库操作**：UPSERT 逻辑是否正确？并发安全？CC-switch 运行时写入是否安全？
4. **跨平台兼容**：Windows/macOS/Linux 的安装路径和命令是否正确
5. **前端状态管理**：7 步向导的状态流转是否正确？数据是否在步骤间正确传递？
6. **进度反馈**：安装过程中的用户体验，如何从模拟进度改为真实进度

## 九、本次修复记录（前后端打通版）

> 由代码审查后实施。详细改动见 README 的「本次修复说明」。

### 已修复
- ✅ **前后端打通（最关键）**：`Progress.tsx` 不再用 `setTimeout` 假进度，改为调用 `invoke("run_installation")` 并通过 Tauri Channel 接收真实进度；`Welcome.tsx` 调用真实 `validate_api_key`；`ProxyConfig.tsx` 调用真实 `test_connection`。
- ✅ **平台检测**：废弃无效的 `window.__TAURI_INTERNALS__?.os?.platform`，改由后端 `get_system_info` 返回 os/arch。
- ✅ **磁盘空间**：`system.rs` 用 `sysinfo` 返回真实可用空间；前端不再写死 128.5 GB。
- ✅ **下载链接**：从 `/latest/download/ + 写死文件名` 改为锁定版本的 tag 地址，避免发新版即 404。
- ✅ **数据库并发**：写库前设置 `busy_timeout`。
- ✅ **临时文件**：改为无论成功失败都清理。
- ✅ **安全细节**：API Key 输入框改密码类型（带显示切换）；死链改为真实地址；`select_directory` 空壳命令已删除。
- ✅ **下载健壮性**：流式下载 + 超时。

### 配置机制改版（v2：deeplink 导入）
- ⚙️ 经核对 CC-switch v3.16 源码,确认早期"直接写 SQLite"与新版字段格式系统性不符(Claude 的 claudeDesktopModelRoutes/claudeDesktopMode 为驼峰、值 direct/proxy;Codex 的 apiFormat=openai_chat/openai_responses、modelCatalog 在 meta 为数组、config.toml 用 [model_providers.custom]),易导致导入后测试无效。
- ✅ 已改为调用 CC-switch 官方 deeplink:ccswitch://v1/import?resource=provider&app=claude|codex&apiKey=&endpoint=&enabled=true(&model=)。由 CC-switch 自己写出正确配置并设为当前。已删除 rusqlite 与手写建表/UPSERT。
- ✅ winget 已安装 Codex 时返回非 0 不再误判失败(重跑安全)。
- ⏳ 待 Windows 实测:确认 ccswitch:// 唤起、导入成功、供应商可用;Codex 若为 Chat 形需在 CC-switch 开本地路由开关。

### 仍待处理（需作者环境/决定）
- 🔴 代码签名（Windows SmartScreen / macOS Gatekeeper）。
- 🔴 管理员提权（msiexec 静默安装）。
- 🟡 macOS / Linux 自动静默安装（当前为"下载+提示手动安装"，留有 TODO）。
- 🟡 下载文件 SHA256 / 签名校验。
- 🟡 `config.json` 尚未被代码读取（外部可配置化是后续项）。
