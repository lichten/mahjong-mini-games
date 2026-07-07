import { describe, expect, it } from "vitest";
import { parseHand, tileKind } from "../../core";
import { standardAi } from "./ai";
import { type GameEvent, type RoundState, START_SCORE, step } from "./engine";
import {
  autoPlay,
  playerTurnPhase,
  testPlayer,
  testState,
  totalPoints,
} from "./testHelpers";

const stepAi = (s: RoundState, e: GameEvent) => step(s, e, standardAi);

/** 対子を含まない・和了に遠い手（鳴き・ロンが発生しない） */
const NO_PAIR_JUNK = "m147m2p258p3s369s4z1";

describe("standardAi: 自動対局", () => {
  it("標準 AI でもシード 1〜15 で必ず終局し、不変条件が保たれる", {
    timeout: 120_000,
  }, () => {
    for (let seed = 1; seed <= 15; seed++) {
      const final = autoPlay(seed, { ai: standardAi });
      expect(final.phase.t).toBe("finished");
      expect(totalPoints(final)).toBe(4 * START_SCORE);
    }
  });

  it("同じシードなら同じ結果になる（AI も決定論）", { timeout: 60_000 }, () => {
    const a = autoPlay(21, { ai: standardAi });
    const b = autoPlay(21, { ai: standardAi });
    expect(a).toEqual(b);
  });
});

describe("standardAi: ベタオリ", () => {
  it("立直者がいて 2 シャンテン以上なら現物を切る", () => {
    let s = testState({
      // CPU1 のツモは危険牌（s5）
      wall: parseHand("s5z2z2z2z2z2"),
      players: [
        // プレイヤーが立直中。河に m5 がある（現物）
        testPlayer("m123m456p789s2355", {
          riichi: { double: false, ippatsu: false },
          score: START_SCORE - 1000,
          river: [{ tile: "m5" }],
        }),
        // CPU1: バラバラの手（2 シャンテン以上）に現物 m5 を持っている
        testPlayer("m258p369s147z12m55"),
        testPlayer(NO_PAIR_JUNK),
        testPlayer(NO_PAIR_JUNK),
      ],
      kyotaku: 1000,
      turn: 1,
      phase: { t: "cpuTurn", seat: 1 },
    });
    s = stepAi(s, { type: "CPU_STEP" });
    const river = s.players[1].river;
    expect(river[river.length - 1].tile).toBe("m5"); // 現物でベタオリ
  });
});

describe("standardAi: 鳴き判断", () => {
  it("役牌は常にポンする", () => {
    let s = testState({
      wall: parseHand("z2z2z2z2z2z2"),
      players: [
        testPlayer(NO_PAIR_JUNK),
        testPlayer(NO_PAIR_JUNK),
        // CPU2: 中の対子を持つ
        testPlayer("m147m99p258s369z77"),
        testPlayer(NO_PAIR_JUNK),
      ],
      turn: 0,
      phase: playerTurnPhase("z7"),
    });
    // プレイヤーが z7（中）をツモ切り → CPU2 がポン
    s = stepAi(s, { type: "DISCARD", index: 13 });
    expect(s.players[2].melds).toEqual([
      { type: "pon", tiles: ["z7", "z7", "z7"], calledTile: "z7", from: 0 },
    ]);
    expect(s.phase).toEqual({
      t: "cpuTurn",
      seat: 2,
      afterCall: { forbiddenKind: tileKind("z7") },
    });

    // 鳴いた後は打牌して次の手番（CPU3）へ
    s = stepAi(s, { type: "CPU_STEP" });
    expect(s.players[2].hand).toHaveLength(10);
    expect(s.phase).toEqual({ t: "cpuTurn", seat: 3 });
  });

  it("役の見込みがない鳴きはしない", () => {
    let s = testState({
      wall: parseHand("z2z2z2z2z2z2"),
      players: [
        testPlayer(NO_PAIR_JUNK),
        testPlayer(NO_PAIR_JUNK),
        // CPU2: m5 ポンでシャンテンは進むが、幺九牌が多く役の見込みがない
        testPlayer("m55m19p234s23s678z1"),
        testPlayer(NO_PAIR_JUNK),
      ],
      turn: 0,
      phase: playerTurnPhase("m5"),
    });
    s = stepAi(s, { type: "DISCARD", index: 13 });
    expect(s.players[2].melds).toEqual([]);
    expect(s.phase).toEqual({ t: "cpuTurn", seat: 1 });
  });

  it("タンヤオ見込みでシャンテンが進むポンはする", () => {
    let s = testState({
      wall: parseHand("z2z2z2z2z2z2"),
      players: [
        testPlayer(NO_PAIR_JUNK),
        testPlayer(NO_PAIR_JUNK),
        // CPU2: 中張だらけの 1 シャンテン。m5 ポンでテンパイに進む
        testPlayer("m55m67p234p678s445"),
        testPlayer(NO_PAIR_JUNK),
      ],
      turn: 0,
      phase: playerTurnPhase("m5"),
    });
    s = stepAi(s, { type: "DISCARD", index: 13 });
    expect(s.players[2].melds).toHaveLength(1);
    expect(s.players[2].melds[0].type).toBe("pon");
  });
});

describe("standardAi: 立直とカン", () => {
  it("テンパイしたら立直を宣言する", () => {
    let s = testState({
      // CPU1 が z5 をツモ → ツモ切り立直
      wall: parseHand("z5z2z2z2z2z2"),
      players: [
        testPlayer(NO_PAIR_JUNK),
        // 河に 1 枚置いて W 立直を避ける
        testPlayer("m123m456p789s2355", { river: [{ tile: "z6" }] }),
        testPlayer(NO_PAIR_JUNK),
        testPlayer(NO_PAIR_JUNK),
      ],
      turn: 1,
      phase: { t: "cpuTurn", seat: 1 },
    });
    s = stepAi(s, { type: "CPU_STEP" });
    const p1 = s.players[1];
    expect(p1.riichi).toEqual({ double: false, ippatsu: true });
    expect(p1.score).toBe(START_SCORE - 1000);
    expect(s.kyotaku).toBe(1000);
    expect(p1.river[p1.river.length - 1]).toEqual({
      tile: "z5",
      riichiDeclare: true,
    });
  });

  it("立直者がいなければ暗槓してシャンテンを保つ", () => {
    let s = testState({
      wall: parseHand("z5z2z2z2z2z2"),
      players: [
        testPlayer(NO_PAIR_JUNK),
        // CPU1: z5 を 3 枚持つテンパイ形。4 枚目をツモってもシャンテンが保たれる
        testPlayer("m123p456s789z1555"),
        testPlayer(NO_PAIR_JUNK),
        testPlayer(NO_PAIR_JUNK),
      ],
      turn: 1,
      phase: { t: "cpuTurn", seat: 1 },
    });
    s = stepAi(s, { type: "CPU_STEP" });
    expect(s.players[1].melds).toHaveLength(1);
    expect(s.players[1].melds[0].type).toBe("ankan");
    expect(s.kanCount).toBe(1);
    expect(s.doraIndicators).toHaveLength(2);
    // カンの後は嶺上ツモから打牌まで済ませて次の手番へ
    expect(s.phase.t).toBe("cpuTurn");
  });

  it("立直者がいるときは暗槓しない", () => {
    let s = testState({
      wall: parseHand("z5z2z2z2z2z2"),
      players: [
        testPlayer("m123m456p789s2355", {
          riichi: { double: false, ippatsu: false },
          score: START_SCORE - 1000,
          river: [{ tile: "z5" }], // 現物 z5 を作っておく
        }),
        testPlayer("m123p456s789z1555"),
        testPlayer(NO_PAIR_JUNK),
        testPlayer(NO_PAIR_JUNK),
      ],
      kyotaku: 1000,
      turn: 1,
      phase: { t: "cpuTurn", seat: 1 },
    });
    s = stepAi(s, { type: "CPU_STEP" });
    expect(s.players[1].melds).toEqual([]);
    expect(s.kanCount).toBe(0);
  });
});
