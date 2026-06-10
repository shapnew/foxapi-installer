/// <reference types="vite/client" />

interface TauriInternals {
  metadata?: {
    currentWindow?: {
      label: string;
    };
  };
  os?: {
    platform: string;
  };
}

interface Window {
  __TAURI_INTERNALS__?: TauriInternals;
}
