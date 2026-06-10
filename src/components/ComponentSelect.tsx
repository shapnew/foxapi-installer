import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Package, Monitor, Settings } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { InstallConfig } from "../App";

interface Props {
  config: InstallConfig;
  updateConfig: (updates: Partial<InstallConfig>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

interface SystemInfo {
  os: string;
  arch: string;
  diskFreeGb: number;
}

export default function ComponentSelect({ config, updateConfig, nextStep, prevStep }: Props) {
  // 默认按 Windows 处理;非 Tauri 预览也按 Windows 显示全部
  const [isWindows, setIsWindows] = useState(true);

  useEffect(() => {
    if (!window.__TAURI_INTERNALS__) return;
    invoke<SystemInfo>("get_system_info")
      .then((info) => {
        const win = info.os === "windows";
        setIsWindows(win);
        // 非 Windows 不能装 Codex(微软商店应用),强制关闭
        if (!win && config.installCodex) {
          updateConfig({ installCodex: false });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const codexMb = isWindows && config.installCodex ? 150 : 0;
  const ccMb = config.installCCSwitch ? 50 : 0;

  return (
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <Package size={20} className="text-primary-500" />
        <h2 className="text-xl font-semibold text-text-primary">选择组件</h2>
      </div>
      <p className="text-text-secondary mb-6">
        {isWindows
          ? "选择您需要安装的组件，推荐全部安装以获得最佳体验"
          : "当前系统将安装 CC-switch 并自动配置 FoxAPI（Codex 仅 Windows 可用）"}
      </p>

      {/* 组件列表 */}
      <div className="flex-1 space-y-4 mb-6">
        {/* Codex —— 仅 Windows 显示 */}
        {isWindows && (
          <label
            className={`block rounded-xl border-2 p-5 cursor-pointer transition-all duration-200 ${
              config.installCodex
                ? "border-primary-500 bg-primary-50 shadow-sm shadow-primary-500/10"
                : "border-border bg-bg-primary hover:border-border-hover"
            }`}
          >
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                checked={config.installCodex}
                onChange={(e) => updateConfig({ installCodex: e.target.checked })}
                className="mt-1 w-5 h-5 rounded border-border text-primary-500 focus:ring-primary-500 accent-primary-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Monitor size={20} className="text-primary-500" />
                  <h3 className="text-lg font-medium text-text-primary">
                    Codex 桌面端
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted text-xs">
                    Windows
                  </span>
                </div>
                <p className="text-sm text-text-secondary">
                  AI 编程助手桌面应用程序，支持代码生成、问答和自动化任务
                </p>
                <p className="text-xs text-text-muted mt-2">所需空间：约 150 MB</p>
              </div>
            </div>
          </label>
        )}

        {/* CC-switch */}
        <label
          className={`block rounded-xl border-2 p-5 cursor-pointer transition-all duration-200 ${
            config.installCCSwitch
              ? "border-primary-500 bg-primary-50 shadow-sm shadow-primary-500/10"
              : "border-border bg-bg-primary hover:border-border-hover"
          }`}
        >
          <div className="flex items-start gap-4">
            <input
              type="checkbox"
              checked={config.installCCSwitch}
              onChange={(e) => updateConfig({ installCCSwitch: e.target.checked })}
              className="mt-1 w-5 h-5 rounded border-border text-primary-500 focus:ring-primary-500 accent-primary-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Settings size={20} className="text-primary-500" />
                <h3 className="text-lg font-medium text-text-primary">
                  CC-switch 配置工具
                </h3>
              </div>
              <p className="text-sm text-text-secondary">
                Claude Code 配置切换工具，支持多配置管理和快速切换
              </p>
              <p className="text-xs text-text-muted mt-2">所需空间：约 50 MB</p>
            </div>
          </div>
        </label>
      </div>

      {/* 总计空间 */}
      <div className="bg-bg-secondary rounded-lg px-4 py-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">总计所需空间：</span>
          <span className="text-text-primary font-medium">约 {codexMb + ccMb} MB</span>
        </div>
      </div>

      {/* 导航按钮 */}
      <div className="flex justify-between">
        <button
          onClick={prevStep}
          className="px-6 py-2.5 rounded-lg border border-border text-text-secondary font-medium
            hover:bg-bg-secondary hover:border-border-hover transition-all duration-200
            flex items-center gap-2"
        >
          <ArrowLeft size={18} />
          <span>上一步</span>
        </button>
        <button
          onClick={nextStep}
          disabled={!config.installCodex && !config.installCCSwitch}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary-500 to-claude-orange-light text-white font-medium
            hover:from-primary-600 hover:to-primary-500 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-md shadow-primary-500/25 hover:shadow-lg
            flex items-center gap-2"
        >
          <span>下一步</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
