import { renameSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { type PluginOption, defineConfig } from "vite";

// Capacitor は webDir/index.html を読むため、エントリ名を index.html に揃える
function renameAppHtml(): PluginOption {
  return {
    name: "rename-app-html",
    closeBundle() {
      renameSync(
        resolve(__dirname, "dist-app/index.app.html"),
        resolve(__dirname, "dist-app/index.html"),
      );
    },
  };
}

// Android アプリ(Capacitor)同梱用ビルド。Web 版(vite.config.ts)とは独立で、
// base はルート配信、SW/manifest なし、public/ の PWA 資産も同梱しない
// (牌 SVG は src/assets からバンドルされるため public/ に依存しない)
export default defineConfig({
  base: "/",
  publicDir: false,
  plugins: [react(), renameAppHtml()],
  build: {
    outDir: "dist-app",
    rollupOptions: { input: resolve(__dirname, "index.app.html") },
  },
});
