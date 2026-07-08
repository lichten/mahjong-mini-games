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
        // インストール時は「四人打ち麻雀」が起動する専用アプリとして振る舞う。
        // scope はサイト全体なので、アプリ内リンクで他のミニゲームへも standalone のまま遷移できる。
        // id / scope / start_url は base 込みの絶対パスで書くこと(相対だと manifest の配置場所基準で解決され事故のもと)
        id: "/mahjong-mini-games/",
        scope: "/mahjong-mini-games/",
        start_url: "/mahjong-mini-games/four-player-mahjong",
        name: "四人打ちリーチ麻雀",
        short_name: "四人麻雀",
        description:
          "CPU 3 人と遊ぶ四人打ちリーチ麻雀。東風戦・立直・鳴きフル対応、オフラインでも遊べます。",
        lang: "ja",
        display: "standalone",
        orientation: "portrait",
        categories: ["games", "entertainment"],
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
