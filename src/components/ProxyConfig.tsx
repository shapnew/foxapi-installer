import { useState } from "react";
import { ArrowLeft, ArrowRight, Globe, CheckCircle, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { InstallConfig } from "../App";

interface Props {
  config: InstallConfig;
  updateConfig: (updates: Partial<InstallConfig>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export default function ProxyConfig({ config, updateConfig, nextStep, prevStep }: Props) {
  const [endpoint, setEndpoint] = useState(config.apiEndpoint || "https://foxapi.chat/v1");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      let ok = true;
      if (window.__TAURI_INTERNALS__) {
        // 真实测试：请求 {endpoint}/models
        ok = await invoke<boolean>("test_connection", {
          endpoint,
          apiKey: config.apiKey,
        });
      } else {
        // 浏览器预览模式
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      setTestResult(ok ? "success" : "error");
      if (ok) updateConfig({ apiEndpoint: endpoint });
    } catch {
      setTestResult("error");
    } finally {
      setIsTesting(false);
    }
  };

  const handleNext = () => {
    updateConfig({ apiEndpoint: endpoint });
    nextStep();
  };

  return (
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <Globe size={20} className="text-primary-500" />
        <h2 className="text-xl font-semibold text-text-primary">代理配置</h2>
      </div>
      <p className="text-text-secondary mb-6">
        确认中转站 API 配置，此配置将自动写入 Codex 和 CC-switch
      </p>

      {/* 配置卡片 */}
      <div className="flex-1 space-y-6">
        {/* API 地址 */}
        <div className="bg-bg-primary rounded-xl border border-border p-5">
          <label className="block text-sm font-medium text-text-primary mb-2">
            API 端点地址
          </label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => {
              setEndpoint(e.target.value);
              setTestResult(null);
            }}
            className="w-full px-4 py-3 rounded-lg border border-border bg-bg-secondary text-text-primary text-sm
              focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
              transition-all duration-200"
            placeholder="https://foxapi.chat/v1"
          />
        </div>

        {/* API Key */}
        <div className="bg-bg-primary rounded-xl border border-border p-5">
          <label className="block text-sm font-medium text-text-primary mb-2">
            API Key
          </label>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={config.apiKey}
              disabled
              className="flex-1 px-4 py-3 rounded-lg border border-border bg-bg-tertiary text-text-muted text-sm"
            />
            <CheckCircle size={18} className="text-success" />
            <span className="text-sm text-success">已验证</span>
          </div>
        </div>

        {/* 测试连接 */}
        <div className="bg-bg-secondary rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-primary">连接测试</h3>
            <button
              onClick={handleTest}
              disabled={isTesting || !endpoint}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-text-secondary
                hover:bg-bg-primary hover:border-border-hover transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-2"
            >
              {isTesting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>测试中...</span>
                </>
              ) : (
                <span>测试连接</span>
              )}
            </button>
          </div>

          {testResult === "success" && (
            <div className="flex items-center gap-2 text-success text-sm">
              <CheckCircle size={16} />
              <span>连接成功！API 端点可用</span>
            </div>
          )}
          {testResult === "error" && (
            <div className="flex items-center gap-2 text-error text-sm">
              <span>连接失败，请检查端点地址或 API Key</span>
            </div>
          )}
          {!testResult && !isTesting && (
            <p className="text-sm text-text-muted">点击"测试连接"验证配置是否正确</p>
          )}
        </div>
      </div>

      {/* 导航按钮 */}
      <div className="flex justify-between mt-6">
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
          onClick={handleNext}
          disabled={!endpoint}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary-500 to-claude-orange-light text-white font-medium
            hover:from-primary-600 hover:to-primary-500 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-md shadow-primary-500/25 hover:shadow-lg
            flex items-center gap-2"
        >
          <span>开始安装</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
