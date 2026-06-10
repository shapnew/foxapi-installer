import { Minus, X } from "lucide-react";

export default function TitleBar() {
  const isTauri = window.__TAURI_INTERNALS__ !== undefined;

  const handleMinimize = async () => {
    if (isTauri) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    }
  };

  const handleClose = async () => {
    if (isTauri) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="h-14 flex items-center justify-between px-6 bg-bg-card/80 backdrop-blur-md border-b border-border-subtle"
    >
      {/* 左侧 Logo 和标题 */}
      <div className="flex items-center gap-3" data-tauri-drag-region>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-claude-orange-light
          flex items-center justify-center shadow-sm shadow-primary-500/20">
          <span className="text-white text-sm font-bold drop-shadow-sm">F</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-text-primary" style={{ lineHeight: '1.4' }}>
            Codex & CC-switch
          </span>
          <span className="text-xs text-text-muted px-3 py-1 bg-bg-tertiary rounded-full" style={{ lineHeight: '1.4' }}>
            安装程序
          </span>
        </div>
      </div>

      {/* 右侧窗口控制按钮 */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleMinimize}
          className="w-12 h-9 flex items-center justify-center rounded-md hover:bg-bg-tertiary transition-all duration-150"
        >
          <Minus size={16} className="text-text-muted" />
        </button>
        <button
          onClick={handleClose}
          className="w-12 h-9 flex items-center justify-center rounded-md hover:bg-error/90 hover:text-white transition-all duration-150 group"
        >
          <X size={16} className="text-text-muted group-hover:text-white" />
        </button>
      </div>
    </div>
  );
}
