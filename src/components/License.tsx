import { useState } from "react";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import type { InstallConfig } from "../App";

interface Props {
  config: InstallConfig;
  updateConfig: (updates: Partial<InstallConfig>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export default function License({ nextStep, prevStep }: Props) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <FileText size={20} className="text-primary-500" />
        <h2 className="text-xl font-semibold text-text-primary">许可协议</h2>
      </div>

      {/* 协议内容 */}
      <div className="flex-1 bg-bg-secondary rounded-xl border border-border p-6 overflow-y-auto mb-6">
        <div className="prose prose-sm max-w-none text-text-secondary">
          <h3 className="text-text-primary font-medium mb-3">软件许可协议</h3>
          <p className="mb-3">
            本协议是您（"用户"）与中转站服务提供商（"我们"）之间关于使用
            Codex 桌面端和 CC-switch 工具的法律协议。
          </p>

          <h4 className="text-text-primary font-medium mt-4 mb-2">1. 许可授予</h4>
          <p className="mb-3">
            我们授予您有限的、非独占的、不可转让的许可，允许您在遵守本协议条款的前提下安装和使用本软件。
          </p>

          <h4 className="text-text-primary font-medium mt-4 mb-2">2. 使用限制</h4>
          <ul className="list-disc list-inside mb-3 space-y-1">
            <li>不得对软件进行反向工程、反编译或拆解</li>
            <li>不得将软件用于非法目的</li>
            <li>不得转让、出租或分发软件许可</li>
          </ul>

          <h4 className="text-text-primary font-medium mt-4 mb-2">3. 免责声明</h4>
          <p className="mb-3">
            本软件按"现状"提供，不作任何明示或暗示的保证。我们不对因使用本软件而产生的任何直接、间接、偶然、特殊或后果性损害承担责任。
          </p>

          <h4 className="text-text-primary font-medium mt-4 mb-2">4. 隐私政策</h4>
          <p className="mb-3">
            我们重视您的隐私。API Key 等敏感信息仅存储在本地，不会上传至我们的服务器。
          </p>

          <h4 className="text-text-primary font-medium mt-4 mb-2">5. 协议变更</h4>
          <p>
            我们保留随时修改本协议的权利。协议变更将在软件更新时通知用户。
          </p>
        </div>
      </div>

      {/* 同议复选框 */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="checkbox"
          id="agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="w-5 h-5 rounded border-border text-primary-500 focus:ring-primary-500 cursor-pointer accent-primary-500"
        />
        <label htmlFor="agree" className="text-sm text-text-secondary cursor-pointer">
          我已阅读并同意上述许可协议
        </label>
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
          disabled={!agreed}
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
