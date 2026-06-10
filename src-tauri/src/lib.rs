use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

mod installer;
mod system;

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiValidationResult {
    pub valid: bool,
    pub endpoint: String,
    pub username: Option<String>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub disk_free_gb: f64,
}

/// 安装进度事件：通过 Channel 实时推送给前端。
/// 字段经 serde 转成 camelCase，前端读到的是 taskId / status / progress / log。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressUpdate {
    /// 对应前端任务的 id：codex / ccswitch / config / cleanup
    pub task_id: String,
    /// 状态：running / completed / error
    pub status: String,
    /// 该任务进度 0-100
    pub progress: u8,
    /// 可选日志行（为 null 时前端不追加日志）
    pub log: Option<String>,
}

// 验证 API Key
#[tauri::command]
async fn validate_api_key(api_key: String) -> Result<ApiValidationResult, String> {
    installer::validate_api_key(&api_key)
        .await
        .map_err(|e| e.to_string())
}

// 测试 API 端点连通性（使用前端实际填写的 endpoint）
#[tauri::command]
async fn test_connection(endpoint: String, api_key: String) -> Result<bool, String> {
    installer::test_connection(&endpoint, &api_key)
        .await
        .map_err(|e| e.to_string())
}

// 获取系统信息
#[tauri::command]
async fn get_system_info() -> Result<SystemInfo, String> {
    system::get_system_info().map_err(|e| e.to_string())
}

// 执行安装（通过 on_progress 通道实时上报进度）
#[tauri::command]
async fn run_installation(
    api_key: String,
    api_endpoint: String,
    install_codex: bool,
    install_ccswitch: bool,
    install_path: String,
    on_progress: Channel<ProgressUpdate>,
) -> Result<bool, String> {
    installer::run_installation(
        &api_key,
        &api_endpoint,
        install_codex,
        install_ccswitch,
        &install_path,
        &on_progress,
    )
    .await
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            validate_api_key,
            test_connection,
            get_system_info,
            run_installation
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
