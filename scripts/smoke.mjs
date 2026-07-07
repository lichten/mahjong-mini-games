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

// 全ゲームのルート（gameRegistry.ts と対応させる）
const GAME_PATHS = [
  "what-to-discard",
  "shanten-quiz",
  "efficiency-training",
  "machi-quiz",
  "chinitsu-machi-quiz",
  "betaori",
  "score-quiz",
  "yaku-quiz",
  "solo-mahjong",
  "kokushi-challenge",
  "chinitsu-solo",
  "four-player-mahjong",
];

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // スマホ縦
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

// 1. トップページ
await page.goto(BASE);
await page.waitForSelector("text=麻雀ミニゲーム集");
await page.screenshot({ path: `${SHOTS}/home.png` });

// 2. 全ゲームを開いて牌が描画されることを確認
for (const path of GAME_PATHS) {
  await page.goto(`${BASE}${path}`);
  if (path === "four-player-mahjong") {
    // 開始画面を挟むゲームは対局を開始してから確認する
    await page.click('button:has-text("対局開始")');
  }
  await page.waitForSelector(".tile", { timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/game-${path}.png` });
}

// 3. 代表的な操作フロー
// 何切る: 第 1 問の正解（西）をタップ → 解説表示
await page.goto(`${BASE}what-to-discard`);
await page.waitForSelector(".hand button.tile");
await page.click('button.tile[aria-label="西"]');
await page.waitForSelector("text=正解!");
await page.screenshot({ path: `${SHOTS}/flow-what-to-discard.png` });

// シャンテンクイズ: 選択 → 答え合わせ
await page.goto(`${BASE}shanten-quiz`);
await page.waitForSelector(".choices .choice-btn");
await page.click(".choice-btn >> nth=0");
await page.waitForSelector("text=答え:");

// 待ち当て: 牌を 1 つ選んで答え合わせ → 結果パネル
await page.goto(`${BASE}machi-quiz`);
await page.waitForSelector(".keyboard-row .tile");
await page.click(".keyboard-row button.tile >> nth=0");
await page.click('button:has-text("答え合わせ")');
await page.waitForSelector(".panel .result");
await page.screenshot({ path: `${SHOTS}/flow-machi-quiz.png` });

// 点数クイズ: 選択肢を押す → 役内訳表示
await page.goto(`${BASE}score-quiz`);
await page.waitForSelector(".choices .choice-btn");
await page.click(".choice-btn >> nth=0");
await page.waitForSelector(".panel .result");
await page.screenshot({ path: `${SHOTS}/flow-score-quiz.png` });

// 一人打ち: ツモ牌を切る → 河に 1 枚増える
await page.goto(`${BASE}solo-mahjong`);
await page.waitForSelector(".hand button.tile");
const tiles = page.locator(".hand button.tile");
await tiles.nth((await tiles.count()) - 1).click();
await page.waitForSelector(".river .tile");
await page.screenshot({ path: `${SHOTS}/flow-solo-mahjong.png` });

// 四人打ち麻雀: 対局開始 → 自分の手番でツモ切り → 河に 1 枚増える
await page.goto(`${BASE}four-player-mahjong`);
await page.click('button:has-text("対局開始")');
// CPU の手番は自動で進む。鳴き・ロンの選択肢が出たらスルーして自分の手番を待つ
for (let i = 0; i < 60; i++) {
  if (await page.locator(".hand button.tile").first().isVisible().catch(() => false)) break;
  const pass = page.locator('button:has-text("スルー")');
  if (await pass.isVisible().catch(() => false)) await pass.click();
  else await page.waitForTimeout(250);
}
await page.waitForSelector(".hand button.tile", { timeout: 15000 });
const fpmTiles = page.locator(".hand button.tile");
await fpmTiles.nth((await fpmTiles.count()) - 1).click();
await page.waitForSelector(".fpm-self .fpm-river .tile", { timeout: 15000 });
await page.screenshot({ path: `${SHOTS}/flow-four-player-mahjong.png` });

// 4. ゲーム URL 直リロード（SPA フォールバック確認）
await page.reload();
await page.waitForSelector("h1");

await browser.close();

if (errors.length > 0) {
  console.error("ブラウザ側のエラー:");
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log(`smoke OK (${GAME_PATHS.length} games)`);
