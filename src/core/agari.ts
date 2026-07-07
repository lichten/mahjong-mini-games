/**
 * 和了判定・面子分解・待ち牌計算。
 */

import { shantenFromCounts } from "./shanten";
import { countsOf, KIND_COUNT, kindToId, type TileId } from "./tile";

/** 面子。run は最小牌の種類インデックスを持つ */
export interface Meld {
  type: "run" | "triplet";
  kind: number;
}

/** 4 面子 1 雀頭の分解結果 */
export interface Decomposition {
  pair: number;
  melds: Meld[];
}

/** 14 枚相当の枚数配列が和了形か（標準形・七対子・国士のいずれか） */
export function isWinningCounts(counts: readonly number[]): boolean {
  return shantenFromCounts(counts) === -1;
}

export function isWinningHand(tiles: readonly TileId[]): boolean {
  return tiles.length === 14 && isWinningCounts(countsOf(tiles));
}

/**
 * 標準形（4 面子 1 雀頭）の分解を全パターン列挙する。
 * 七対子・国士のみの和了形では空配列になる。
 */
export function decompose(counts: readonly number[]): Decomposition[] {
  const results: Decomposition[] = [];
  const c = [...counts];

  const extractMelds = (start: number, melds: Meld[], pair: number) => {
    let i = start;
    while (i < KIND_COUNT && c[i] === 0) i++;
    if (i >= KIND_COUNT) {
      results.push({ pair, melds: [...melds] });
      return;
    }
    // 最小の牌は刻子か、その牌から始まる順子のどちらかで必ず消費される
    if (c[i] >= 3) {
      c[i] -= 3;
      melds.push({ type: "triplet", kind: i });
      extractMelds(i, melds, pair);
      melds.pop();
      c[i] += 3;
    }
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--;
      c[i + 1]--;
      c[i + 2]--;
      melds.push({ type: "run", kind: i });
      extractMelds(i, melds, pair);
      melds.pop();
      c[i]++;
      c[i + 1]++;
      c[i + 2]++;
    }
  };

  for (let pair = 0; pair < KIND_COUNT; pair++) {
    if (c[pair] < 2) continue;
    c[pair] -= 2;
    extractMelds(0, [], pair);
    c[pair] += 2;
  }
  return results;
}

/**
 * 副露 meldCount 組を除いた門前部分の枚数配列を
 * (4 - meldCount) 面子 + 1 雀頭に分解する全パターンを列挙する。
 * 枚数は (4 - meldCount) * 3 + 2 枚でなければならない。
 */
export function decomposeConcealed(
  counts: readonly number[],
  meldCount: number,
): Decomposition[] {
  if (!Number.isInteger(meldCount) || meldCount < 0 || meldCount > 4) {
    throw new Error(`副露数が不正です: ${meldCount}`);
  }
  const total = counts.reduce((sum, n) => sum + n, 0);
  const expected = (4 - meldCount) * 3 + 2;
  if (total !== expected) {
    throw new Error(
      `副露 ${meldCount} 組では門前部分は ${expected} 枚が必要です（${total} 枚）`,
    );
  }
  return decompose(counts);
}

/** 七対子形か（4 枚使いは不可） */
export function isChiitoitsuCounts(counts: readonly number[]): boolean {
  let pairs = 0;
  for (const count of counts) {
    if (count === 2) pairs++;
    else if (count !== 0) return false;
  }
  return pairs === 7;
}

/** 国士無双形か */
export function isKokushiCounts(counts: readonly number[]): boolean {
  const KOKUSHI = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  let total = 0;
  let hasPair = false;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] === 0) continue;
    if (!KOKUSHI.includes(k)) return false;
    if (counts[k] > 2) return false;
    if (counts[k] === 2) hasPair = true;
    total += counts[k];
  }
  return total === 14 && hasPair;
}

/** 13 枚の手牌の待ち牌（和了牌）。テンパイでなければ空配列 */
export function winningTiles(tiles: readonly TileId[]): TileId[] {
  if (tiles.length !== 13) {
    throw new Error(`待ち牌計算は 13 枚の手牌が対象です（${tiles.length} 枚）`);
  }
  const counts = countsOf(tiles);
  const waits: TileId[] = [];
  for (let kind = 0; kind < KIND_COUNT; kind++) {
    if (counts[kind] >= 4) continue;
    counts[kind]++;
    if (isWinningCounts(counts)) waits.push(kindToId(kind));
    counts[kind]--;
  }
  return waits;
}
