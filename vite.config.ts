/// <reference types="vitest/config" />
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { type PluginOption, defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages は任意パスへの直リンクに 404 を返すため、
// index.html のコピーを 404.html として置いて SPA のリロードに対応する
function spa404Fallback(): PluginOption {
  return {
    name: "spa-404-fallback",
    closeBundle() {
      copyFileSync(resolve(__dirname, "dist/index.html"), resolve(__dirname, "dist/404.html"));
    },
  };
}

export default defineConfig({
  base: "/mahjong-mini-games/",
  plugins: [
    react(),
    spa404Fallback(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      workbox: {
        // 牌 SVG もプリキャッシュしてオフラインで遊べるようにする
        globPatterns: ["**/*.{js,css,html,svg,webmanifest}"],
      },
      manifest: {
        name: "麻雀ミニゲーム集",
        short_name: "麻雀ミニゲーム",
        description:
          "隙間時間に遊べる麻雀ミニゲーム集。何切る?問題集、シャンテン数クイズ、牌効率トレーニングなど。",
        lang: "ja",
        display: "standalone",
        background_color: "#1a6b3c",
        theme_color: "#1a6b3c",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
