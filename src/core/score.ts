/**
 * 点数計算（符 × 翻 → 支払い点数）。
 */

import type { TileId } from "./tile";
import { evaluateHand, type HandValue, type WinContext } from "./yaku";

export interface ScoreOptions {
  /** 親かどうか */
  dealer: boolean;
  /** ツモ和了か */
  tsumo: boolean;
  /** 役満の倍数（0 = 通常手） */
  yakuman?: number;
}

export interface ScoreResult {
  /** 基本点 */
  base: number;
  /** 合計収入 */
  total: number;
  /** 表示用の支払い（"1300/2600"・"2600オール"・"8000" など） */
  payments: string;
  /** 満貫以上の呼び名（それ未満は null） */
  rank: string | null;
}

function ceil100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

/** 符と翻から点数を計算する */
export function calcScore(
  han: number,
  fu: number,
  options: ScoreOptions,
): ScoreResult {
  const yakuman = options.yakuman ?? 0;
  let base: number;
  let rank: string | null = null;

  if (yakuman > 0) {
    base = 8000 * yakuman;
    rank = yakuman >= 2 ? `${yakuman}倍役満` : "役満";
  } else if (han >= 13) {
    base = 8000;
    rank = "数え役満";
  } else if (han >= 11) {
    base = 6000;
    rank = "三倍満";
  } else if (han >= 8) {
    base = 4000;
    rank = "倍満";
  } else if (han >= 6) {
    base = 3000;
    rank = "跳満";
  } else if (han >= 5) {
    base = 2000;
    rank = "満貫";
  } else {
    base = fu * 2 ** (2 + han);
    if (base >= 2000) {
      base = 2000;
      rank = "満貫";
    }
  }

  if (options.tsumo) {
    if (options.dealer) {
      const each = ceil100(base * 2);
      return { base, total: each * 3, payments: `${each}オール`, rank };
    }
    const ko = ceil100(base);
    const oya = ceil100(base * 2);
    return { base, total: ko * 2 + oya, payments: `${ko}/${oya}`, rank };
  }
  const total = ceil100(base * (options.dealer ? 6 : 4));
  return { base, total, payments: `${total}`, rank };
}

export interface HandScore extends HandValue {
  score: ScoreResult;
}

/** 和了形（14 枚）の役・符・点数をまとめて計算する */
export function scoreHand(
  tiles: readonly TileId[],
  context: WinContext & { dealer?: boolean },
): HandScore {
  const value = evaluateHand(tiles, context);
  const score = calcScore(value.han, value.fu, {
    dealer: context.dealer ?? false,
    tsumo: context.tsumo,
    yakuman: value.yakuman,
  });
  return { ...value, score };
}
