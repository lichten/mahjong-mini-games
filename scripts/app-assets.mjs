/**
 * Android アプリ用のアイコン・スプラッシュ素材(assets/)を public/icon.svg から生成する。
 * 生成後に `npx capacitor-assets generate --android` で android/res へ展開する。
 * 実行: node scripts/app-assets.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const OUT = new URL("../assets/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
mkdirSync(OUT, { recursive: true });

const iconSvg = readFileSync(
  new URL("../public/icon.svg", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"),
  "utf8",
);

// 牌のモチーフ部分(背景グラデーション以外)を取り出す
const motif = iconSvg
  .replace(/<rect width="512" height="512"[^/]*\/>/, "")
  .replace(/<svg[^>]*>/, "")
  .replace(/<\/svg>/, "")
  .replace(/<defs>[\s\S]*?<\/defs>/, "");

// アダプティブアイコン前景: セーフゾーン(中央 66/108)に収まるよう 0.72 倍へ縮小、背景は透過
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">${motif}</g>
</svg>`;

// アダプティブアイコン背景: 元アイコンと同じ縦グラデーション
const backgroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#22884d"/>
      <stop offset="1" stop-color="#134a29"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
</svg>`;

// スプラッシュ: フェルト緑 1 色 + 中央にモチーフ(表示領域が端末で切れても安全なサイズ)
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#1a6b3c"/>
  <g transform="translate(1366 1366) scale(1.2) translate(-256 -256)">${motif}</g>
</svg>`;

const jobs = [
  ["icon-only.png", iconSvg, 1024],
  ["icon-foreground.png", foregroundSvg, 1024],
  ["icon-background.png", backgroundSvg, 1024],
  ["splash.png", splashSvg, 2732],
  ["splash-dark.png", splashSvg, 2732],
];
for (const [name, svg, size] of jobs) {
  writeFileSync(`${OUT}/.tmp.svg`, svg);
  await sharp(`${OUT}/.tmp.svg`, { density: (72 * size) / 512 })
    .resize(size, size)
    .png()
    .toFile(`${OUT}/${name}`);
  console.log(`${name} (${size}x${size})`);
}
const { unlinkSync } = await import("node:fs");
unlinkSync(`${OUT}/.tmp.svg`);
console.log(`OK → ${OUT}`);
