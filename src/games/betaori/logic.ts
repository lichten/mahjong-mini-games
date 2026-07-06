import {
  countsOf,
  createShuffledWall,
  type Rng,
  sortTiles,
  type TileId,
  tileKind,
  tileRank,
  tileSuit,
} from "../../core";

/**
 * 牌の安全度レベル（小さいほど安全）。
 * 簡易モデル: 現物 > スジ・枯れ字牌 > 端牌・字牌 > 無スジ中張牌。
 * ワンチャンスや筋引っかけは扱わない（ゲーム内の説明にも明記する）。
 */
export type SafetyLevel = 0 | 1 | 2 | 3;

export const SAFETY_LABELS: Record<SafetyLevel, string> = {
  0: "現物（絶対安全）",
  1: "スジ・残り少ない字牌",
  2: "端牌・字牌",
  3: "無スジの中張牌（危険）",
};

export function safetyLevel(
  tile: TileId,
  riverCounts: readonly number[],
  handCounts: readonly number[],
): SafetyLevel {
  const kind = tileKind(tile);
  if (riverCounts[kind] > 0) return 0; // 現物

  if (tileSuit(tile) === "z") {
    // 相手が持ち得る残り枚数（自分の手牌と河で見えている分を除く）
    const unseen = 4 - riverCounts[kind] - handCounts[kind];
    if (unseen <= 1) return 1; // 単騎にしか使えない
    return 2;
  }

  const rank = tileRank(tile);
  const suitBase = kind - (rank - 1);
  const inRiver = (r: number) => riverCounts[suitBase + r - 1] > 0;
  const isSuji =
    rank <= 3
      ? inRiver(rank + 3)
      : rank >= 7
        ? inRiver(rank - 3)
        : inRiver(rank - 3) && inRiver(rank + 3);
  if (isSuji) return 1;
  if (rank === 1 || rank === 9) return 2;
  return 3;
}

export interface BetaoriQuestion {
  /** 自分の手牌（14 枚・理牌済み） */
  hand: TileId[];
  /** 相手（立直者）の捨て牌 */
  river: TileId[];
  /** 手牌それぞれの安全度 */
  levels: SafetyLevel[];
  /** 最も安全なレベル */
  bestLevel: SafetyLevel;
}

/** ベタオリ問題を 1 問生成する */
export function generateQuestion(rng: Rng = Math.random): BetaoriQuestion {
  const wall = createShuffledWall(rng, { redFives: false });
  const riverSize = 7 + Math.floor(rng() * 4); // 7〜10 枚
  const river = wall.slice(0, riverSize);
  const hand = sortTiles(wall.slice(riverSize, riverSize + 14));

  const riverCounts = countsOf(river);
  const handCounts = countsOf(hand);
  const levels = hand.map((tile) => safetyLevel(tile, riverCounts, handCounts));
  const bestLevel = Math.min(...levels) as SafetyLevel;
  return { hand, river, levels, bestLevel };
}
