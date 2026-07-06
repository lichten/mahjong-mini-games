import {
  type HandScore,
  type Rng,
  randomCompleteHand,
  randomInt,
  scoreHand,
  shuffled,
  sortTiles,
  type TileId,
} from "../../core";
import { WIND_LABELS } from "../shared/context";

export interface YakuQuestion {
  hand: TileId[];
  winTile: TileId;
  tsumo: boolean;
  dealer: boolean;
  seatWind: 1 | 2 | 3 | 4;
  roundWind: 1 | 2;
  doraCount: number;
  result: HandScore;
  /** 正解の役名（門前清自摸和は自明なので出題から除外） */
  answers: string[];
  /** 画面に並べる選択肢（正解 + ダミー） */
  choices: string[];
}

const BASE_POOL = [
  "平和",
  "断幺九",
  "一盃口",
  "二盃口",
  "三色同順",
  "三色同刻",
  "一気通貫",
  "対々和",
  "三暗刻",
  "七対子",
  "混一色",
  "清一色",
  "混全帯幺九",
  "純全帯幺九",
  "混老頭",
  "小三元",
  "役牌 白",
  "役牌 發",
  "役牌 中",
];

const CHOICE_COUNT = 8;

/** 役当てクイズを 1 問生成する */
export function generateYakuQuestion(rng: Rng = Math.random): YakuQuestion {
  for (;;) {
    const tiles = shuffled(randomCompleteHand(rng), rng);
    const winTile = tiles[0];
    const hand = sortTiles(tiles.slice(1));
    const tsumo = rng() < 0.5;
    const seatWind = (randomInt(4, rng) + 1) as 1 | 2 | 3 | 4;
    const dealer = seatWind === 1;
    const roundWind = (randomInt(2, rng) + 1) as 1 | 2;

    const result = scoreHand([...hand, winTile], {
      winTile,
      tsumo,
      dealer,
      seatWind,
      roundWind,
      doraCount: 0,
    });
    const answers = result.yaku
      .map((y) => y.name)
      .filter((name) => name !== "門前清自摸和");
    if (answers.length === 0) continue;

    const pool = [
      ...BASE_POOL,
      `自風 ${WIND_LABELS[seatWind - 1]}`,
      `場風 ${WIND_LABELS[roundWind - 1]}`,
    ].filter((name) => !answers.includes(name));
    const choices = shuffled(
      [
        ...answers,
        ...shuffled(pool, rng).slice(
          0,
          Math.max(0, CHOICE_COUNT - answers.length),
        ),
      ],
      rng,
    );

    return {
      hand,
      winTile,
      tsumo,
      dealer,
      seatWind,
      roundWind,
      doraCount: 0,
      result,
      answers,
      choices,
    };
  }
}
