# 08. PWA（四人打ち麻雀専用アプリ）

## 結論

インストールされた PWA は**「四人打ちリーチ麻雀」の専用アプリ**として振る舞う。
ホーム画面から起動すると麻雀卓（`/four-player-mahjong`）が直接開き、オフラインでも遊べる。
ブラウザとしてのサイト（`/` = ミニゲーム一覧）はそのまま残し、URL 構成は一切変えていない。

## マニフェスト設計（vite.config.ts）

| 項目 | 値 | 意図 |
|---|---|---|
| `id` | `/mahjong-mini-games/` | 将来 `start_url` を変えてもアプリの同一性を保つ |
| `scope` | `/mahjong-mini-games/` | サイト全体。アプリ内から他ゲームへも standalone のまま遷移可 |
| `start_url` | `/mahjong-mini-games/four-player-mahjong` | 起動時に麻雀卓を直接開く |
| `name` / `short_name` | 四人打ちリーチ麻雀 / 四人麻雀 | ホーム画面ではゲーム名で表示される |
| `display` | `standalone` | ブラウザ UI なしのアプリ表示 |
| `orientation` | `portrait` | 縦持ち前提（iOS は無視するが CSS 側で担保済み） |
| `screenshots` | 390×844 ×3 枚 | Android のリッチインストールシート用 |

**注意**: `id` / `scope` / `start_url` は必ず base（`/mahjong-mini-games/`）込みの
絶対パスで書く。相対で書くとマニフェストの配置場所基準で解決され事故のもと。

## アイコン

- ソースは `public/icon.svg` 1 枚（東牌モチーフ、フルブリード正方形）。
  主要素は maskable のセーフゾーン（中央 80% の円）内に収める設計なので、
  1 ソースから any / maskable / apple をすべて生成できる
- 再生成: `npm run icons`（`@vite-pwa/assets-generator` + `pwa-assets.config.ts`）
- 生成物（`public/pwa-*.png`, `maskable-icon-512x512.png`,
  `apple-touch-icon-180x180.png`, `favicon.ico`）は**コミットする**。
  ビルド時生成にはしない（CI を単純に保ち、生成結果を決定的にするため）
- SVG 内のテキストは librsvg でラスタライズされるため `dominant-baseline` が
  効かない。文字位置はベースライン `y` の手動調整で合わせている

## スクリーンショット

- 撮影: preview サーバー起動中に `npm run screenshots`（`scripts/screenshots.mjs`）
- 390×844 で開始画面・対局画面・結果画面の 3 枚を `public/screenshots/` に保存しコミット
- マニフェストの `screenshots` の `sizes` と実サイズを一致させること
- Service Worker のプリキャッシュからは除外している（`globIgnores`）。
  インストールサイズ節約のためで、オフライン動作には不要

## Service Worker 更新フロー

- `registerType: "prompt"`。**autoUpdate にしてはいけない**
  （新 SW 到着時に自動リロードされ、対局中の局が消える）
- 新バージョン検出時は `src/components/UpdateToast.tsx` がトーストを表示し、
  「更新する」を押した時だけ `updateServiceWorker(true)` でリロードする
- 「あとで」を押しても次回起動時に再提示される

## オフライン対応

- 全アセット（JS/CSS/牌 SVG/アイコン PNG）をプリキャッシュ（約 1.1 MiB）
- `navigateFallback` により、オフラインでゲームルートを直接開いても
  `index.html` が返って SPA が起動する
- `navigator.storage.persist()` でキャッシュの追い出し耐性を要求（Safari は no-op）

## iOS の既知の制約

- `beforeinstallprompt` イベントがない → インストールは共有メニューの
  「ホーム画面に追加」を使ってもらう
- マニフェストの `orientation` は無視される（縦持ちは CSS レイアウトで担保）
- スプラッシュは `background_color` + アイコンのデフォルト表示。
  凝ったスプラッシュが欲しくなったら `pwa-asset-generator` で
  `apple-touch-startup-image` 一式を生成して `index.html` に注入する
- ホーム画面に追加済みの PWA は ITP の 7 日ストレージ削除の対象外

## 検証チェックリスト

- [ ] `npm run build && npm run preview` → DevTools Application → Manifest で
      installability 警告がないこと
- [ ] DevTools Network「Offline」で `/four-player-mahjong` を直接リロード → 対局完走
- [ ] ビルドし直して再訪 → 更新トーストが出て「更新する」でのみリロードされること
- [ ] `npm run smoke`（マニフェストの start_url・アイコンの検証を含む）
- [ ] 実機: Android Chrome でインストール → 機内モードで起動・対局。
      iPhone Safari で「ホーム画面に追加」→ standalone 起動・safe-area 確認
      （SW は HTTPS 必須のため、実機検証はデプロイ済み GitHub Pages で行う）

## 将来の拡張（未実装）

- インストール促進バナー（`beforeinstallprompt` / iOS は手順ヒント表示)
- 打牌・鳴き時のハプティクス（`navigator.vibrate`、Android のみ）
- ストア配信（TWA / Capacitor）。マニフェストとアイコンが揃ったので
  Bubblewrap で TWA 化すれば Google Play 配信の土台はできている
