import { defineConfig } from "@vite-pwa/assets-generator/config";

// public/icon.svg(フルブリード・セーフゾーン設計)から PWA アイコン一式を生成する。
// 実行: npm run icons → 生成物は public/ にコミットする(ビルド時には生成しない)
export default defineConfig({
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, "favicon.ico"]],
      padding: 0,
    },
    maskable: {
      sizes: [512],
      padding: 0,
    },
    apple: {
      sizes: [180],
      padding: 0,
    },
  },
  images: ["public/icon.svg"],
});
