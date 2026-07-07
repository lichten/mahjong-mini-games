# 04. リポジトリ構成・アーキテクチャ

## 基本方針

モノレポ（workspaces）にはせず、**単一の Vite アプリをフォルダで分割**して管理する。ミニゲームは小粒で数が多いため、パッケージ分割のオーバーヘッドよりも「フォルダを 1 つ足せばゲームが増える」手軽さを優先する。

## ディレクトリ構成

```
mahjong-mini-games/
├── doc/                     # 本ドキュメント群
├── public/                  # favicon, PWA アイコン等
├── src/
│   ├── core/                # 麻雀共通ロジック（UI 非依存の純粋 TypeScript）
│   │   ├── tile.ts          # 牌の型定義・生成・ソート・MPSZ 表記のパース
│   │   ├── wall.ts          # 山（洗牌・配牌・ツモ）
│   │   ├── shanten.ts       # シャンテン数計算（七対子・国士無双・副露対応）
│   │   ├── agari.ts         # 和了判定・面子分解
│   │   ├── meld.ts          # 副露（ポン・チー・カン）の型とユーティリティ
│   │   ├── yaku.ts          # 役判定（門前手用。符計算含む）
│   │   ├── win.ts           # 副露対応の和了評価（食い下がり・状況役・ドラ計上）
│   │   ├── score.ts         # 点数計算（符 × 翻 → 支払い）
│   │   ├── generate.ts      # クイズ用のランダム手牌生成
│   │   └── __tests__/       # 上記の Vitest テスト
│   ├── components/          # 共通 UI コンポーネント
│   │   ├── Tile.tsx         # 牌 1 枚の表示（→ 03-tile-assets.md）
│   │   ├── Hand.tsx         # 手牌の並び表示
│   │   └── ...
│   ├── assets/
│   │   └── tiles/           # 牌 SVG（m1.svg 〜 z7.svg, m0/p0/s0, back）+ LICENSE.md
│   ├── games/               # 各ミニゲーム（1 ゲーム = 1 フォルダ）
│   │   ├── what-to-discard/ # 例: 何切る問題集
│   │   │   ├── index.tsx    # ゲームのルートコンポーネント（default export）
│   │   │   ├── logic.ts     # ゲーム固有ロジック
│   │   │   └── problems.ts  # 問題データ
│   │   ├── shared/          # 複数ゲームで共用する部品（SoloPlay 等）
│   │   └── .../
│   ├── gameRegistry.ts      # 全ゲームのメタ情報（タイトル・説明・ルートパス）一覧
│   ├── App.tsx              # ルーティング定義（ゲームは React.lazy で遅延ロード）
│   ├── Home.tsx             # トップページ = ゲームランチャー（gameRegistry から一覧生成）
│   └── main.tsx
├── index.html
├── vite.config.ts
├── biome.json
├── tsconfig.json
└── package.json
```

## レイヤー間の依存ルール

```
games → components → core
games → core
```

- **core**: React・DOM・画像に一切依存しない。入出力は牌 ID（MPSZ 表記）と型付きオブジェクトのみ。全関数に Vitest のテストを付ける
- **components**: core の型を使って牌や手牌を描画する。ゲーム固有の知識を持たない
- **games**: core と components を組み合わせてゲームを作る。ゲーム間で相互依存しない（共通化したいものが出たら core / components に昇格させる）

## ゲーム追加時の手順（規約）

1. `src/games/<kebab-case-name>/index.tsx` を作成し、ゲームコンポーネントを default export する
2. `gameRegistry.ts` にタイトル・説明・パス・難易度などのメタ情報を 1 エントリ追加する
3. ルーティングは registry から自動生成されるため、`App.tsx` の変更は不要な設計とする
4. ゲーム固有ロジックにテストが必要なら `logic.test.ts` を同フォルダに置く

この規約により「ゲームを大量に作る」際の追加コストをフォルダ 1 つ + registry 1 行に抑える。

## core に実装する機能の優先順位

ゲームカタログ（→ [06-game-catalog.md](06-game-catalog.md)）の必要機能から逆算した実装順。

1. **牌の基礎**（`tile.ts` / `wall.ts`）: 型・ソート・MPSZ パース・洗牌と配牌 — すべてのゲームの前提
2. **シャンテン数計算**（`shanten.ts`）: 何切る・牌効率系ゲームの中核。受け入れ枚数（有効牌）計算もここに含める
3. **和了判定・待ち計算**（`agari.ts`）: 待ち当てクイズ・一人打ちの和了検出に必要
4. **役判定・点数計算**（`yaku.ts` / `score.ts`）: 点数計算クイズと一人打ちの精算に必要

シャンテン数計算などのアルゴリズムは自作するが、既知の実装（標準形 + 七対子 + 国士無双の最小値を取る方式）に従い、公開されているテストケース集で検証する。
