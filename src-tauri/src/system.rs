use anyhow::Result;
use sysinfo::Disks;

use crate::SystemInfo;

/// 获取系统信息
pub fn get_system_info() -> Result<SystemInfo> {
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    let disk_free_gb = get_disk_free_space();

    Ok(SystemInfo {
        os,
        arch,
        disk_free_gb,
    })
}

/// 获取磁盘可用空间（GB）。
///
/// 用 sysinfo 枚举所有磁盘，取可用空间最大的那块作为参考值
/// （安装目标盘在后续步骤才确定，这里给出一个真实、合理的估计，
/// 远比之前硬编码的 128.5 GB 靠谱）。失败时返回 0.0，由前端做友好提示。
fn get_disk_free_space() -> f64 {
    let disks = Disks::new_with_refreshed_list();
    let max_free = disks
        .list()
        .iter()
        .map(|d| d.available_space())
        .max()
        .unwrap_or(0);
    max_free as f64 / 1024.0 / 1024.0 / 1024.0
}
