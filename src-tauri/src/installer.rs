use anyhow::{Context, Result};
use reqwest::Client;
use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::Duration;

use tauri::ipc::Channel;

use crate::{ApiValidationResult, ProgressUpdate};

// ─── FoxAPI 配置常量 ───────────────────────────────────────────────────────

const PROVIDER_NAME: &str = "FoxAPI";
const WEBSITE_URL: &str = "https://foxapi.chat";
const API_ENDPOINT: &str = "https://foxapi.chat/v1";
/// Codex 默认模型（写入 ~/.codex/config.toml 的 model 字段，由 CC-switch 生成）
const CODEX_DEFAULT_MODEL: &str = "gpt-5.5";

// ─── 进度上报 ─────────────────────────────────────────────────────────────

fn report(progress: &Channel<ProgressUpdate>, task_id: &str, status: &str, pct: u8, log: Option<&str>) {
    let _ = progress.send(ProgressUpdate {
        task_id: task_id.to_string(),
        status: status.to_string(),
        progress: pct,
        log: log.map(|s| s.to_string()),
    });
}

// ─── API Key 验证 ─────────────────────────────────────────────────────────

/// 验证 API Key（请求 FoxAPI 的 /models 接口）
pub async fn validate_api_key(api_key: &str) -> Result<ApiValidationResult> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .context("初始化 HTTP 客户端失败")?;
    let test_url = format!("{}/models", API_ENDPOINT);

    let response = client
        .get(&test_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .context("无法连接到 API 服务器")?;

    if response.status().is_success() {
        Ok(ApiValidationResult {
            valid: true,
            endpoint: API_ENDPOINT.to_string(),
            username: None,
            message: "验证成功".to_string(),
        })
    } else {
        Ok(ApiValidationResult {
            valid: false,
            endpoint: String::new(),
            username: None,
            message: format!("API Key 无效（HTTP {}）", response.status().as_u16()),
        })
    }
}

/// 测试某个端点 + Key 是否连通（供前端"测试连接"按钮使用）
pub async fn test_connection(endpoint: &str, api_key: &str) -> Result<bool> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .context("初始化 HTTP 客户端失败")?;
    let url = format!("{}/models", endpoint.trim_end_matches('/'));

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .context("无法连接到 API 端点")?;

    Ok(response.status().is_success())
}

// ─── 安装流程 ─────────────────────────────────────────────────────────────

pub async fn run_installation(
    api_key: &str,
    api_endpoint: &str,
    install_codex: bool,
    install_ccswitch: bool,
    install_path: &str,
    progress: &Channel<ProgressUpdate>,
) -> Result<bool> {
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(15)) // 死镜像快速失败,便于切换下一个源
        .timeout(Duration::from_secs(600))
        .build()
        .context("初始化 HTTP 客户端失败")?;
    let temp_dir = get_temp_dir()?;

    let outcome = install_steps(
        &client,
        api_key,
        api_endpoint,
        install_codex,
        install_ccswitch,
        install_path,
        &temp_dir,
        progress,
    )
    .await;

    // 清理临时文件 —— 无论成功失败都执行
    report(progress, "cleanup", "running", 30, Some("正在清理临时文件..."));
    if let Err(e) = cleanup_temp(&temp_dir) {
        report(progress, "cleanup", "completed", 100, Some(&format!("清理时出现非致命问题：{}", e)));
    } else {
        report(progress, "cleanup", "completed", 100, Some("临时文件清理完成"));
    }

    outcome.map(|_| true)
}

#[allow(clippy::too_many_arguments)]
async fn install_steps(
    client: &Client,
    api_key: &str,
    api_endpoint: &str,
    install_codex: bool,
    install_ccswitch: bool,
    install_path: &str,
    temp_dir: &Path,
    progress: &Channel<ProgressUpdate>,
) -> Result<()> {
    if !install_path.is_empty() {
        report(
            progress,
            "config",
            "running",
            0,
            Some(&format!(
                "安装目录：{}（注：Codex/CC-switch 安装到各自默认位置，自定义目录暂不生效）",
                install_path
            )),
        );
    }

    // 1. 安装 Codex（仅 Windows：Codex 是微软商店应用，winget 也只有 Windows 有）。
    //    注意：Codex 安装失败【不阻断】后续步骤——很多精简版/LTSC 系统没有 winget 甚至没有商店，
    //    但 CC-switch + FoxAPI 配置才是核心，必须继续完成。
    if install_codex {
        if std::env::consts::OS == "windows" {
            report(progress, "codex", "running", 0, Some("正在安装 Codex（Microsoft Store），可能需要几分钟，请耐心等待..."));
            match download_and_install_codex(progress).await {
                Ok(()) => {
                    report(progress, "codex", "completed", 100, Some("Codex 安装步骤完成"));
                }
                Err(e) => {
                    report(
                        progress,
                        "codex",
                        "error",
                        100,
                        Some(&format!("Codex 未能自动安装：{e}。已跳过，继续安装其余组件（可稍后从微软商店手动安装 Codex）")),
                    );
                }
            }
        } else {
            report(progress, "codex", "completed", 100, Some("当前系统非 Windows，已跳过 Codex（微软商店应用仅 Windows 可用）"));
        }
    }

    // 2. 下载并安装 CC-switch（自动取最新版 + 国内镜像加速）
    if install_ccswitch {
        report(progress, "ccswitch", "running", 0, Some("开始安装 CC-switch..."));
        download_and_install_ccswitch(client, temp_dir, progress).await?;
        report(progress, "ccswitch", "completed", 100, Some("CC-switch 安装完成"));
    }

    // 3. 通过官方 deeplink 把 FoxAPI 导入 CC-switch
    report(progress, "config", "running", 10, Some("正在把 FoxAPI 导入 CC-switch（会唤起 CC-switch 窗口）..."));
    import_providers_via_deeplink(api_key, api_endpoint, install_codex, progress)?;
    report(progress, "config", "completed", 100, Some("已发送导入请求，请在弹出的 CC-switch 中确认"));

    Ok(())
}

// ─── CC-switch 配置：官方 deeplink 导入 ─────────────────────────────────────

/// 对 unreserved 以外的字符做百分号编码（用于拼接 ccswitch:// 查询参数）
fn pct(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

/// 构造一条 ccswitch://v1/import?resource=provider... 深链接
fn build_provider_deeplink(app: &str, api_key: &str, endpoint: &str, model: Option<&str>) -> String {
    let mut url = format!(
        "ccswitch://v1/import?resource=provider&app={app}&name={name}&homepage={home}&apiKey={key}&endpoint={ep}&enabled=true",
        app = app,
        name = pct(PROVIDER_NAME),
        home = pct(WEBSITE_URL),
        key = pct(api_key),
        ep = pct(endpoint),
    );
    if let Some(m) = model {
        url.push_str(&format!("&model={}", pct(m)));
    }
    url
}

/// 按操作系统打开一个 URL / 自定义协议链接（不经过 shell，避免 `&` 被解释）
fn open_url(url: &str) -> Result<()> {
    let os = std::env::consts::OS;
    let result = match os {
        "windows" => Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", url])
            .status(),
        "macos" => Command::new("open").arg(url).status(),
        _ => Command::new("xdg-open").arg(url).status(),
    };
    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(anyhow::anyhow!(
            "无法唤起 CC-switch（打开 ccswitch:// 链接失败）：{e}。请确认 CC-switch 已正确安装。"
        )),
    }
}

/// 通过 deeplink 将 FoxAPI 导入 CC-switch（claude 与 codex）。
fn import_providers_via_deeplink(
    api_key: &str,
    api_endpoint: &str,
    install_codex: bool,
    progress: &Channel<ProgressUpdate>,
) -> Result<()> {
    thread::sleep(Duration::from_secs(1));

    report(progress, "config", "running", 40, Some("导入 Claude Code 供应商..."));
    let claude_url = build_provider_deeplink("claude", api_key, api_endpoint, None);
    open_url(&claude_url)?;

    if install_codex {
        thread::sleep(Duration::from_secs(2));
        report(progress, "config", "running", 70, Some("导入 Codex 供应商..."));
        let codex_url = build_provider_deeplink("codex", api_key, api_endpoint, Some(CODEX_DEFAULT_MODEL));
        open_url(&codex_url)?;
    }

    Ok(())
}

// ─── 临时文件管理 ─────────────────────────────────────────────────────────

fn get_temp_dir() -> Result<PathBuf> {
    let temp_dir = std::env::temp_dir().join("codex-installer");
    fs::create_dir_all(&temp_dir)?;
    Ok(temp_dir)
}

fn cleanup_temp(temp_dir: &Path) -> Result<()> {
    if temp_dir.exists() {
        fs::remove_dir_all(temp_dir)?;
    }
    Ok(())
}

// ─── 文件下载（带真实进度）─────────────────────────────────────────────────

/// 流式下载文件，并把下载进度（占该任务的 0-90%）通过通道上报。
async fn download_file(
    client: &Client,
    url: &str,
    dest: &Path,
    task_id: &str,
    progress: &Channel<ProgressUpdate>,
) -> Result<()> {
    let mut response = client.get(url).send().await?.error_for_status()?;
    let total = response.content_length().unwrap_or(0);
    let mut file = fs::File::create(dest)?;
    let mut downloaded: u64 = 0;

    while let Some(chunk) = response.chunk().await? {
        file.write_all(&chunk)?;
        downloaded += chunk.len() as u64;
        if total > 0 {
            let pct = ((downloaded as f64 / total as f64) * 90.0) as u8;
            report(progress, task_id, "running", pct.min(90), None);
        }
    }

    report(
        progress,
        task_id,
        "running",
        90,
        Some(&format!("下载完成：{:.1} MB", downloaded as f64 / 1024.0 / 1024.0)),
    );
    Ok(())
}

// ─── Codex 安装（Microsoft Store / winget）─────────────────────────────────

const CODEX_STORE_ID: &str = "9plm9xgg6vks";

/// 定位 winget：先试 PATH，再试它的标准安装位置（%LOCALAPPDATA%\Microsoft\WindowsApps）。
/// 后者覆盖"已安装但 PATH/执行别名不可用"的情况。
fn find_winget() -> Option<PathBuf> {
    if Command::new("winget")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Some(PathBuf::from("winget"));
    }
    if let Some(local) = dirs::data_local_dir() {
        let p = local.join("Microsoft").join("WindowsApps").join("winget.exe");
        if p.exists() {
            return Some(p);
        }
    }
    None
}

/// 打开 Codex 的微软商店页面：
/// - 系统有商店 App → 打开商店内的 Codex 详情页（点【获取】即装）
/// - 没有商店（LTSC/精简版）→ 打开微软官网网页版 apps.microsoft.com（浏览器必有，页面上有官方安装/下载按钮）
fn open_codex_store_page(progress: &Channel<ProgressUpdate>) {
    // 通过注册表检测 ms-windows-store 协议是否有处理器（= 是否装有商店）
    let has_store = Command::new("reg")
        .args(["query", "HKCR\\ms-windows-store"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if has_store {
        let url = format!("ms-windows-store://pdp/?ProductId={CODEX_STORE_ID}");
        let _ = Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &url])
            .status();
        report(
            progress,
            "codex",
            "running",
            90,
            Some("已打开微软商店的 Codex 页面，请点击【获取/安装】完成安装（其余组件不受影响，将继续进行）"),
        );
    } else {
        // 官网网页版：无商店的系统也能访问，页面提供官方安装/下载入口
        let url = format!("https://apps.microsoft.com/detail/{CODEX_STORE_ID}?hl=zh-CN&gl=CN");
        let _ = Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &url])
            .status();
        report(
            progress,
            "codex",
            "running",
            90,
            Some("本机未检测到微软商店，已在浏览器打开 Codex 官方页面（apps.microsoft.com），请点击页面上的【Install/下载】按钮安装（其余组件不受影响，将继续进行）"),
        );
    }
}

async fn download_and_install_codex(progress: &Channel<ProgressUpdate>) -> Result<()> {
    // 找不到 winget（精简版/LTSC/未装 App Installer 的老系统很常见）→ 打开商店页面让用户点一下
    let Some(winget) = find_winget() else {
        report(progress, "codex", "running", 50, Some("未检测到 winget，改为打开 Codex 安装页面..."));
        open_codex_store_page(progress);
        return Ok(());
    };

    let output = Command::new(&winget)
        .args([
            "install",
            "--id",
            CODEX_STORE_ID,
            "--source",
            "msstore",
            "--accept-package-agreements",
            "--accept-source-agreements",
        ])
        .output()
        .context("无法启动 winget")?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{stdout}{stderr}");
        let lower = combined.to_lowercase();
        // winget 在"已安装/无可用升级"时也会返回非 0；这类情况视为成功，避免重跑误报失败。
        if lower.contains("already installed")
            || lower.contains("已安装")
            || lower.contains("no available upgrade")
            || lower.contains("no applicable upgrade")
            || lower.contains("无可用升级")
            || lower.contains("无适用于")
        {
            Ok(())
        } else {
            // winget 存在但安装失败（国内访问 msstore 源不稳定很常见）→ 退而打开商店/官网页面手动装
            let brief: String = combined.trim().chars().take(160).collect();
            report(
                progress,
                "codex",
                "running",
                60,
                Some(&format!("winget 自动安装未成功（{brief}），改为打开 Codex 安装页面...")),
            );
            open_codex_store_page(progress);
            Ok(())
        }
    }
}

// ─── CC-switch 安装（GitHub releases，自动取最新版 + 国内镜像加速）───────────

const CCSWITCH_REPO: &str = "farion1231/cc-switch";
/// API 不可达时的回退版本（尽量贴近当前最新）
const CCSWITCH_FALLBACK_VERSION: &str = "v3.16.2";

/// 国内可达的 GitHub 加速镜像（前缀型），按优先级排列；最后回退直连。
/// 形如 https://<mirror>/https://github.com/owner/repo/releases/download/...
const GH_MIRRORS: &[&str] = &[
    "https://ghfast.top/",
    "https://gh-proxy.com/",
    "https://ghproxy.net/",
    "https://github.moeyy.xyz/",
];

/// 通过 GitHub API 解析"最新版本"对应当前平台的下载直链，返回 (资源名, 直链URL)。
/// API 本身也尝试多源（直连 + 镜像），全失败则向上报错，由调用方回退到内置版本。
async fn resolve_ccswitch_asset(client: &Client) -> Result<(String, String)> {
    let api = format!("https://api.github.com/repos/{}/releases/latest", CCSWITCH_REPO);
    let mut api_urls = vec![api.clone()];
    for m in GH_MIRRORS {
        api_urls.push(format!("{m}{api}"));
    }

    let mut value: Option<Value> = None;
    let mut last_err = String::new();
    for u in &api_urls {
        match client
            .get(u.as_str())
            .header("User-Agent", "cc-switch-installer")
            .header("Accept", "application/vnd.github+json")
            .timeout(Duration::from_secs(20))
            .send()
            .await
            .and_then(|r| r.error_for_status())
        {
            Ok(resp) => match resp.json::<Value>().await {
                Ok(v) => {
                    value = Some(v);
                    break;
                }
                Err(e) => last_err = format!("解析响应失败: {e}"),
            },
            Err(e) => last_err = e.to_string(),
        }
    }
    let value = value.ok_or_else(|| anyhow::anyhow!("访问 GitHub API 失败: {last_err}"))?;

    let assets = value
        .get("assets")
        .and_then(|a| a.as_array())
        .ok_or_else(|| anyhow::anyhow!("最新发布缺少 assets 字段"))?;

    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let found = match (os, arch) {
        ("windows", _) => pick_asset(assets, |n| n.ends_with(".msi")),
        ("macos", _) => pick_asset(assets, |n| n.ends_with(".dmg")),
        ("linux", "x86_64") => {
            pick_asset(assets, |n| n.ends_with(".AppImage") && (n.contains("x86_64") || n.contains("amd64")))
        }
        ("linux", "aarch64") => {
            pick_asset(assets, |n| n.ends_with(".AppImage") && (n.contains("arm64") || n.contains("aarch64")))
        }
        _ => None,
    };
    found.ok_or_else(|| anyhow::anyhow!("未找到适配 {os}/{arch} 的 CC-switch 安装包"))
}

fn pick_asset<F: Fn(&str) -> bool>(assets: &[Value], pred: F) -> Option<(String, String)> {
    assets.iter().find_map(|a| {
        let name = a.get("name")?.as_str()?;
        let url = a.get("browser_download_url")?.as_str()?;
        if pred(name) {
            Some((name.to_string(), url.to_string()))
        } else {
            None
        }
    })
}

/// 回退：用内置版本号构造直链（API 完全不可达时）
fn get_ccswitch_fallback_url() -> Result<String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let v = CCSWITCH_FALLBACK_VERSION;
    let asset = match (os, arch) {
        ("windows", _) => format!("CC-Switch-{v}-Windows.msi"),
        ("macos", _) => format!("CC-Switch-{v}-macOS.dmg"),
        ("linux", "x86_64") => format!("CC-Switch-{v}-Linux-x86_64.AppImage"),
        ("linux", "aarch64") => format!("CC-Switch-{v}-Linux-arm64.AppImage"),
        _ => anyhow::bail!("不支持的操作系统或架构: {} {}", os, arch),
    };
    Ok(format!("https://github.com/{}/releases/download/{}/{}", CCSWITCH_REPO, v, asset))
}

/// 把直链扩展成"镜像优先 + 直连兜底"的候选列表
fn build_download_candidates(direct_url: &str) -> Vec<String> {
    let mut v: Vec<String> = GH_MIRRORS.iter().map(|m| format!("{m}{direct_url}")).collect();
    v.push(direct_url.to_string());
    v
}

/// 提取 URL 的主机名用于日志展示
fn host_of(url: &str) -> String {
    url.split("://")
        .nth(1)
        .and_then(|s| s.split('/').next())
        .unwrap_or(url)
        .to_string()
}

async fn download_and_install_ccswitch(
    client: &Client,
    temp_dir: &Path,
    progress: &Channel<ProgressUpdate>,
) -> Result<()> {
    // 1. 解析最新版本直链（失败则回退内置版本）
    report(progress, "ccswitch", "running", 0, Some("正在获取 CC-switch 最新版本..."));
    let direct_url = match resolve_ccswitch_asset(client).await {
        Ok((name, url)) => {
            report(progress, "ccswitch", "running", 0, Some(&format!("最新版本资源：{name}")));
            url
        }
        Err(e) => {
            let url = get_ccswitch_fallback_url()?;
            report(
                progress,
                "ccswitch",
                "running",
                0,
                Some(&format!("获取最新版失败（{e}），回退到内置版本 {CCSWITCH_FALLBACK_VERSION}")),
            );
            url
        }
    };

    // 2. 多源下载（国内镜像优先，直连兜底）
    let os = std::env::consts::OS;
    let filename = match os {
        "windows" => "cc-switch.msi",
        "macos" => "cc-switch.dmg",
        "linux" => "cc-switch.AppImage",
        _ => "cc-switch",
    };
    let installer_path = temp_dir.join(filename);

    let candidates = build_download_candidates(&direct_url);
    let total_sources = candidates.len();
    let mut last_err = String::new();
    let mut ok = false;
    for (i, url) in candidates.iter().enumerate() {
        report(
            progress,
            "ccswitch",
            "running",
            0,
            Some(&format!("尝试下载源 {}/{}：{}", i + 1, total_sources, host_of(url))),
        );
        match download_file(client, url, &installer_path, "ccswitch", progress).await {
            Ok(()) => {
                ok = true;
                break;
            }
            Err(e) => {
                last_err = e.to_string();
                report(progress, "ccswitch", "running", 0, Some(&format!("源 {} 失败，换下一个…", host_of(url))));
            }
        }
    }
    if !ok {
        anyhow::bail!("CC-switch 下载失败（已尝试 {} 个源）。最后错误：{}", total_sources, last_err);
    }

    // 3. 安装
    finalize_ccswitch_install(&installer_path, progress)?;
    Ok(())
}

// ─── macOS：挂载 dmg → 拷贝 .app 到 Applications ────────────────────────────

fn install_dmg_macos(dmg: &Path) -> Result<()> {
    let dmg_str = dmg.to_str().context("dmg 路径非法")?;

    // 用固定挂载点挂载——不解析 hdiutil 输出（-quiet 下可能无输出，解析不可靠）
    let mount_dir = std::env::temp_dir().join("ccswitch-dmg-mount");
    let mount = mount_dir.to_str().context("挂载点路径非法")?.to_string();
    // 清理可能的残留挂载，再确保目录存在
    let _ = Command::new("hdiutil").args(["detach", "-quiet", &mount]).status();
    fs::create_dir_all(&mount_dir)?;

    let out = Command::new("hdiutil")
        .args(["attach", "-nobrowse", "-quiet", "-mountpoint", &mount, dmg_str])
        .output()
        .context("无法运行 hdiutil")?;
    if !out.status.success() {
        anyhow::bail!("挂载 dmg 失败：{}", String::from_utf8_lossy(&out.stderr));
    }

    // 在挂载卷里找到 .app，拷贝到 /Applications（不可写则退回 ~/Applications）
    let result = (|| -> Result<()> {
        let app_path = fs::read_dir(&mount)?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .find(|p| p.extension().and_then(|x| x.to_str()) == Some("app"))
            .context("dmg 内未找到 .app")?;
        let app_name = app_path.file_name().context("无法取得 .app 名称")?;
        let app_src = app_path.to_str().context(".app 路径非法")?;

        // 先尝试 /Applications
        let sys_dest = PathBuf::from("/Applications").join(app_name);
        if sys_dest.exists() {
            let _ = fs::remove_dir_all(&sys_dest);
        }
        let cp_ok = Command::new("cp")
            .args(["-R", app_src, "/Applications/"])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);

        let final_app = if cp_ok {
            sys_dest
        } else {
            // 退回到用户目录 ~/Applications（无需管理员权限）
            let home_apps = dirs::home_dir().context("无法定位主目录")?.join("Applications");
            fs::create_dir_all(&home_apps)?;
            let dest = home_apps.join(app_name);
            if dest.exists() {
                let _ = fs::remove_dir_all(&dest);
            }
            let st = Command::new("cp")
                .args(["-R", app_src, home_apps.to_str().context("路径非法")?])
                .status()
                .context("拷贝 .app 失败")?;
            if !st.success() {
                anyhow::bail!("拷贝 CC-switch 到 Applications 失败（可能需要权限）");
            }
            dest
        };

        // 去掉隔离属性（避免 Gatekeeper 拦截），并启动一次以注册 ccswitch:// 协议
        if let Some(s) = final_app.to_str() {
            let _ = Command::new("xattr").args(["-dr", "com.apple.quarantine", s]).status();
            let _ = Command::new("open").arg(s).status();
        }
        Ok(())
    })();

    // 始终卸载
    let _ = Command::new("hdiutil").args(["detach", "-quiet", &mount]).status();
    result
}

// ─── Linux：放置 AppImage + 建桌面项（含 ccswitch:// 协议）────────────────────

fn install_appimage_linux(appimage: &Path) -> Result<PathBuf> {
    let home = dirs::home_dir().context("无法定位主目录")?;
    let bin_dir = home.join(".local/bin");
    fs::create_dir_all(&bin_dir)?;
    let dest = bin_dir.join("cc-switch.AppImage");
    fs::copy(appimage, &dest)?;
    if let Some(s) = dest.to_str() {
        let _ = Command::new("chmod").args(["+x", s]).status();
    }

    // 创建 .desktop（含 ccswitch:// 协议处理，供 deeplink 导入用）
    let apps_dir = home.join(".local/share/applications");
    fs::create_dir_all(&apps_dir)?;
    let desktop = format!(
        "[Desktop Entry]\nType=Application\nName=CC-Switch\nComment=Claude/Codex provider switcher\nExec=\"{exec}\" %u\nIcon=cc-switch\nTerminal=false\nCategories=Utility;Development;\nMimeType=x-scheme-handler/ccswitch;\n",
        exec = dest.display()
    );
    fs::write(apps_dir.join("cc-switch.desktop"), desktop)?;

    // 刷新桌面数据库 + 显式把 ccswitch:// 协议绑定到该 .desktop（部分桌面环境仅有 MimeType 不够）
    let _ = Command::new("update-desktop-database").arg(&apps_dir).status();
    let _ = Command::new("xdg-mime")
        .args(["default", "cc-switch.desktop", "x-scheme-handler/ccswitch"])
        .status();

    // 启动一次（best-effort）。若因缺 libfuse2 启动失败，给出明确提示而不是默默失败。
    if let Some(s) = dest.to_str() {
        match Command::new(s).spawn() {
            Ok(_) => {}
            Err(e) => {
                anyhow::bail!(
                    "CC-switch 已放置到 {dest}，但启动失败：{e}。\n常见原因：系统缺少 AppImage 运行所需的 libfuse2。\n请运行: sudo apt install libfuse2 （Ubuntu/Debian）或 sudo dnf install fuse-libs （Fedora）后，手动运行 {dest}",
                    dest = dest.display(),
                );
            }
        }
    }

    Ok(dest)
}

// ─── 安装动作（按平台区分）──────────────────────────────────────────────────

fn finalize_ccswitch_install(installer_path: &Path, progress: &Channel<ProgressUpdate>) -> Result<()> {
    let os = std::env::consts::OS;
    let filename = installer_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("cc-switch");
    let path_str = installer_path.to_str().context("安装包路径包含非法字符")?;

    match os {
        "windows" => {
            if filename.ends_with(".msi") {
                report(progress, "ccswitch", "running", 95, Some("正在静默安装 CC-switch（MSI）..."));
                let status = Command::new("msiexec")
                    .args(["/i", path_str, "/quiet", "/norestart"])
                    .status()
                    .context("无法启动 msiexec")?;
                if !status.success() {
                    anyhow::bail!(
                        "MSI 安装失败，退出码: {:?}。提示：静默安装通常需要管理员权限，请右键以管理员身份运行本程序后重试。",
                        status.code()
                    );
                }
            } else if filename.ends_with(".exe") {
                report(progress, "ccswitch", "running", 95, Some("正在静默安装 CC-switch（EXE）..."));
                let status = Command::new(installer_path)
                    .args(["/S", "/silent", "/verysilent", "/quiet", "/norestart"])
                    .status()
                    .context("无法启动安装程序")?;
                if !status.success() {
                    anyhow::bail!("EXE 安装失败，退出码: {:?}", status.code());
                }
            } else {
                anyhow::bail!("未知的 Windows 安装包类型: {}", filename);
            }
        }
        "macos" => {
            report(progress, "ccswitch", "running", 95, Some("正在挂载并安装 CC-switch（macOS）..."));
            install_dmg_macos(installer_path)?;
            report(progress, "ccswitch", "running", 98, Some("CC-switch 已安装到 应用程序（/Applications）"));
        }
        "linux" => {
            report(progress, "ccswitch", "running", 95, Some("正在安装 CC-switch（Linux AppImage）..."));
            let dest = install_appimage_linux(installer_path)?;
            report(progress, "ccswitch", "running", 98, Some(&format!("CC-switch 已安装：{}", dest.display())));
        }
        _ => anyhow::bail!("不支持的操作系统: {}", os),
    }

    Ok(())
}
