/**
 * クイズ用のランダム手牌生成。
 */

import { winningTiles } from "./agari";
import { type Rng, randomInt, shuffled } from "./random";
import { KIND_COUNT, kindToId, sortTiles, type TileId } from "./tile";

/** 4 面子 1 雀頭の完成形（14 枚）の枚数配列を作る。牌が 4 枚を超えたら失敗して null */
export function tryCompleteHandCounts(
  rng: Rng,
  options: { suit?: number } = {},
): number[] | null {
  const counts = new Array<number>(KIND_COUNT).fill(0);
  const pickKind = () =>
    options.suit === undefined
      ? randomInt(KIND_COUNT, rng)
      : options.suit * 9 + randomInt(9, rng);
  const pickRunBase = () =>
    options.suit === undefined
      ? randomInt(3, rng) * 9 + randomInt(7, rng)
      : options.suit * 9 + randomInt(7, rng);

  counts[pickKind()] += 2;
  for (let i = 0; i < 4; i++) {
    if (rng() < 0.3) {
      const kind = pickKind();
      counts[kind] += 3;
      if (counts[kind] > 4) return null;
    } else {
      const base = pickRunBase();
      for (let d = 0; d < 3; d++) {
        counts[base + d]++;
        if (counts[base + d] > 4) return null;
      }
    }
  }
  return counts;
}

export function countsToTiles(counts: readonly number[]): TileId[] {
  const tiles: TileId[] = [];
  for (let kind = 0; kind < KIND_COUNT; kind++) {
    for (let i = 0; i < counts[kind]; i++) tiles.push(kindToId(kind));
  }
  return tiles;
}

/** ランダムな和了形 14 枚を生成する。suit を指定すると清一色形になる */
export function randomCompleteHand(
  rng: Rng = Math.random,
  options: { suit?: number } = {},
): TileId[] {
  for (;;) {
    const counts = tryCompleteHandCounts(rng, options);
    if (counts) return countsToTiles(counts);
  }
}

export interface TenpaiHand {
  tiles: TileId[];
  waits: TileId[];
}

/**
 * テンパイ形 13 枚を生成する。
 * 完成形から 1 枚抜く方式。tries 回生成して待ちの数が最も多いものを返す。
 */
export function randomTenpaiHand(
  rng: Rng = Math.random,
  options: { suit?: number; tries?: number } = {},
): TenpaiHand {
  const tries = options.tries ?? 3;
  let best: TenpaiHand | null = null;
  for (let i = 0; i < tries; i++) {
    const complete = shuffled(randomCompleteHand(rng, options), rng);
    const tiles = sortTiles(complete.slice(1));
    const waits = winningTiles(tiles);
    if (!best || waits.length > best.waits.length) {
      best = { tiles, waits };
    }
  }
  if (!best) throw new Error("テンパイ形の生成に失敗しました");
  return best;
}
