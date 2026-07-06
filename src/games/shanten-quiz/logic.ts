import {
  countsOf,
  countsToTiles,
  KIND_COUNT,
  kindToId,
  type Rng,
  randomInt,
  shanten,
  shuffled,
  sortTiles,
  type TileId,
  tryCompleteHandCounts,
} from "../../core";

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
