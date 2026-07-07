/**
 * シャンテン数計算と有効牌（受け入れ）計算。
 *
 * シャンテン数は「標準形（4面子1雀頭）・七対子・国士無双」の最小値。
 * テンパイ = 0、和了形 = -1。
 */

import { countsOf, KIND_COUNT, kindToId, type TileId, tileKind } from "./tile";

/**
 * 標準形のシャンテン数（内部実装）。
 * meldCount は確定済みの副露数で、門前部分の counts に対して
 * 残り (4 - meldCount) 面子 + 1 雀頭を目指す。
 */
function standardShantenWithMeldCount(
  counts: readonly number[],
  meldCount: number,
): number {
  const c = [...counts];
  let best = 8;

  const evaluate = (melds: number, partials: number, hasPair: boolean) => {
    const totalMelds = meldCount + melds;
    // 面子候補は合計 4 ブロックまでしか意味を持たない
    const usefulPartials = Math.min(partials, Math.max(0, 4 - totalMelds));
    const shanten = 8 - 2 * totalMelds - usefulPartials - (hasPair ? 1 : 0);
    if (shanten < best) best = shanten;
  };

  // 面子を抜き終えた残りから塔子（対子・両面/辺張・嵌張）を抜く
  const extractPartials = (
    start: number,
    melds: number,
    partials: number,
    hasPair: boolean,
  ) => {
    if (meldCount + melds + partials >= 4 || start >= KIND_COUNT) {
      evaluate(melds, partials, hasPair);
      return;
    }
    let i = start;
    while (i < KIND_COUNT && c[i] === 0) i++;
    if (i >= KIND_COUNT) {
      evaluate(melds, partials, hasPair);
      return;
    }

    // この牌を塔子に使わない
    extractPartials(i + 1, melds, partials, hasPair);
    // 対子（刻子候補）
    if (c[i] >= 2) {
      c[i] -= 2;
      extractPartials(i, melds, partials + 1, hasPair);
      c[i] += 2;
    }
    const isNumber = i < 27;
    const rankIndex = i % 9;
    // 両面・辺張
    if (isNumber && rankIndex <= 7 && c[i + 1] > 0) {
      c[i]--;
      c[i + 1]--;
      extractPartials(i, melds, partials + 1, hasPair);
      c[i]++;
      c[i + 1]++;
    }
    // 嵌張
    if (isNumber && rankIndex <= 6 && c[i + 2] > 0) {
      c[i]--;
      c[i + 2]--;
      extractPartials(i, melds, partials + 1, hasPair);
      c[i]++;
      c[i + 2]++;
    }
  };

  // 面子（刻子・順子）を再帰的に抜く
  const extractMelds = (start: number, melds: number, hasPair: boolean) => {
    let i = start;
    while (i < KIND_COUNT && c[i] === 0) i++;
    if (i >= KIND_COUNT) {
      extractPartials(0, melds, 0, hasPair);
      return;
    }

    // この牌からは面子を作らない（塔子用に残す）
    extractMelds(i + 1, melds, hasPair);
    // 刻子
    if (c[i] >= 3) {
      c[i] -= 3;
      extractMelds(i, melds + 1, hasPair);
      c[i] += 3;
    }
    // 順子
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--;
      c[i + 1]--;
      c[i + 2]--;
      extractMelds(i, melds + 1, hasPair);
      c[i]++;
      c[i + 1]++;
      c[i + 2]++;
    }
  };

  // 雀頭を取らないケース
  extractMelds(0, 0, false);
  // 各牌を雀頭にするケース
  for (let k = 0; k < KIND_COUNT; k++) {
    if (c[k] >= 2) {
      c[k] -= 2;
      extractMelds(0, 0, true);
      c[k] += 2;
    }
  }
  return best;
}

/** 標準形（4面子1雀頭）のシャンテン数 */
export function standardShanten(counts: readonly number[]): number {
  return standardShantenWithMeldCount(counts, 0);
}

/** 七対子のシャンテン数 */
export function chiitoitsuShanten(counts: readonly number[]): number {
  let pairs = 0;
  let kinds = 0;
  for (const count of counts) {
    if (count > 0) kinds++;
    if (count >= 2) pairs++;
  }
  // 7 種に足りない分は対子が揃っていても待ちにできない
  return 6 - pairs + Math.max(0, 7 - kinds);
}

/** 国士無双の対象牌（么九牌）の種類インデックス */
const KOKUSHI_KINDS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

/** 国士無双のシャンテン数 */
export function kokushiShanten(counts: readonly number[]): number {
  let kinds = 0;
  let hasPair = false;
  for (const k of KOKUSHI_KINDS) {
    if (counts[k] > 0) kinds++;
    if (counts[k] >= 2) hasPair = true;
  }
  return 13 - kinds - (hasPair ? 1 : 0);
}

/** 34 種の枚数配列からシャンテン数（3 形式の最小値）を計算する */
export function shantenFromCounts(counts: readonly number[]): number {
  return Math.min(
    standardShanten(counts),
    chiitoitsuShanten(counts),
    kokushiShanten(counts),
  );
}

/** 手牌（13 枚または 14 枚）のシャンテン数 */
export function shanten(tiles: readonly TileId[]): number {
  if (tiles.length !== 13 && tiles.length !== 14) {
    throw new Error(
      `手牌は 13 枚か 14 枚で指定してください（${tiles.length} 枚）`,
    );
  }
  return shantenFromCounts(countsOf(tiles));
}

/**
 * 副露 meldCount 組を持つ手の門前部分のシャンテン数。
 * concealed は 13 - 3 × meldCount 枚（ツモ後は +1 枚）。
 * 副露がある場合は標準形のみ（七対子・国士は meldCount = 0 のときだけ考慮）。
 */
export function shantenWithMelds(
  concealed: readonly TileId[],
  meldCount: number,
): number {
  if (!Number.isInteger(meldCount) || meldCount < 0 || meldCount > 4) {
    throw new Error(`副露数が不正です: ${meldCount}`);
  }
  const base = 13 - meldCount * 3;
  if (concealed.length !== base && concealed.length !== base + 1) {
    throw new Error(
      `副露 ${meldCount} 組では門前部分は ${base} 枚か ${base + 1} 枚です（${concealed.length} 枚）`,
    );
  }
  const counts = countsOf(concealed);
  if (meldCount === 0) return shantenFromCounts(counts);
  return standardShantenWithMeldCount(counts, meldCount);
}

/**
 * 副露 meldCount 組を持つ手の待ち牌の種類インデックス。
 * concealed は 13 - 3 × meldCount 枚。テンパイでなければ空配列。
 */
export function waitKindsWithMelds(
  concealed: readonly TileId[],
  meldCount: number,
): number[] {
  const base = 13 - meldCount * 3;
  if (concealed.length !== base) {
    throw new Error(
      `待ち計算では門前部分は ${base} 枚が必要です（${concealed.length} 枚）`,
    );
  }
  const counts = countsOf(concealed);
  const waits: number[] = [];
  for (let kind = 0; kind < KIND_COUNT; kind++) {
    if (counts[kind] >= 4) continue;
    counts[kind]++;
    const won =
      meldCount === 0
        ? shantenFromCounts(counts) === -1
        : standardShantenWithMeldCount(counts, meldCount) === -1;
    counts[kind]--;
    if (won) waits.push(kind);
  }
  return waits;
}

export interface EffectiveTile {
  /** 有効牌の ID（通常牌表記。赤五は区別しない） */
  id: TileId;
  kind: number;
  /** 手牌に見えている分を除いた残り枚数（最大 4） */
  count: number;
}

export interface UkeireResult {
  shanten: number;
  tiles: EffectiveTile[];
  /** 有効牌の合計枚数 */
  total: number;
}

/** 13 枚の手牌に対する有効牌（シャンテン数が進む牌）と受け入れ枚数 */
export function ukeire(tiles: readonly TileId[]): UkeireResult {
  if (tiles.length !== 13) {
    throw new Error(`有効牌計算は 13 枚の手牌が対象です（${tiles.length} 枚）`);
  }
  const counts = countsOf(tiles);
  const base = shantenFromCounts(counts);
  const effective: EffectiveTile[] = [];
  let total = 0;
  for (let kind = 0; kind < KIND_COUNT; kind++) {
    if (counts[kind] >= 4) continue;
    counts[kind]++;
    const improved = shantenFromCounts(counts) < base;
    counts[kind]--;
    if (improved) {
      const count = 4 - counts[kind];
      effective.push({ id: kindToId(kind), kind, count });
      total += count;
    }
  }
  return { shanten: base, tiles: effective, total };
}

export interface DiscardOption {
  /** 切る牌（手牌にある表記のまま。赤五は m0 等で区別される） */
  tile: TileId;
  /** 切った後のシャンテン数 */
  shanten: number;
  /** 切った後の有効牌 */
  effective: EffectiveTile[];
  /** 有効牌の合計枚数 */
  total: number;
  /** シャンテン数が最小かつ受け入れ最大の打牌か */
  best: boolean;
}

/** 14 枚の手牌に対して、各打牌後のシャンテン数と受け入れを計算する */
export function discardOptions(tiles: readonly TileId[]): DiscardOption[] {
  if (tiles.length !== 14) {
    throw new Error(`打牌検討は 14 枚の手牌が対象です（${tiles.length} 枚）`);
  }
  const seen = new Set<TileId>();
  const options: DiscardOption[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (seen.has(tile)) continue;
    seen.add(tile);
    const rest = [...tiles.slice(0, i), ...tiles.slice(i + 1)];
    const result = ukeire(rest);
    options.push({
      tile,
      shanten: result.shanten,
      effective: result.tiles,
      total: result.total,
      best: false,
    });
  }
  options.sort((a, b) => a.shanten - b.shanten || b.total - a.total);
  const top = options[0];
  for (const option of options) {
    option.best = option.shanten === top.shanten && option.total === top.total;
  }
  return options;
}

/** 打牌候補のうちベスト（シャンテン最小・受け入れ最大）の牌種集合 */
export function bestDiscards(tiles: readonly TileId[]): Set<number> {
  const best = new Set<number>();
  for (const option of discardOptions(tiles)) {
    if (option.best) best.add(tileKind(option.tile));
  }
  return best;
}
