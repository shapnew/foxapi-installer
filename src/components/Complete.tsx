import { CheckCircle, Monitor, Settings, ExternalLink } from "lucide-react";
import type { InstallConfig } from "../App";

interface Props {
  config: InstallConfig;
  updateConfig: (updates: Partial<InstallConfig>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export default function Complete({ config }: Props) {
  const handleFinish = async () => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().close();
      } else {
        alert("安装完成！（浏览器预览模式）");
      }
    } catch (e) {
      // 关闭失败不致命：打印日志，避免按钮看起来"无反应"
      console.error("关闭窗口失败：", e);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center">
      {/* 成功图标 */}
      <div className="success-check mb-6">
        <div className="w-20 h-20 rounded-full bg-success-light flex items-center justify-center">
          <CheckCircle size={48} className="text-success" />
        </div>
      </div>

      {/* 标题 */}
      <h1 className="text-2xl font-semibold text-text-primary mb-2">
        安装完成
      </h1>
      <p className="text-text-secondary mb-8">
        所有组件已安装，FoxAPI 已导入 CC-switch
      </p>

      {/* 安装信息 */}
      <div className="w-full max-w-md space-y-3 mb-8">
        {config.installCodex && (
          <div className="flex items-center gap-3 bg-bg-secondary rounded-lg p-4 border border-border">
            <Monitor size={20} className="text-primary-500" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-text-primary">
                Codex 桌面端
              </h3>
              <p className="text-xs text-text-muted">已安装</p>
            </div>
            <CheckCircle size={18} className="text-success" />
          </div>
        )}

        {config.installCCSwitch && (
          <div className="flex items-center gap-3 bg-bg-secondary rounded-lg p-4 border border-border">
            <Settings size={20} className="text-primary-500" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-text-primary">
                CC-switch 配置工具
              </h3>
              <p className="text-xs text-text-muted">已安装并导入 FoxAPI</p>
            </div>
            <CheckCircle size={18} className="text-success" />
          </div>
        )}

        <div className="flex items-center gap-3 bg-success-light rounded-lg p-4 border border-success/30">
          <CheckCircle size={20} className="text-success" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-text-primary">
              FoxAPI 供应商
            </h3>
            <p className="text-xs text-text-muted">已通过 CC-switch 导入并设为当前</p>
          </div>
        </div>
      </div>

      {/* 提示：CC-switch 已自动打开 */}
      <div className="w-full max-w-md bg-primary-50 rounded-xl border border-primary-200 p-4 mb-8">
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">下一步：</strong>
          CC-switch 已自动打开并显示 FoxAPI 供应商，点击其中的「测试连接」即可开始使用。
          若 CC-switch 未弹出，请从开始菜单手动打开。
        </p>
      </div>

      {/* 完成按钮 */}
      <button
        onClick={handleFinish}
        className="px-10 py-3 rounded-lg bg-gradient-to-r from-primary-500 to-claude-orange-light text-white font-medium
          hover:from-primary-600 hover:to-primary-500 transition-all duration-200
          shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30
          flex items-center gap-2 text-lg"
      >
        <span>完成并关闭</span>
        <ExternalLink size={20} />
      </button>
    </div>
  );
}
