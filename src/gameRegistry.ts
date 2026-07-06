import { type ComponentType, type LazyExoticComponent, lazy } from "react";

export interface GameMeta {
  /** ルートパス（= src/games/ のフォルダ名） */
  path: string;
  title: string;
  description: string;
  difficulty: "入門" | "初級" | "中級" | "上級";
  /** 1 プレイの目安時間 */
  playTime: string;
  component: LazyExoticComponent<ComponentType>;
}

/**
 * 全ミニゲームの一覧。
 * ゲームを追加するときはここに 1 エントリ足すだけでよい（doc/04-architecture.md）。
 */
export const games: GameMeta[] = [
  {
    path: "what-to-discard",
    title: "何切る?問題集",
    description:
      "14 枚の手牌から最善の 1 枚を選ぶ定番問題。解答後に受け入れ枚数つきの解説を表示。",
    difficulty: "初級",
    playTime: "30 秒/問",
    component: lazy(() => import("./games/what-to-discard")),
  },
  {
    path: "shanten-quiz",
    title: "シャンテン数当てクイズ",
    description:
      "表示された 13 枚の手牌のシャンテン数を即答。連続正解を伸ばそう。",
    difficulty: "入門",
    playTime: "15 秒/問",
    component: lazy(() => import("./games/shanten-quiz")),
  },
  {
    path: "efficiency-training",
    title: "牌効率トレーニング",
    description:
      "配牌からツモと打牌を繰り返し、常に受け入れ最大の一打を選び続ける実戦練習。",
    difficulty: "中級",
    playTime: "2〜3 分",
    component: lazy(() => import("./games/efficiency-training")),
  },
  {
    path: "machi-quiz",
    title: "待ち当てクイズ",
    description: "テンパイ形を見て待ち牌をすべて答える。多面待ちを見抜けるか?",
    difficulty: "初級",
    playTime: "30 秒/問",
    component: lazy(() => import("./games/machi-quiz")),
  },
  {
    path: "chinitsu-machi-quiz",
    title: "清一色何待ちクイズ",
    description: "清一色のテンパイ形限定の待ち当て。定番の読解トレーニング。",
    difficulty: "上級",
    playTime: "30 秒/問",
    component: lazy(() => import("./games/chinitsu-machi-quiz")),
  },
  {
    path: "betaori",
    title: "ベタオリ練習",
    description:
      "相手の立直に対して、現物・スジ・字牌からいちばん安全な牌を選ぶ守備練習。",
    difficulty: "中級",
    playTime: "1〜2 分",
    component: lazy(() => import("./games/betaori")),
  },
  {
    path: "score-quiz",
    title: "点数計算クイズ",
    description: "和了形と場況から点数を 4 択で即答。符と翻の内訳も解説表示。",
    difficulty: "上級",
    playTime: "30 秒/問",
    component: lazy(() => import("./games/score-quiz")),
  },
  {
    path: "yaku-quiz",
    title: "役当てクイズ",
    description:
      "和了形についている役をすべて挙げる。見落としがちな複合役に注意。",
    difficulty: "中級",
    playTime: "30 秒/問",
    component: lazy(() => import("./games/yaku-quiz")),
  },
  {
    path: "solo-mahjong",
    title: "一人打ち麻雀",
    description:
      "ツモと打牌を繰り返し 18 巡以内の和了を目指すソリティア麻雀。和了時は点数計算つき。",
    difficulty: "初級",
    playTime: "3〜5 分",
    component: lazy(() => import("./games/solo-mahjong")),
  },
  {
    path: "kokushi-challenge",
    title: "国士無双チャレンジ",
    description: "狙うは国士無双のみ。30 巡以内に 13 種の幺九牌を揃えられるか?",
    difficulty: "初級",
    playTime: "2〜3 分",
    component: lazy(() => import("./games/kokushi-challenge")),
  },
  {
    path: "chinitsu-solo",
    title: "チンイツ一人打ち",
    description:
      "清一色寄りの配牌からスタート。20 巡以内に清一色の和了を完成させよう。",
    difficulty: "中級",
    playTime: "2〜3 分",
    component: lazy(() => import("./games/chinitsu-solo")),
  },
];
