/** [0, 1) の乱数を返す関数。Math.random と同じ形 */
export type Rng = () => number;

/** シード指定可能な擬似乱数生成器（mulberry32）。テストや問題の再現に使う */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates シャッフル（元配列は変更しない） */
export function shuffled<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 整数乱数 [0, n) */
export function randomInt(n: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * n);
}
