import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FourPlayerMahjong from "./games/four-player-mahjong";
import "./index.css";

// Capacitor 同梱ビルド専用のエントリ。ルーター・Home・UpdateToast(SW)は
// 含めず、四人打ち麻雀を直接マウントする(vite.config.app.ts から参照)。
if (Capacitor.isNativePlatform()) {
  // ハード戻るボタンは終了させず最小化する(対局中の誤爆終了防止)
  CapApp.addListener("backButton", () => {
    CapApp.minimizeApp();
  });
  StatusBar.setBackgroundColor({ color: "#1a6b3c" }).catch(() => {});
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  SplashScreen.hide().catch(() => {});
}

const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");

createRoot(root).render(
  <StrictMode>
    <div className="game-page">
      <FourPlayerMahjong />
    </div>
  </StrictMode>,
);
