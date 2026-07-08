# 05. 公開手順（GitHub Pages）

## 結論

GitHub リポジトリの main ブランチへの push をトリガーに、**GitHub Actions でビルドして GitHub Pages へ自動デプロイ**する。

## 構成

- リポジトリ: GitHub 上に `mahjong-mini-games`（public）を作成
- 公開 URL: `https://<ユーザー名>.github.io/mahjong-mini-games/`
- デプロイ方式: GitHub Actions（Settings → Pages → Source を "GitHub Actions" に設定）

## Vite 側の設定の注意点

GitHub Pages はサブパス（`/mahjong-mini-games/`）配下で公開されるため、以下が必要。

1. **`base` の設定**: `vite.config.ts` に `base: '/mahjong-mini-games/'` を設定する。これを忘れるとアセットのパスが `/assets/...` になり 404 になる
2. **ルーターの basename**: React Router 使用時は `<BrowserRouter basename={import.meta.env.BASE_URL}>` のように Vite の `BASE_URL` を渡す
3. **SPA のリロード対策**: GitHub Pages は任意パスへの直リンクで 404 を返すため、`404.html` を `index.html` のコピーとして出力する（ビルド後にコピーするだけの簡易方式で十分）。ハッシュルーター（`HashRouter`）に逃げる選択肢もあるが、URL の見た目を優先して 404.html 方式を採る

## GitHub Actions ワークフロー方針

`.github/workflows/deploy.yml` に以下の流れを定義する。

```yaml
# 方針の要約（実ファイルは雛形作成時に書く）
on:
  push:
    branches: [main]

jobs:
  build:    # Node LTS をセットアップ → npm ci → npm test → npm run build
  deploy:   # actions/upload-pages-artifact + actions/deploy-pages で dist/ を公開
```

- **テストをデプロイの前提にする**: `npm test` が失敗したらデプロイしない
- 公式の `actions/deploy-pages` 系アクションを使う（`gh-pages` ブランチへの push 方式は使わない）

## 公開前チェックリスト

- [ ] `npm run build && npm run preview` でローカル確認（`base` 設定込みで動くこと）
- [ ] スマホ実機（または DevTools のデバイスモード）で牌のタップ操作を確認
- [ ] PWA としてホーム画面に追加でき、オフラインで起動できることを確認
    - インストールしたアプリは四人打ち麻雀が直接起動する（→ [08-pwa.md](08-pwa.md)）
    - アイコン・アプリ名（四人打ちリーチ麻雀）・スクリーンショットが正しく出ること
    - 更新トーストが「更新する」を押した時だけリロードすること
- [ ] `npm run smoke` が green（マニフェストとアイコンの検証を含む）
- [ ] 牌素材の出典表記（→ [03-tile-assets.md](03-tile-assets.md)）がフッター等に入っていることを確認
