/**
 * ブラウザスモークテスト。
 * 事前に `npm run build && npm run preview` でサーバーを起動しておき、
 * `node scripts/smoke.mjs` で実行する（Windows の Edge を利用、追加ダウンロード不要）。
 * スクリーンショットは scripts/smoke-shots/ に保存される。
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = "http://localhost:4173/mahjong-mini-games/";
const SHOTS = new URL("./smoke-shots/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
mkdirSync(SHOTS, { recursive: true });
const errors = [];

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // スマホ縦
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

// 1. トップページ
await page.goto(BASE);
await page.waitForSelector("text=麻雀ミニゲーム集");
await page.screenshot({ path: `${SHOTS}/01-home.png` });

// 2. 何切る?問題集: 牌をタップして解説を出す
await page.click("text=何切る?問題集");
await page.waitForSelector(".hand button.tile");
await page.screenshot({ path: `${SHOTS}/02-what-to-discard.png` });
await page.click('button.tile[aria-label="西"]'); // 第 1 問の正解は西
await page.waitForSelector("text=正解!");
await page.screenshot({ path: `${SHOTS}/03-what-to-discard-answer.png` });

// 3. シャンテン数当てクイズ: 選択肢を押して答え合わせ
await page.goto(`${BASE}shanten-quiz`);
await page.waitForSelector(".choices .choice-btn");
await page.screenshot({ path: `${SHOTS}/04-shanten-quiz.png` });
await page.click(".choice-btn >> nth=0");
await page.waitForSelector("text=答え:");
await page.screenshot({ path: `${SHOTS}/05-shanten-quiz-answer.png` });

// 4. 牌効率トレーニング: ツモ牌（右端）を切ってみる
await page.goto(`${BASE}efficiency-training`);
await page.waitForSelector(".hand button.tile");
await page.screenshot({ path: `${SHOTS}/06-efficiency.png` });
const won = await page.locator("text=ツモ和了!").count();
if (won === 0) {
  const tiles = page.locator(".hand button.tile");
  await tiles.nth((await tiles.count()) - 1).click();
  await page.waitForSelector(".panel .result");
  await page.screenshot({ path: `${SHOTS}/07-efficiency-feedback.png` });
}

// 5. ゲーム URL 直リロード（SPA フォールバック確認）
await page.reload();
await page.waitForSelector("h1");

await browser.close();

if (errors.length > 0) {
  console.error("ブラウザ側のエラー:");
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log("smoke OK");
