/**
 * engine.test / ai.test 共用のテストヘルパー。
 * vitest に依存しない（不変条件違反は throw で報告する）。
 */

import {
  parseHand,
  sortTiles,
  type TileId,
  tileKind,
  waitKindsWithMelds,
} from "../../core";
import {
  type CpuAi,
  deal,
  type GameEvent,
  type Phase,
  type PlayerState,
  type RoundState,
  START_SCORE,
  step,
  tsumogiriAi,
} from "./engine";

/**
 * 手牌+副露+河+山+王牌+ツモ中の牌の総数（結果表示前まで常に 136）。
 * 鳴かれた河の牌は実体が副露に移っているため数えない。
 */
export function countTiles(s: RoundState): number {
  let n = s.wall.length + s.deadWall.length;
  for (const p of s.players) {
    n += p.hand.length + p.river.filter((rt) => !rt.called).length;
    n += p.melds.reduce((sum, m) => sum + m.tiles.length, 0);
  }
  if (s.phase.t === "playerTurn" && s.phase.drawn !== null) n += 1;
  return n;
}

export function totalPoints(s: RoundState): number {
  return s.players.reduce((sum, p) => sum + p.score, 0) + s.kyotaku;
}

/** プレイヤーも自動で打つドライバー（和了・カン・鳴きは常に実行） */
export function autoEvent(s: RoundState, pass: boolean): GameEvent {
  switch (s.phase.t) {
    case "playerTurn": {
      const ph = s.phase;
      if (ph.canTsumo) return { type: "TSUMO_AGARI" };
      if (ph.drawn !== null && ph.ankanKinds.length > 0) {
        return { type: "ANKAN", kind: ph.ankanKinds[0] };
      }
      if (ph.drawn !== null && ph.kakanKinds.length > 0) {
        return { type: "KAKAN", kind: ph.kakanKinds[0] };
      }
      const hand = s.players[0].hand;
      if (ph.drawn === null) {
        // 鳴き直後: 現物喰い替えにならない最初の牌を切る
        const index = hand.findIndex(
          (t) => ph.forbiddenKind === null || tileKind(t) !== ph.forbiddenKind,
        );
        return { type: "DISCARD", index };
      }
      return { type: "DISCARD", index: hand.length };
    }
    case "playerClaim":
      if (pass) return { type: "PASS" };
      return { type: "CLAIM", option: s.phase.options[0] };
    case "cpuTurn":
      return { type: "CPU_STEP" };
    default:
      throw new Error("終局後にイベントは発生しない");
  }
}

/** 1 局を自動で最後まで打つ。全ステップで不変条件を検証する */
export function autoPlay(
  seed: number,
  options: { pass?: boolean; ai?: CpuAi } = {},
): RoundState {
  const { pass = false, ai = tsumogiriAi } = options;
  let s = deal(seed);
  for (let i = 0; i < 400; i++) {
    if (s.phase.t === "finished") return s;
    if (countTiles(s) !== 136) {
      throw new Error(`seed ${seed}: 牌の総数が ${countTiles(s)} 枚になった`);
    }
    if (totalPoints(s) !== 4 * START_SCORE) {
      throw new Error(`seed ${seed}: 点数総和が ${totalPoints(s)} になった`);
    }
    if (s.deadWall.length !== 14) {
      throw new Error(`seed ${seed}: 王牌が ${s.deadWall.length} 枚になった`);
    }
    s = step(s, autoEvent(s, pass), ai);
  }
  throw new Error(`seed ${seed}: 400 手で終局しなかった`);
}

export function testPlayer(
  hand: string,
  over: Partial<PlayerState> = {},
): PlayerState {
  const tiles = sortTiles(parseHand(hand));
  const melds = over.melds ?? [];
  return {
    hand: tiles,
    melds,
    river: [],
    score: START_SCORE,
    riichi: null,
    furiten: { river: false, temporary: false, riichi: false },
    waits: waitKindsWithMelds(tiles, melds.length),
    ...over,
  };
}

/** ノーテンかつ和了に遠い CPU 用の手牌 */
export const JUNK_HAND = "m147p258s369z1122";

export const TEST_DEAD_WALL = parseHand(
  "z6z6z6z6z3z6z6z6z6z3z6z6z6z6",
) as TileId[];
// deadWall[4] = z3 → ドラ z4 / deadWall[9] = z3 → 裏ドラ z4（どの手にも含めない）

export function testState(over: Partial<RoundState>): RoundState {
  return {
    wall: [],
    deadWall: TEST_DEAD_WALL,
    doraIndicators: [TEST_DEAD_WALL[4]],
    players: [
      testPlayer(JUNK_HAND),
      testPlayer(JUNK_HAND),
      testPlayer(JUNK_HAND),
      testPlayer(JUNK_HAND),
    ],
    dealer: 0,
    turn: 0,
    phase: { t: "cpuTurn", seat: 0 },
    kyotaku: 0,
    kanCount: 0,
    anyCalls: false,
    ...over,
  };
}

type PlayerTurnPhase = Extract<Phase, { t: "playerTurn" }>;

export const playerTurnPhase = (
  drawn: TileId,
  over: Partial<PlayerTurnPhase> = {},
): Phase => ({
  t: "playerTurn",
  drawn,
  rinshan: false,
  canTsumo: false,
  canRiichi: false,
  riichiOptions: [],
  mustTsumogiri: false,
  ankanKinds: [],
  kakanKinds: [],
  forbiddenKind: null,
  ...over,
});
