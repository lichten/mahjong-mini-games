import {
  calcScore,
  type HandScore,
  type Rng,
  randomCompleteHand,
  randomInt,
  scoreHand,
  shuffled,
  sortTiles,
  type TileId,
} from "../../core";

export interface ScoreQuestion {
  /** 和了牌以外の 13 枚（理牌済み） */
  hand: TileId[];
  winTile: TileId;
  tsumo: boolean;
  dealer: boolean;
  seatWind: 1 | 2 | 3 | 4;
  roundWind: 1 | 2;
  doraCount: number;
  result: HandScore;
  /** 選択肢（支払い表示文字列）。正解を含む 4 つ */
  choices: string[];
}

/** 点数計算クイズを 1 問生成する */
export function generateScoreQuestion(rng: Rng = Math.random): ScoreQuestion {
  for (;;) {
    const tiles = shuffled(randomCompleteHand(rng), rng);
    const winTile = tiles[0];
    const hand = sortTiles(tiles.slice(1));
    const tsumo = rng() < 0.5;
    const seatWind = (randomInt(4, rng) + 1) as 1 | 2 | 3 | 4;
    const dealer = seatWind === 1;
    const roundWind = (randomInt(2, rng) + 1) as 1 | 2;
    const doraCount = randomInt(4, rng);

    const result = scoreHand([...hand, winTile], {
      winTile,
      tsumo,
      dealer,
      seatWind,
      roundWind,
      doraCount,
    });
    // 役なしは出題できない。役満はまれだが出題対象に含める
    if (result.han === 0 && result.yakuman === 0) continue;

    const correct = result.score.payments;
    const candidates = new Set<string>();
    const addVariant = (han: number, fu: number) => {
      if (han < 1 || fu < 20) return;
      candidates.add(calcScore(han, fu, { dealer, tsumo }).payments);
    };
    if (result.yakuman > 0) {
      // 役満の誤答は跳満〜三倍満クラスの点数
      addVariant(6, 30);
      addVariant(8, 30);
      addVariant(11, 30);
      addVariant(13, 30);
    } else {
      // 翻・符を少しずらした「ありそうな」点数を誤答にする
      const deltas: Array<[number, number]> = [
        [-1, 0],
        [1, 0],
        [0, 10],
        [0, -10],
        [2, 0],
        [-2, 0],
        [-1, 10],
        [1, 10],
        [1, -10],
        [3, 0],
      ];
      for (const [dh, df] of deltas) {
        addVariant(result.han + dh, result.fu + df);
      }
    }
    candidates.delete(correct);
    const wrong = shuffled([...candidates], rng).slice(0, 3);
    if (wrong.length < 3) continue;

    return {
      hand,
      winTile,
      tsumo,
      dealer,
      seatWind,
      roundWind,
      doraCount,
      result,
      choices: shuffled([correct, ...wrong], rng),
    };
  }
}
