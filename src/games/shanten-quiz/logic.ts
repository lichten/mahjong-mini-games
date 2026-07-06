import {
  countsOf,
  KIND_COUNT,
  kindToId,
  type Rng,
  randomInt,
  shanten,
  shuffled,
  sortTiles,
  type TileId,
} from "../../core";

/** 4 面子 1 雀頭の完成形（14 枚）の枚数配列を作る。牌が 4 枚を超えたら失敗 */
function tryCompleteHandCounts(rng: Rng): number[] | null {
  const counts = new Array<number>(KIND_COUNT).fill(0);
  counts[randomInt(KIND_COUNT, rng)] += 2;
  for (let i = 0; i < 4; i++) {
    if (rng() < 0.3) {
      // 刻子
      const kind = randomInt(KIND_COUNT, rng);
      counts[kind] += 3;
      if (counts[kind] > 4) return null;
    } else {
      // 順子
      const base = randomInt(3, rng) * 9 + randomInt(7, rng);
      for (let d = 0; d < 3; d++) {
        counts[base + d]++;
        if (counts[base + d] > 4) return null;
      }
    }
  }
  return counts;
}

function countsToTiles(counts: readonly number[]): TileId[] {
  const tiles: TileId[] = [];
  for (let kind = 0; kind < KIND_COUNT; kind++) {
    for (let i = 0; i < counts[kind]; i++) tiles.push(kindToId(kind));
  }
  return tiles;
}

export interface QuizHand {
  tiles: TileId[];
  /** 正解のシャンテン数（0〜3） */
  shanten: number;
}

/**
 * シャンテン数当てクイズ用の 13 枚を生成する。
 * ランダムな完成形から数枚を無関係な牌と入れ替えることで、
 * テンパイ〜3 シャンテンが偏りなく出るようにしている。
 */
export function generateQuizHand(rng: Rng = Math.random): QuizHand {
  for (;;) {
    const counts = tryCompleteHandCounts(rng);
    if (!counts) continue;

    const swaps = randomInt(6, rng); // 0〜5 枚を入れ替え（+1 枚は 13 枚化のため抜く）
    const kept = shuffled(countsToTiles(counts), rng).slice(0, 13 - swaps);

    // 手牌に足せる残り牌のプール（各種 4 枚まで）
    const keptCounts = countsOf(kept);
    const pool: TileId[] = [];
    for (let kind = 0; kind < KIND_COUNT; kind++) {
      for (let i = keptCounts[kind]; i < 4; i++) pool.push(kindToId(kind));
    }
    const tiles = [...kept, ...shuffled(pool, rng).slice(0, swaps)];

    const value = shanten(tiles);
    if (value >= 0 && value <= 3) {
      return { tiles: sortTiles(tiles), shanten: value };
    }
  }
}
