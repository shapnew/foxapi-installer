import { useState, useEffect, useRef, type ReactNode } from "react";
import { Loader2, CheckCircle, FileDown, Settings, Trash2, AlertCircle, RotateCcw } from "lucide-react";
import { invoke, Channel } from "@tauri-apps/api/core";
import type { InstallConfig } from "../App";

interface Props {
  config: InstallConfig;
  updateConfig: (updates: Partial<InstallConfig>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

interface Task {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  progress: number;
}

// 后端通过 Channel 推送的进度事件（与 Rust 的 ProgressUpdate 对应）
interface ProgressUpdate {
  taskId: string;
  status: "running" | "completed" | "error";
  progress: number;
  log: string | null;
}

// 根据用户选择的组件，动态构建任务列表（只列出真正会执行的步骤）
function buildTasks(config: InstallConfig): Task[] {
  const list: Task[] = [];
  if (config.installCodex)
    list.push({ id: "codex", name: "安装 Codex 桌面端", status: "pending", progress: 0 });
  if (config.installCCSwitch)
    list.push({ id: "ccswitch", name: "下载并安装 CC-switch", status: "pending", progress: 0 });
  list.push({ id: "config", name: "导入 FoxAPI 到 CC-switch", status: "pending", progress: 0 });
  list.push({ id: "cleanup", name: "清理临时文件", status: "pending", progress: 0 });
  return list;
}

export default function Progress({ config, nextStep }: Props) {
  const [tasks, setTasks] = useState<Task[]>(() => buildTasks(config));
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  const totalProgress = tasks.reduce((sum, t) => sum + t.progress, 0) / Math.max(tasks.length, 1);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const runReal = async () => {
    const channel = new Channel<ProgressUpdate>();
    channel.onmessage = (msg) => {
      updateTask(msg.taskId, { status: msg.status, progress: msg.progress });
      if (msg.log) addLog(msg.log);
    };

    addLog("开始安装...");
    await invoke<boolean>("run_installation", {
      apiKey: config.apiKey,
      apiEndpoint: config.apiEndpoint,
      installCodex: config.installCodex,
      installCcswitch: config.installCCSwitch,
      installPath: config.installPath,
      onProgress: channel,
    });
    addLog("安装完成！");
    await new Promise((r) => setTimeout(r, 500));
    nextStep();
  };

  // 浏览器预览模式（非 Tauri）：用模拟流程演示界面
  const runSimulated = async () => {
    for (const t of buildTasks(config)) {
      updateTask(t.id, { status: "running" });
      addLog(`(预览)正在${t.name}...`);
      for (let p = 0; p <= 100; p += 20) {
        await new Promise((r) => setTimeout(r, 120));
        updateTask(t.id, { progress: p });
      }
      updateTask(t.id, { status: "completed", progress: 100 });
    }
    addLog("(预览)安装完成！");
    await new Promise((r) => setTimeout(r, 400));
    nextStep();
  };

  const startInstall = async () => {
    setError("");
    setTasks(buildTasks(config));
    setLogs([]);
    try {
      if (window.__TAURI_INTERNALS__) {
        await runReal();
      } else {
        await runSimulated();
      }
    } catch (e) {
      const msg = typeof e === "string" ? e : "安装过程中发生错误，请查看日志";
      setError(msg);
      addLog(`错误：${msg}`);
      // 把仍在进行中的任务标记为出错
      setTasks((prev) => prev.map((t) => (t.status === "running" ? { ...t, status: "error" } : t)));
    }
  };

  useEffect(() => {
    // 防止 React StrictMode 在开发模式下重复执行安装
    if (startedRef.current) return;
    startedRef.current = true;
    startInstall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    startInstall();
  };

  const taskIcons: Record<string, ReactNode> = {
    codex: <FileDown size={16} />,
    ccswitch: <FileDown size={16} />,
    config: <Settings size={16} />,
    cleanup: <Trash2 size={16} />,
  };

  return (
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        {error ? (
          <AlertCircle size={20} className="text-error" />
        ) : (
          <Loader2 size={20} className="text-primary-500 animate-spin" />
        )}
        <h2 className="text-xl font-semibold text-text-primary">
          {error ? "安装未完成" : "正在安装"}
        </h2>
      </div>

      {/* 总体进度 */}
      <div className="bg-bg-primary rounded-xl border border-border p-5 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-text-secondary">总体进度</span>
          <span className="text-primary-500 font-medium">{Math.round(totalProgress)}%</span>
        </div>
        <div className="h-2.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              error ? "bg-error" : "bg-gradient-to-r from-primary-500 to-claude-orange-light"
            }`}
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 space-y-3 mb-4 overflow-y-auto">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`rounded-lg border p-4 transition-all duration-200 ${
              task.status === "running"
                ? "border-primary-500 bg-primary-50"
                : task.status === "completed"
                  ? "border-success bg-success-light"
                  : task.status === "error"
                    ? "border-error bg-error/5"
                    : "border-border bg-bg-primary"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="text-text-secondary">
                {task.status === "running" ? (
                  <Loader2 size={18} className="animate-spin text-primary-500" />
                ) : task.status === "completed" ? (
                  <CheckCircle size={18} className="text-success" />
                ) : task.status === "error" ? (
                  <AlertCircle size={18} className="text-error" />
                ) : (
                  taskIcons[task.id]
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <span
                    className={`text-sm font-medium ${
                      task.status === "running"
                        ? "text-primary-500"
                        : task.status === "completed"
                          ? "text-success"
                          : task.status === "error"
                            ? "text-error"
                            : "text-text-primary"
                    }`}
                  >
                    {task.name}
                  </span>
                  {task.status === "completed" && (
                    <span className="text-xs text-success">完成</span>
                  )}
                  {task.status === "error" && (
                    <span className="text-xs text-error">失败</span>
                  )}
                </div>
                {task.status === "running" && (
                  <div className="mt-2 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-primary-500 rounded-full transition-all duration-200 ${
                        task.progress === 0 ? "w-full animate-pulse opacity-40" : ""
                      }`}
                      style={task.progress === 0 ? undefined : { width: `${task.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 错误提示 + 重试 */}
      {error && (
        <div className="mb-4 rounded-lg border border-error bg-error/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-error mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-error font-medium mb-1">安装失败</p>
              <p className="text-xs text-text-secondary break-words">{error}</p>
            </div>
            <button
              onClick={handleRetry}
              className="px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary
                hover:bg-bg-secondary hover:border-border-hover transition-all duration-200
                flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw size={14} />
              <span>重试</span>
            </button>
          </div>
        </div>
      )}

      {/* 日志区域 */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full px-4 py-2.5 bg-bg-secondary text-sm text-text-secondary flex items-center justify-between
            hover:bg-bg-tertiary transition-colors"
        >
          <span>安装日志</span>
          <span className="text-xs">{showLogs ? "收起" : "展开"}</span>
        </button>
        {showLogs && (
          <div className="max-h-40 overflow-y-auto p-4 bg-bg-primary border-t border-border">
            {logs.map((log, i) => (
              <p key={i} className="text-xs text-text-muted font-mono mb-1">
                {log}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
