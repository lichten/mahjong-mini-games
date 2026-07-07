/**
 * 牌の安全度評価（betaori ゲームと四人打ち麻雀の CPU が共用）。
 *
 * 簡易モデル: 現物 > スジ・枯れ字牌 > 端牌・字牌 > 無スジ中張牌。
 * ワンチャンスや筋引っかけは扱わない。
 */

import {
  countsOf,
  type TileId,
  tileKind,
  tileRank,
  tileSuit,
} from "../../core";

/** 牌の安全度レベル（小さいほど安全） */
export type SafetyLevel = 0 | 1 | 2 | 3;

export const SAFETY_LABELS: Record<SafetyLevel, string> = {
  0: "現物（絶対安全）",
  1: "スジ・残り少ない字牌",
  2: "端牌・字牌",
  3: "無スジの中張牌（危険）",
};

/**
 * 安全度を評価する。
 * @param riverCounts 見えている牌（相手の河など）の種類別枚数
 * @param handCounts 自分の手牌の種類別枚数
 */
export function safetyLevel(
  tile: TileId,
  riverCounts: readonly number[],
  handCounts: readonly number[],
): SafetyLevel {
  const kind = tileKind(tile);
  if (riverCounts[kind] > 0) return 0; // 現物

  if (tileSuit(tile) === "z") {
    // 相手が持ち得る残り枚数（自分の手牌と見えている分を除く）
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

/** 複数の河・副露などから見えている牌の枚数配列を合算する */
export function countsOfAll(groups: readonly (readonly TileId[])[]): number[] {
  const merged = groups.flatMap((g) => [...g]);
  return countsOf(merged);
}
