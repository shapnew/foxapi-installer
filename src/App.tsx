import { useState } from "react";
import Welcome from "./components/Welcome";
import License from "./components/License";
import ComponentSelect from "./components/ComponentSelect";
import ProxyConfig from "./components/ProxyConfig";
import Progress from "./components/Progress";
import Complete from "./components/Complete";
import TitleBar from "./components/TitleBar";

export interface InstallConfig {
  apiKey: string;
  apiEndpoint: string;
  installCodex: boolean;
  installCCSwitch: boolean;
  installPath: string;
}

const STEPS = [
  "验证密钥",
  "许可协议",
  "选择组件",
  "代理配置",
  "正在安装",
  "完成",
];

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<InstallConfig>({
    apiKey: "",
    apiEndpoint: "",
    installCodex: true,
    installCCSwitch: true,
    installPath: "",
  });

  const updateConfig = (updates: Partial<InstallConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 5));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const renderStep = () => {
    const props = { config, updateConfig, nextStep, prevStep };

    switch (currentStep) {
      case 0:
        return <Welcome {...props} />;
      case 1:
        return <License {...props} />;
      case 2:
        return <ComponentSelect {...props} />;
      case 3:
        return <ProxyConfig {...props} />;
      case 4:
        return <Progress {...props} />;
      case 5:
        return <Complete {...props} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-bg-primary via-bg-secondary to-primary-50 relative overflow-hidden">
      {/* 装饰性背景元素 */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary-100/30 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-claude-warm/20 to-transparent rounded-full blur-3xl" />

      <TitleBar />

      {/* 步骤指示器 */}
      <div className="px-16 pt-10 pb-8">
        <div className="flex items-center justify-center">
          {STEPS.map((step, index) => (
            <div key={index} className="flex items-center">
              <div className="flex flex-col items-center relative">
                {/* 步骤圆圈 */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                    transition-all duration-300 relative z-10 ${
                    index < currentStep
                      ? "bg-gradient-to-br from-success to-success text-white shadow-md shadow-success/20"
                      : index === currentStep
                        ? "bg-gradient-to-br from-primary-500 to-claude-orange-light text-white shadow-lg shadow-primary-500/30 scale-110"
                        : "bg-bg-card text-text-muted border-2 border-border-subtle shadow-sm"
                  }`}
                >
                  {index < currentStep ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* 步骤名称 */}
                <span
                  className={`text-xs mt-3 whitespace-nowrap transition-all duration-300 ${
                    index === currentStep
                      ? "text-primary-500 font-semibold"
                      : index < currentStep
                        ? "text-success font-medium"
                        : "text-text-muted"
                  }`}
                  style={{ lineHeight: '1.6' }}
                >
                  {step}
                </span>
              </div>

              {/* 连接线 */}
              {index < STEPS.length - 1 && (
                <div className="relative mx-4 mb-7">
                  <div className="w-16 h-0.5 bg-border-subtle rounded-full" />
                  <div
                    className="absolute inset-0 h-0.5 bg-gradient-to-r from-success to-success rounded-full transition-all duration-500"
                    style={{
                      width: index < currentStep ? '100%' : '0%'
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 页面内容 */}
      <div className="flex-1 px-16 pb-10 overflow-hidden">
        <div className="page-enter h-full">{renderStep()}</div>
      </div>
    </div>
  );
}
