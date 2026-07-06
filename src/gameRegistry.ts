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
];
