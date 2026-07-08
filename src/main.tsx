import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// SW の登録は UpdateToast(useRegisterSW)が行う。
// プリキャッシュがストレージ圧迫時に追い出されにくいよう永続化を要求する(Safari では no-op)
navigator.storage?.persist?.();

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
