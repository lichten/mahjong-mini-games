/**
 * PWA マニフェスト用スクリーンショット撮影(四人打ち麻雀)。
 * 事前に `npm run build && npm run preview` でサーバーを起動しておき、
 * `npm run screenshots` で実行する(Windows の Edge を利用、追加ダウンロード不要)。
 * 撮影結果は public/screenshots/ に保存し、コミットする。
 * サイズは 390x844(スマホ縦)で、vite.config.ts の manifest.screenshots と一致させること。
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = "http://localhost:4173/mahjong-mini-games/";
const SHOTS = new URL("../public/screenshots/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // スマホ縦
// CPU の思考待ち時間を高速モードで短縮する
await page.addInitScript(() => {
  localStorage.setItem("four-player-mahjong:fast", "1");
});

// 1. 開始画面
await page.goto(`${BASE}four-player-mahjong`);
await page.waitForSelector('button:has-text("東風戦")');
await page.screenshot({ path: `${SHOTS}/start.png` });

// 2. 対局画面(東 1 局を開始し、自分の手番まで進める)
await page.click('button:has-text("東 1 局")');
for (let i = 0; i < 200; i++) {
  if (await page.locator(".hand button.tile").first().isVisible().catch(() => false)) break;
  const pass = page.locator('button:has-text("スルー")');
  if (await pass.isVisible().catch(() => false)) await pass.click();
  else await page.waitForTimeout(200);
}
await page.waitForSelector(".hand button.tile", { timeout: 15000 });
await page.screenshot({ path: `${SHOTS}/game.png` });

// 3. 結果画面(ツモ切りで局が終わるまで自動プレイ)
for (let i = 0; i < 600; i++) {
  if (await page.locator(".fpm-modal").isVisible().catch(() => false)) break;
  const pass = page.locator('button:has-text("スルー")');
  const tiles = page.locator(".hand button.tile:not([disabled])");
  if (await pass.isVisible().catch(() => false)) {
    await pass.click();
  } else if ((await tiles.count()) > 0) {
    await tiles.last().click({ timeout: 2000 }).catch(() => {});
  } else {
    await page.waitForTimeout(200);
  }
}
await page.waitForSelector(".fpm-modal", { timeout: 15000 });
await page.screenshot({ path: `${SHOTS}/result.png` });

await browser.close();
console.log(`screenshots OK → ${SHOTS}`);
