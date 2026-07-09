import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite/HMR WebSocket connection warnings in sandboxed preview environments
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const errorStr = event.reason ? String(event.reason.message || event.reason) : "";
    if (errorStr.includes("WebSocket") || errorStr.includes("websocket") || errorStr.includes("vite")) {
      event.preventDefault();
      event.stopPropagation();
      console.debug("[Vite HMR] Safely intercepted and suppressed expected sandboxed WebSocket rejection.");
    }
  });

  window.addEventListener("error", (event) => {
    const errorMsg = event.message || "";
    if (errorMsg.includes("WebSocket") || errorMsg.includes("websocket") || errorMsg.includes("vite")) {
      event.preventDefault();
      event.stopPropagation();
      console.debug("[Vite HMR] Safely intercepted and suppressed expected sandboxed WebSocket error.");
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

