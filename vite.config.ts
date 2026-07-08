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
      includeAssets: ["icon.svg", "favicon.ico", "apple-touch-icon-180x180.png"],
      workbox: {
        // 牌 SVG やアイコン PNG もプリキャッシュしてオフラインで遊べるようにする
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        // マニフェスト用スクリーンショットはインストールサイズ節約のため除外
        globIgnores: ["screenshots/**"],
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
            src: "pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
        // Android のリッチインストールシート用(scripts/screenshots.mjs で撮影)
        screenshots: [
          {
            src: "screenshots/game.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "対局画面(実卓風レイアウト)",
          },
          {
            src: "screenshots/result.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "和了時の点数計算",
          },
          {
            src: "screenshots/start.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "モード選択(東風戦・東 1 局)",
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
