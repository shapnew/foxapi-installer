import { useState } from "react";
import { Key, ArrowRight, Loader2, AlertCircle, Sparkles, Shield, Zap, Eye, EyeOff } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { InstallConfig } from "../App";

interface Props {
  config: InstallConfig;
  updateConfig: (updates: Partial<InstallConfig>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

interface ApiValidationResult {
  valid: boolean;
  endpoint: string;
  username: string | null;
  message: string;
}

export default function Welcome({ config, updateConfig, nextStep }: Props) {
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [isValidating, setIsValidating] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");

  const handleValidate = async () => {
    if (!apiKey.trim()) {
      setError("请输入 API Key");
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      if (window.__TAURI_INTERNALS__) {
        // 真实验证：调用后端 validate_api_key
        const result = await invoke<ApiValidationResult>("validate_api_key", {
          apiKey: apiKey.trim(),
        });
        if (!result.valid) {
          setError(result.message || "API Key 无效，请检查后重试");
          return;
        }
        // 成功后填入后端返回的真实端点
        updateConfig({ apiKey: apiKey.trim(), apiEndpoint: result.endpoint });
      } else {
        // 浏览器预览模式（非 Tauri）：跳过真实验证，便于本地调试 UI
        updateConfig({ apiKey: apiKey.trim(), apiEndpoint: "https://foxapi.chat/v1" });
      }
      nextStep();
    } catch (err) {
      setError(typeof err === "string" ? err : "API Key 验证失败，请检查网络后重试");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center px-4 relative">
      {/* 装饰性背景 */}
      <div className="absolute inset-0 bg-pattern pointer-events-none" />

      {/* 内容区域 */}
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
        {/* Logo 区域 */}
        <div className="mb-8 relative">
          {/* 光晕效果 */}
          <div className="absolute inset-0 w-24 h-24 bg-gradient-to-br from-primary-500/20 to-claude-orange-light/20 rounded-3xl blur-xl" />

          {/* Logo 主体 */}
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500 via-claude-orange to-claude-orange-light
            flex items-center justify-center logo-glow
            shadow-xl shadow-primary-500/30">
            <span className="text-white text-4xl font-bold drop-shadow-md">F</span>
          </div>

          {/* 装饰点 */}
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-warning rounded-full opacity-60" />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary-300 rounded-full opacity-40" />
        </div>

        {/* 标题区域 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold text-text-primary mb-4" style={{ lineHeight: '1.4' }}>
            <span className="text-gradient">Codex</span>
            <span className="text-text-secondary mx-3">&</span>
            <span className="text-gradient">CC-switch</span>
          </h1>
          <p className="text-base text-text-secondary" style={{ lineHeight: '2' }}>
            一键安装 AI 工具，自动配置您的专属中转站
          </p>
        </div>

        {/* 特性亮点 */}
        <div className="flex gap-8 mb-12">
          <div className="flex items-center gap-2.5 text-sm text-text-muted">
            <Zap size={18} className="text-warning" />
            <span style={{ lineHeight: '1.6' }}>快速安装</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-text-muted">
            <Shield size={18} className="text-success" />
            <span style={{ lineHeight: '1.6' }}>安全配置</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-text-muted">
            <Sparkles size={18} className="text-primary-500" />
            <span style={{ lineHeight: '1.6' }}>智能优化</span>
          </div>
        </div>

        {/* API Key 输入卡片 */}
        <div className="w-full bg-bg-card rounded-2xl border border-border-subtle p-10 shadow-lg shadow-primary-500/5 card-hover">
          {/* 卡片标题 */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
              <Key size={22} className="text-primary-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary" style={{ lineHeight: '1.4' }}>
                验证您的身份
              </h2>
              <p className="text-sm text-text-muted mt-1" style={{ lineHeight: '1.8' }}>
                输入 API Key 以开始安装
              </p>
            </div>
          </div>

          {/* 输入框 */}
          <div className="relative mb-6">
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError("");
                }}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                className={`w-full px-5 py-4 pr-12 rounded-xl border-2 text-sm transition-all duration-200
                  bg-bg-secondary text-text-primary placeholder-text-muted input-soft
                  ${error
                    ? "border-error focus:border-error"
                    : "border-border-subtle hover:border-border-hover focus:border-primary-500 focus:shadow-[0_0_0_3px_rgba(217,119,87,0.1)]"
                  }
                  focus:outline-none`}
                style={{ lineHeight: '1.8' }}
                onKeyDown={(e) => e.key === "Enter" && handleValidate()}
              />
              {/* 显示/隐藏密钥 */}
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                aria-label={showKey ? "隐藏密钥" : "显示密钥"}
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && (
              <div className="flex items-center gap-2 mt-4 text-error text-sm" style={{ lineHeight: '1.6' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* 验证按钮 */}
          <button
            onClick={handleValidate}
            disabled={isValidating || !apiKey.trim()}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-primary-500 to-claude-orange-light text-white font-semibold
              hover:from-primary-600 hover:to-primary-500 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/35
              flex items-center justify-center gap-2.5 btn-hover-lift btn-inner-shadow"
            style={{ lineHeight: '1.6' }}
          >
            {isValidating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>正在验证...</span>
              </>
            ) : (
              <>
                <span>验证并开始安装</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>

          {/* 分隔线 */}
          <div className="divider-gradient h-px my-8" />

          {/* 底部提示 */}
          <div className="text-center">
            <p className="text-sm text-text-muted" style={{ lineHeight: '1.8' }}>
              还没有 API Key？{" "}
              <a
                href="https://foxapi.chat"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
              >
                立即获取
              </a>
            </p>
          </div>
        </div>

        {/* 版本信息 */}
        <p className="text-xs text-text-muted mt-10 opacity-60" style={{ lineHeight: '1.6' }}>
          v1.0.0 · Powered by FoxAPI
        </p>
      </div>
    </div>
  );
}
