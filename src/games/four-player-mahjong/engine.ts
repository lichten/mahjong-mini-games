/**
 * 四人打ち麻雀（doc/07）の局進行エンジン。React 非依存の純粋関数群。
 *
 * フェーズ2の範囲: 配牌・ツモ・打牌・ツモ和了・ロン（頭ハネ）・立直
 * （一発・裏ドラ・W立直）・フリテン 3 種・荒牌流局（ノーテン罰符）。
 * 鳴き（ポン・チー・カン）はフェーズ3で追加する。CPU はツモ切りのみ。
 *
 * deal(seed) で山を確定した後の進行に乱数はなく、step は完全に決定論的。
 * 同じシードと同じイベント列は常に同じ結果を返す（リプレイ・テスト可能）。
 */

import {
  calcScore,
  createShuffledWall,
  evaluateWin,
  type HandValue,
  type MeldCall,
  mulberry32,
  randomInt,
  type ScoreResult,
  type Seat,
  shantenWithMelds,
  sortTiles,
  type TileId,
  tileKind,
  type WinSituation,
  waitKindsWithMelds,
} from "../../core";

export const SEATS: readonly Seat[] = [0, 1, 2, 3];
export const START_SCORE = 25000;

export interface RiverTile {
  tile: TileId;
  /** 立直宣言牌（横向き表示） */
  riichiDeclare?: boolean;
  /** 他家に鳴かれた牌（フェーズ3で使用） */
  called?: boolean;
}

export interface PlayerState {
  /** 門前部分（理牌済み。ツモ牌は含まない） */
  hand: TileId[];
  melds: MeldCall[];
  river: RiverTile[];
  score: number;
  riichi: null | { double: boolean; ippatsu: boolean };
  furiten: { river: boolean; temporary: boolean; riichi: boolean };
  /** 現在の待ち牌種（打牌のたびに再計算。ロン判定・テンパイ判定に使う） */
  waits: number[];
}

export type ClaimOption = { kind: "ron" };

export type Phase =
  | {
      t: "playerTurn";
      drawn: TileId;
      canTsumo: boolean;
      canRiichi: boolean;
      /** 立直宣言できる打牌の index（hand.length はツモ切り） */
      riichiOptions: number[];
      /** 立直済みでツモ切りしか選べない */
      mustTsumogiri: boolean;
    }
  | { t: "playerClaim"; discarded: TileId; from: Seat; options: ClaimOption[] }
  | { t: "cpuTurn"; seat: Seat }
  | { t: "finished"; result: RoundResult };

export type RoundResult =
  | {
      type: "win";
      tsumo: boolean;
      winner: Seat;
      loser: Seat | null;
      winTile: TileId;
      /** 和了時の門前部分 + 和了牌（末尾） */
      hand: TileId[];
      value: HandValue;
      score: ScoreResult;
      uraIndicators: TileId[];
      scoreDeltas: number[];
    }
  | { type: "ryuukyoku"; tenpai: boolean[]; scoreDeltas: number[] };

export interface RoundState {
  /** 残りの生牌山（先頭からツモ） */
  wall: TileId[];
  /** 王牌 14 枚（0..3 嶺上 / 4..8 表ドラ表示 / 9..13 裏ドラ） */
  deadWall: TileId[];
  doraIndicators: TileId[];
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  dealer: Seat;
  turn: Seat;
  phase: Phase;
  kyotaku: number;
}

export type GameEvent =
  | { type: "DISCARD"; index: number; riichi?: boolean }
  | { type: "TSUMO_AGARI" }
  | { type: "CLAIM"; option: ClaimOption }
  | { type: "PASS" }
  | { type: "CPU_STEP" };

function ceil100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

export function windOf(seat: Seat, dealer: Seat): 1 | 2 | 3 | 4 {
  return (((seat - dealer + 4) % 4) + 1) as 1 | 2 | 3 | 4;
}

type Players = RoundState["players"];

function updatePlayer(
  players: Players,
  seat: Seat,
  patch: Partial<PlayerState>,
): Players {
  const next = [...players] as Players;
  next[seat] = { ...players[seat], ...patch };
  return next;
}

/** 配牌して最初の手番を開始する */
export function deal(seed: number): RoundState {
  const rng = mulberry32(seed);
  const allTiles = createShuffledWall(rng);
  const dealer = randomInt(4, rng) as Seat;
  const live = allTiles.slice(0, 122);
  const deadWall = allTiles.slice(122);

  const hands: TileId[][] = [[], [], [], []];
  for (let i = 0; i < 4; i++) {
    const seat = ((dealer + i) % 4) as Seat;
    hands[seat] = sortTiles(live.slice(i * 13, i * 13 + 13));
  }
  const players = SEATS.map(
    (seat): PlayerState => ({
      hand: hands[seat],
      melds: [],
      river: [],
      score: START_SCORE,
      riichi: null,
      furiten: { river: false, temporary: false, riichi: false },
      waits: waitKindsWithMelds(hands[seat], 0),
    }),
  ) as Players;

  const state: RoundState = {
    wall: live.slice(52),
    deadWall,
    doraIndicators: [deadWall[4]],
    players,
    dealer,
    turn: dealer,
    phase: { t: "cpuTurn", seat: dealer },
    kyotaku: 0,
  };
  return beginTurn(state);
}

/**
 * 和了評価。和了形でない・役なしなら null。
 * フリテンはここでは見ない（呼び出し側でロン時のみ判定）。
 */
function winValue(
  state: RoundState,
  seat: Seat,
  hand14: TileId[],
  winTile: TileId,
  tsumo: boolean,
): HandValue | null {
  if (shantenWithMelds(hand14, state.players[seat].melds.length) !== -1) {
    return null;
  }
  const p = state.players[seat];
  const firstDraw = p.river.length === 0 && p.melds.length === 0;
  const sit: WinSituation = {
    riichi: p.riichi !== null && !p.riichi.double,
    doubleRiichi: p.riichi?.double ?? false,
    ippatsu: p.riichi?.ippatsu ?? false,
    haitei: tsumo && state.wall.length === 0,
    houtei: !tsumo && state.wall.length === 0,
    tenhou: tsumo && firstDraw && seat === state.dealer,
    chiihou: tsumo && firstDraw && seat !== state.dealer,
    seatWind: windOf(seat, state.dealer),
    roundWind: 1,
    doraIndicators: state.doraIndicators,
    uraIndicators: p.riichi
      ? state.deadWall.slice(9, 9 + state.doraIndicators.length)
      : undefined,
  };
  const value = evaluateWin(
    { concealed: hand14, melds: p.melds, winTile, tsumo },
    sit,
  );
  return value.han > 0 || value.yakuman > 0 ? value : null;
}

function isFuriten(p: PlayerState): boolean {
  return p.furiten.river || p.furiten.temporary || p.furiten.riichi;
}

/** hand14 のうち、切ると 13 枚がテンパイになる index の一覧 */
function listTenpaiDiscards(hand14: TileId[], meldCount: number): number[] {
  const options: number[] = [];
  for (let i = 0; i < hand14.length; i++) {
    const rest = [...hand14.slice(0, i), ...hand14.slice(i + 1)];
    if (shantenWithMelds(rest, meldCount) === 0) options.push(i);
  }
  return options;
}

/** state.turn の手番を開始する（プレイヤーはツモまで済ませる） */
function beginTurn(state: RoundState): RoundState {
  if (state.turn !== 0) {
    return { ...state, phase: { t: "cpuTurn", seat: state.turn } };
  }
  const drawn = state.wall[0];
  const wall = state.wall.slice(1);
  const p0 = state.players[0];
  const players = updatePlayer(state.players, 0, {
    furiten: { ...p0.furiten, temporary: false },
  });
  const s: RoundState = { ...state, wall, players };
  const p = s.players[0];
  const hand14 = [...p.hand, drawn];
  const canTsumo = winValue(s, 0, hand14, drawn, true) !== null;
  const mustTsumogiri = p.riichi !== null;
  let riichiOptions: number[] = [];
  if (
    !mustTsumogiri &&
    p.melds.every((m) => m.type === "ankan") &&
    p.score >= 1000 &&
    wall.length >= 4
  ) {
    riichiOptions = listTenpaiDiscards(hand14, p.melds.length);
  }
  return {
    ...s,
    phase: {
      t: "playerTurn",
      drawn,
      canTsumo,
      canRiichi: riichiOptions.length > 0,
      riichiOptions,
      mustTsumogiri,
    },
  };
}

/** 打牌を確定し、河・待ち・フリテンを更新してロン裁定へ */
function performDiscard(
  state: RoundState,
  seat: Seat,
  hand13: TileId[],
  tile: TileId,
  declareRiichi: boolean,
): RoundState {
  const p = state.players[seat];
  const sorted = sortTiles(hand13);
  const waits = waitKindsWithMelds(sorted, p.melds.length);
  const river: RiverTile[] = [
    ...p.river,
    declareRiichi ? { tile, riichiDeclare: true } : { tile },
  ];
  const riverFuriten = waits.some((k) =>
    river.some((rt) => tileKind(rt.tile) === k),
  );
  const players = updatePlayer(state.players, seat, {
    hand: sorted,
    river,
    waits,
    // 立直後に自分の打牌が通ったら一発は消える（宣言打牌自体は除く）
    riichi:
      p.riichi && !declareRiichi ? { ...p.riichi, ippatsu: false } : p.riichi,
    furiten: { ...p.furiten, river: riverFuriten },
  });
  return resolveDiscard(
    { ...state, players },
    seat,
    tile,
    declareRiichi,
    false,
  );
}

/**
 * 打牌に対するロン裁定と手番の移行。
 * 頭ハネ: 打牌者から反時計回りで最初にロンできる 1 人だけが和了する。
 */
function resolveDiscard(
  state: RoundState,
  from: Seat,
  tile: TileId,
  declaredRiichi: boolean,
  skipPlayer: boolean,
): RoundState {
  const kind = tileKind(tile);
  for (let i = 1; i <= 3; i++) {
    const seat = ((from + i) % 4) as Seat;
    if (seat === 0 && skipPlayer) continue;
    const p = state.players[seat];
    if (!p.waits.includes(kind) || isFuriten(p)) continue;
    const hand14 = [...p.hand, tile];
    const value = winValue(state, seat, hand14, tile, false);
    if (!value) continue; // 役なしはロン不可（見逃しフリテンは下で付く）
    if (seat === 0) {
      return {
        ...state,
        phase: {
          t: "playerClaim",
          discarded: tile,
          from,
          options: [{ kind: "ron" }],
        },
      };
    }
    return settleRon(state, seat, from, hand14, tile, value);
  }

  // 誰もロンしない → 待ちに入っていた他家は見逃しフリテン
  let players = state.players;
  for (const seat of SEATS) {
    if (seat === from) continue;
    const p = players[seat];
    if (!p.waits.includes(kind)) continue;
    players = updatePlayer(players, seat, {
      furiten: {
        ...p.furiten,
        temporary: true,
        riichi: p.furiten.riichi || p.riichi !== null,
      },
    });
  }
  let s: RoundState = { ...state, players };

  // 立直成立（宣言打牌がロンされなかった）
  if (declaredRiichi) {
    const p = s.players[from];
    s = {
      ...s,
      kyotaku: s.kyotaku + 1000,
      players: updatePlayer(s.players, from, {
        score: p.score - 1000,
        // 第 1 打での宣言はダブル立直（鳴きが入るとフェーズ3で無効化する）
        riichi: { double: p.river.length === 1, ippatsu: true },
      }),
    };
  }

  if (s.wall.length === 0) return settleRyuukyoku(s);
  const turn = ((from + 1) % 4) as Seat;
  return beginTurn({ ...s, turn });
}

function finishWithScores(
  state: RoundState,
  scores: number[],
  kyotaku: number,
  build: (deltas: number[]) => RoundResult,
): RoundState {
  const deltas = scores.map((score) => score - START_SCORE);
  let players = state.players;
  for (const seat of SEATS) {
    players = updatePlayer(players, seat, { score: scores[seat] });
  }
  return {
    ...state,
    players,
    kyotaku,
    phase: { t: "finished", result: build(deltas) },
  };
}

function settleTsumo(
  state: RoundState,
  winner: Seat,
  hand14: TileId[],
  winTile: TileId,
  value: HandValue,
): RoundState {
  const dealerWin = winner === state.dealer;
  const score = calcScore(value.han, value.fu, {
    dealer: dealerWin,
    tsumo: true,
    yakuman: value.yakuman,
  });
  const scores = state.players.map((p) => p.score);
  for (const seat of SEATS) {
    if (seat === winner) continue;
    const pay = dealerWin
      ? ceil100(score.base * 2)
      : seat === state.dealer
        ? ceil100(score.base * 2)
        : ceil100(score.base);
    scores[seat] -= pay;
    scores[winner] += pay;
  }
  scores[winner] += state.kyotaku;
  const p = state.players[winner];
  return finishWithScores(state, scores, 0, (scoreDeltas) => ({
    type: "win",
    tsumo: true,
    winner,
    loser: null,
    winTile,
    hand: hand14,
    value,
    score,
    uraIndicators: p.riichi
      ? state.deadWall.slice(9, 9 + state.doraIndicators.length)
      : [],
    scoreDeltas,
  }));
}

function settleRon(
  state: RoundState,
  winner: Seat,
  loser: Seat,
  hand14: TileId[],
  winTile: TileId,
  value: HandValue,
): RoundState {
  const score = calcScore(value.han, value.fu, {
    dealer: winner === state.dealer,
    tsumo: false,
    yakuman: value.yakuman,
  });
  const scores = state.players.map((p) => p.score);
  scores[loser] -= score.total;
  scores[winner] += score.total + state.kyotaku;
  const p = state.players[winner];
  return finishWithScores(state, scores, 0, (scoreDeltas) => ({
    type: "win",
    tsumo: false,
    winner,
    loser,
    winTile,
    hand: hand14,
    value,
    score,
    uraIndicators: p.riichi
      ? state.deadWall.slice(9, 9 + state.doraIndicators.length)
      : [],
    scoreDeltas,
  }));
}

function settleRyuukyoku(state: RoundState): RoundState {
  const tenpai = state.players.map((p) => p.waits.length > 0);
  const scores = state.players.map((p) => p.score);
  // 供託（立直棒）は宣言者に返却する（doc/07: 次局がないため）
  for (const seat of SEATS) {
    if (state.players[seat].riichi) scores[seat] += 1000;
  }
  // ノーテン罰符（場 3000 点）
  const tenpaiCount = tenpai.filter(Boolean).length;
  if (tenpaiCount >= 1 && tenpaiCount <= 3) {
    const gain = 3000 / tenpaiCount;
    const loss = 3000 / (4 - tenpaiCount);
    for (const seat of SEATS) {
      scores[seat] += tenpai[seat] ? gain : -loss;
    }
  }
  return finishWithScores(state, scores, 0, (scoreDeltas) => ({
    type: "ryuukyoku",
    tenpai,
    scoreDeltas,
  }));
}

/** CPU の 1 手番（ツモ → ツモ和了チェック → ツモ切り） */
function cpuStep(state: RoundState, seat: Seat): RoundState {
  const drawn = state.wall[0];
  const wall = state.wall.slice(1);
  const p0 = state.players[seat];
  const players = updatePlayer(state.players, seat, {
    furiten: { ...p0.furiten, temporary: false },
  });
  const s: RoundState = { ...state, wall, players };
  const p = s.players[seat];
  const hand14 = [...p.hand, drawn];
  const value = winValue(s, seat, hand14, drawn, true);
  if (value) return settleTsumo(s, seat, hand14, drawn, value);
  return performDiscard(s, seat, p.hand, drawn, false);
}

/** イベントを 1 つ適用して次の状態を返す（不正なイベントはエラー） */
export function step(state: RoundState, event: GameEvent): RoundState {
  const phase = state.phase;
  switch (event.type) {
    case "DISCARD": {
      if (phase.t !== "playerTurn")
        throw new Error("打牌できる局面ではありません");
      const p = state.players[0];
      if (phase.mustTsumogiri && event.index !== p.hand.length) {
        throw new Error("立直後はツモ切りのみ可能です");
      }
      if (event.riichi && !phase.riichiOptions.includes(event.index)) {
        throw new Error("その牌では立直できません");
      }
      let tile: TileId;
      let hand13: TileId[];
      if (event.index === p.hand.length) {
        tile = phase.drawn;
        hand13 = p.hand;
      } else if (event.index >= 0 && event.index < p.hand.length) {
        tile = p.hand[event.index];
        hand13 = [
          ...p.hand.slice(0, event.index),
          ...p.hand.slice(event.index + 1),
          phase.drawn,
        ];
      } else {
        throw new Error(`打牌 index が不正です: ${event.index}`);
      }
      return performDiscard(state, 0, hand13, tile, event.riichi === true);
    }
    case "TSUMO_AGARI": {
      if (phase.t !== "playerTurn" || !phase.canTsumo) {
        throw new Error("ツモ和了できる局面ではありません");
      }
      const p = state.players[0];
      const hand14 = [...p.hand, phase.drawn];
      const value = winValue(state, 0, hand14, phase.drawn, true);
      if (!value) throw new Error("和了できません");
      return settleTsumo(state, 0, hand14, phase.drawn, value);
    }
    case "CLAIM": {
      if (phase.t !== "playerClaim")
        throw new Error("応答できる局面ではありません");
      if (event.option.kind !== "ron") throw new Error("未対応の応答です");
      const p = state.players[0];
      const hand14 = [...p.hand, phase.discarded];
      const value = winValue(state, 0, hand14, phase.discarded, false);
      if (!value) throw new Error("ロンできません");
      return settleRon(state, 0, phase.from, hand14, phase.discarded, value);
    }
    case "PASS": {
      if (phase.t !== "playerClaim")
        throw new Error("応答できる局面ではありません");
      // 打牌者が立直宣言中かは河から復元できる（未成立なら riichi はまだ null）
      const discarder = state.players[phase.from];
      const last = discarder.river[discarder.river.length - 1];
      const declaredRiichi =
        last?.riichiDeclare === true && discarder.riichi === null;
      return resolveDiscard(
        { ...state, phase: { t: "cpuTurn", seat: phase.from } },
        phase.from,
        phase.discarded,
        declaredRiichi,
        true,
      );
    }
    case "CPU_STEP": {
      if (phase.t !== "cpuTurn") throw new Error("CPU の手番ではありません");
      return cpuStep(state, phase.seat);
    }
  }
}
