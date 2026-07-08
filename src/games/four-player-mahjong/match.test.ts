import { describe, expect, it } from "vitest";
import type { Seat } from "../../core";
import type { RoundResult } from "./engine";
import { START_SCORE } from "./engine";
import {
  advanceMatch,
  finalRanking,
  isMatchOver,
  type MatchState,
  startMatch,
} from "./match";
import { autoPlayMatch, JUNK_HAND, testPlayer, testState } from "./testHelpers";

const HV = { yaku: [], han: 1, fu: 30, yakuman: 0 };
const SR = { base: 0, total: 1000, payments: "1000", rank: null };

function winResult(winner: Seat, tsumo = false): RoundResult {
  return {
    type: "win",
    tsumo,
    winner,
    loser: tsumo ? null : (((winner + 1) % 4) as Seat),
    winTile: "z1",
    hand: [],
    value: HV,
    score: SR,
    honba: 0,
    uraIndicators: [],
    scoreDeltas: [0, 0, 0, 0],
  };
}

function drawResult(tenpai: boolean[]): RoundResult {
  return { type: "ryuukyoku", tenpai, scoreDeltas: [0, 0, 0, 0] };
}

/** 終了した局を持つ tonpuu の MatchState を組み立てる */
function finishedMatch(opts: {
  kyoku: number;
  dealer: Seat;
  scores: number[];
  honba?: number;
  kyotaku?: number;
  startDealer?: Seat;
  result: RoundResult;
}): MatchState {
  const round = testState({
    dealer: opts.dealer,
    honba: opts.honba ?? 0,
    kyotaku: opts.kyotaku ?? 0,
    keepKyotakuOnDraw: true,
    players: [
      testPlayer(JUNK_HAND, { score: opts.scores[0] }),
      testPlayer(JUNK_HAND, { score: opts.scores[1] }),
      testPlayer(JUNK_HAND, { score: opts.scores[2] }),
      testPlayer(JUNK_HAND, { score: opts.scores[3] }),
    ],
    phase: { t: "finished", result: opts.result },
  });
  return {
    mode: "tonpuu",
    round,
    kyoku: opts.kyoku,
    startDealer: opts.startDealer ?? opts.dealer,
    done: false,
  };
}

const EVEN = [START_SCORE, START_SCORE, START_SCORE, START_SCORE];

describe("match: advanceMatch の局進行（決定表）", () => {
  it("親和了 → 連荘（局据置・本場+1・親据置）", () => {
    const m = advanceMatch(
      finishedMatch({
        kyoku: 1,
        dealer: 0,
        scores: EVEN,
        result: winResult(0),
      }),
      999,
    );
    expect(m.done).toBe(false);
    expect(m.kyoku).toBe(1);
    expect(m.round.dealer).toBe(0);
    expect(m.round.honba).toBe(1);
    expect(m.round.kyotaku).toBe(0);
  });

  it("子和了 → 親流れ（局+1・親交代・本場 0）", () => {
    const m = advanceMatch(
      finishedMatch({
        kyoku: 1,
        dealer: 0,
        honba: 2,
        scores: EVEN,
        result: winResult(1),
      }),
      999,
    );
    expect(m.done).toBe(false);
    expect(m.kyoku).toBe(2);
    expect(m.round.dealer).toBe(1);
    expect(m.round.honba).toBe(0);
  });

  it("親テンパイ流局 → 連荘・本場+1・供託持ち越し", () => {
    const m = advanceMatch(
      finishedMatch({
        kyoku: 2,
        dealer: 1,
        honba: 1,
        kyotaku: 1000,
        scores: EVEN,
        result: drawResult([false, true, false, false]),
      }),
      999,
    );
    expect(m.done).toBe(false);
    expect(m.kyoku).toBe(2);
    expect(m.round.dealer).toBe(1);
    expect(m.round.honba).toBe(2);
    expect(m.round.kyotaku).toBe(1000); // 卓上に持ち越し
  });

  it("親ノーテン流局 → 親流れ・本場+1・供託持ち越し", () => {
    const m = advanceMatch(
      finishedMatch({
        kyoku: 2,
        dealer: 1,
        honba: 0,
        kyotaku: 2000,
        scores: EVEN,
        result: drawResult([true, false, true, false]),
      }),
      999,
    );
    expect(m.done).toBe(false);
    expect(m.kyoku).toBe(3);
    expect(m.round.dealer).toBe(2);
    expect(m.round.honba).toBe(1);
    expect(m.round.kyotaku).toBe(2000);
  });

  it("dealer === (startDealer + kyoku-1) % 4 の不変式が保たれる", () => {
    let m = startMatch("tonpuu", 42);
    const kiiya = m.startDealer;
    for (let i = 0; i < 3; i++) {
      // 子和了で必ず親流れさせる
      const child = ((m.round.dealer + 1) % 4) as Seat;
      m = {
        ...m,
        round: {
          ...m.round,
          phase: { t: "finished", result: winResult(child) },
        },
      };
      m = advanceMatch(m, 100 + i);
      expect(m.round.dealer).toBe((kiiya + (m.kyoku - 1)) % 4);
    }
  });
});

describe("match: 終局判定", () => {
  it("東 4 局で子和了 → 終局（親流れ）", () => {
    const finished = finishedMatch({
      kyoku: 4,
      dealer: 3,
      scores: EVEN,
      result: winResult(0),
    });
    expect(isMatchOver(finished)).toBe(true);
    expect(advanceMatch(finished, 1).done).toBe(true);
  });

  it("東 4 局で親ノーテン流局 → 終局", () => {
    const finished = finishedMatch({
      kyoku: 4,
      dealer: 3,
      scores: EVEN,
      result: drawResult([true, false, false, false]),
    });
    expect(isMatchOver(finished)).toBe(true);
  });

  it("東 4 局で親和了だが親がトップでない → 連荘継続", () => {
    const finished = finishedMatch({
      kyoku: 4,
      dealer: 3,
      scores: [30000, 25000, 25000, 20000], // 親(3)=20000 はトップでない
      result: winResult(3),
    });
    expect(isMatchOver(finished)).toBe(false);
    const m = advanceMatch(finished, 1);
    expect(m.done).toBe(false);
    expect(m.kyoku).toBe(4);
    expect(m.round.dealer).toBe(3);
    expect(m.round.honba).toBe(1);
  });

  it("アガリやめ: 東 4 局で親和了かつ親が単独トップ → 終局", () => {
    const finished = finishedMatch({
      kyoku: 4,
      dealer: 3,
      scores: [20000, 20000, 20000, 40000], // 親(3) が単独トップ
      result: winResult(3),
    });
    expect(isMatchOver(finished)).toBe(true);
  });

  it("テンパイやめ: 東 4 局で親テンパイ流局かつ親トップ → 終局", () => {
    const finished = finishedMatch({
      kyoku: 4,
      dealer: 3,
      scores: [20000, 20000, 20000, 40000],
      result: drawResult([false, false, false, true]),
    });
    expect(isMatchOver(finished)).toBe(true);
  });

  it("トビ: 持ち点が 0 未満なら局を問わず終局", () => {
    const finished = finishedMatch({
      kyoku: 1,
      dealer: 0,
      scores: [-1000, 26000, 50000, 25000],
      result: winResult(1),
    });
    expect(isMatchOver(finished)).toBe(true);
  });
});

describe("match: 最終順位", () => {
  it("同点は起家に近い席（東>南>西>北）が上位", () => {
    const round = testState({
      players: [
        testPlayer(JUNK_HAND, { score: 25000 }),
        testPlayer(JUNK_HAND, { score: 25000 }),
        testPlayer(JUNK_HAND, { score: 30000 }),
        testPlayer(JUNK_HAND, { score: 20000 }),
      ],
    });
    // startDealer = 1 → 席順は 1,2,3,0。同点の 0 と 1 では 1 が上位
    expect(finalRanking(round, 1)).toEqual([2, 1, 0, 3]);
  });
});

describe("match: single モード", () => {
  it("1 局で終局し done になる", () => {
    const m = startMatch("single", 7);
    expect(m.kyoku).toBe(1);
    const finished = {
      ...m,
      round: {
        ...m.round,
        phase: { t: "finished" as const, result: winResult(0) },
      },
    };
    expect(isMatchOver(finished)).toBe(true);
    expect(advanceMatch(finished, 1).done).toBe(true);
  });
});

describe("match: 東風戦の通し自動対局（不変条件）", () => {
  it("シード数種で必ず終局し、点数総和 100000 が保たれる", {
    timeout: 60_000,
  }, () => {
    for (const seed of [1, 2, 3, 7, 11, 23, 99]) {
      const final = autoPlayMatch(seed);
      expect(final.done).toBe(true);
      expect(final.round.phase.t).toBe("finished");
      const total =
        final.round.players.reduce((a, p) => a + p.score, 0) +
        final.round.kyotaku;
      expect(total).toBe(4 * START_SCORE);
      expect(final.kyoku).toBeGreaterThanOrEqual(1);
    }
  });
});
