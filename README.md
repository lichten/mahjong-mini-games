# mahjong-mini-games

麻雀をテーマとした、隙間時間に遊べるミニゲーム集。一人打ち麻雀や「何切る?」問題集などを Web ブラウザ向けに作成する（ネット対戦なし）。

## 開発

```sh
npm install
npm run dev      # 開発サーバー
npm test         # ユニットテスト
npm run build    # 型チェック + 本番ビルド
```

main ブランチへの push で GitHub Actions が GitHub Pages へ自動デプロイする。

プロジェクトの方針・設計は [doc/README.md](doc/README.md) を参照。

## 収録ゲーム

- **何切る?問題集** — 14 枚から最善の 1 枚を選ぶ。受け入れ枚数つき解説
- **シャンテン数当てクイズ** — 手牌のシャンテン数を即答
- **牌効率トレーニング** — 常に受け入れ最大の打牌を選び続ける実戦練習

牌画像: [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles) (CC0)
