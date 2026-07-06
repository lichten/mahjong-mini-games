# 02. 開発環境・技術スタック

## スタック一覧

| 役割 | 採用技術 | 採用理由 |
|---|---|---|
| 言語 | TypeScript（strict モード） | 牌・面子・待ちなどドメイン概念が多く、型で表現すると安全に共通ロジックを育てられる |
| ビルド | Vite | 高速な開発サーバーと静的ビルド。GitHub Pages への出力もシンプル |
| UI フレームワーク | React | ゲームごとの画面をコンポーネントとして量産しやすい。情報も豊富 |
| ルーティング | React Router | トップページ（ゲーム一覧）から各ゲームへ遷移。ゲームは遅延ロード（`React.lazy`）する |
| テスト | Vitest | シャンテン数計算・和了判定など麻雀ロジックはユニットテスト必須。Vite と設定を共有できる |
| Lint / Format | Biome | ESLint + Prettier の役割を 1 ツール・1 設定ファイルで済ませられる。新規プロジェクト向き |
| PWA | vite-plugin-pwa | Manifest / Service Worker の生成（→ [01-platform.md](01-platform.md)） |
| パッケージ管理 | npm | Node.js に同梱されており追加インストール不要。モノレポにしないため workspaces も不要 |

## 必要なツール

- **Node.js**: LTS 版（v22 系以降）。[nodejs.org](https://nodejs.org/) からインストール、またはバージョン管理ツール（Volta / fnm 等）を利用
- **Git**: バージョン管理と GitHub Pages への公開に使用
- **エディタ**: VS Code 推奨（Biome 拡張機能を入れると保存時フォーマットが効く）

## セットアップ手順（プロジェクト雛形作成時）

```sh
# Vite の React + TypeScript テンプレートで初期化
npm create vite@latest . -- --template react-ts

# 依存パッケージの追加
npm install react-router-dom
npm install -D vitest @biomejs/biome vite-plugin-pwa

# Biome の初期化
npx @biomejs/biome init
```

## npm スクリプト構成（方針）

`package.json` には以下のスクリプトを揃える。

| スクリプト | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動（Vite） |
| `npm run build` | 型チェック（`tsc -b`）+ 本番ビルド |
| `npm run preview` | ビルド結果をローカルで確認 |
| `npm test` | Vitest によるユニットテスト実行 |
| `npm run lint` | Biome によるチェック |
| `npm run format` | Biome によるフォーマット |
| `npm run smoke` | ブラウザスモークテスト（`npm run build && npm run preview` でサーバーを起動してから実行。playwright-core + Windows の Edge を使用） |

## コーディング方針

- TypeScript は `strict: true`。`any` は原則使わない
- 麻雀ロジック（`src/core/`）は **React・DOM に依存しない純粋関数**で書き、必ず Vitest のテストを付ける
- UI コンポーネントは関数コンポーネント + フックのみ（クラスコンポーネントは使わない）
- 状態管理ライブラリは導入しない。ミニゲーム単位なら `useState` / `useReducer` で足りる。必要になった時点で再検討する
