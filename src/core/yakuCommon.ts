/**
 * 役判定の共通部品（yaku.ts と win.ts で共有する内部モジュール）。
 * core/index.ts からは公開しない。
 */

import type { Decomposition } from "./agari";

export const DRAGON_KINDS = [31, 32, 33]; // 白 發 中
export const DRAGON_NAMES: Record<number, string> = {
  31: "白",
  32: "發",
  33: "中",
};
export const WIND_NAMES = ["東", "南", "西", "北"];
/** 緑一色の対象牌（s2 s3 s4 s6 s8 發） */
export const GREEN_KINDS = [19, 20, 21, 23, 25, 32];

export function isYaochuuKind(kind: number): boolean {
  return kind >= 27 || kind % 9 === 0 || kind % 9 === 8;
}

export function ceil10(n: number): number {
  return Math.ceil(n / 10) * 10;
}

/** 待ちの取り方 */
export interface WaitPlacement {
  type: "tanki" | "shanpon" | "kanchan" | "penchan" | "ryanmen";
  /** 待ちを構成する面子のインデックス（tanki は -1） */
  meldIndex: number;
}

export function enumerateWaits(
  d: Decomposition,
  winKind: number,
): WaitPlacement[] {
  const placements: WaitPlacement[] = [];
  if (d.pair === winKind) placements.push({ type: "tanki", meldIndex: -1 });
  d.melds.forEach((meld, i) => {
    if (meld.type === "triplet") {
      if (meld.kind === winKind)
        placements.push({ type: "shanpon", meldIndex: i });
      return;
    }
    const r = meld.kind;
    if (winKind === r + 1) placements.push({ type: "kanchan", meldIndex: i });
    else if (winKind === r) {
      placements.push({
        type: r % 9 === 6 ? "penchan" : "ryanmen",
        meldIndex: i,
      });
    } else if (winKind === r + 2) {
      placements.push({
        type: r % 9 === 0 ? "penchan" : "ryanmen",
        meldIndex: i,
      });
    }
  });
  return placements;
}
