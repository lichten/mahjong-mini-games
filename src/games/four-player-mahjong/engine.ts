/**
 * 四人打ち麻雀（doc/07）の局進行エンジン。React 非依存の純粋関数群。
 *
 * フェーズ3までの範囲: 配牌・ツモ・打牌・ツモ和了・ロン（頭ハネ）・立直
 * （一発・裏ドラ・W立直）・フリテン 3 種・荒牌流局（ノーテン罰符）・
 * 鳴きフル対応（ポン・チー・明槓/暗槓/加槓、搶槓、嶺上開花、槓ドラ即めくり、
 * 王牌 14 枚維持、現物喰い替え禁止、海底カン禁止、立直後の暗槓制限）。
 *
 * 鳴き・カンを行うのはプレイヤーのみ（CPU の鳴き判断はフェーズ4の AI で追加。
 * 現状の CPU はツモ切りと和了のみ）。
 *
 * deal(seed) で山を確定した後の進行に乱数はなく、step は完全に決定論的。
 * 同じシードと同じイベント列は常に同じ結果を返す（リプレイ・テスト可能）。
 */

import {
  calcScore,
  countsOf,
  createShuffledWall,
  evaluateWin,
  type HandValue,
  isRedFive,
  KIND_COUNT,
  type MeldCall,
  meldKind,
  mulberry32,
  randomInt,
  type ScoreResult,
  type Seat,
  shantenWithMelds,
  sortTiles,
  type TileId,
  tileKind,
  tileRank,
  tileSuit,
  type WinSituation,
  waitKindsWithMelds,
} from "../../core";

export const SEATS: readonly Seat[] = [0, 1, 2, 3];
export const START_SCORE = 25000;

export interface RiverTile {
  tile: TileId;
  /** 立直宣言牌（横向き表示） */
  riichiDeclare?: boolean;
  /** 他家に鳴かれた牌（グレー表示。牌の実体は副露に移る） */
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

export type ClaimOption =
  | { kind: "ron" }
  | { kind: "pon" }
  | { kind: "minkan" }
  | { kind: "chi"; tiles: [TileId, TileId] };

export type Phase =
  | {
      t: "playerTurn";
      /** ツモ牌。null = 鳴き直後（打牌のみ可能） */
      drawn: TileId | null;
      /** drawn が嶺上牌か（ツモ和了で嶺上開花になる） */
      rinshan: boolean;
      canTsumo: boolean;
      canRiichi: boolean;
      /** 立直宣言できる打牌の index（hand.length はツモ切り） */
      riichiOptions: number[];
      /** 立直済みでツモ切りしか選べない */
      mustTsumogiri: boolean;
      /** 暗槓できる牌種 */
      ankanKinds: number[];
      /** 加槓できる牌種 */
      kakanKinds: number[];
      /** 現物喰い替え禁止: 鳴いた直後に切れない牌種（null = 制限なし） */
      forbiddenKind: number | null;
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
  /**
   * 王牌 14 枚。0..3 = 嶺上（カンごとに消費し、生牌山の末尾から補充した牌で
   * スロットを埋める）/ 4..8 = 表ドラ表示 / 9..13 = 裏ドラ
   */
  deadWall: TileId[];
  doraIndicators: TileId[];
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  dealer: Seat;
  turn: Seat;
  phase: Phase;
  kyotaku: number;
  /** これまでのカン成立数（嶺上牌の消費数） */
  kanCount: number;
  /** 局中に一度でも鳴き（暗槓含む）があったか（天和/地和/W立直の判定用） */
  anyCalls: boolean;
}

export type GameEvent =
  | { type: "DISCARD"; index: number; riichi?: boolean }
  | { type: "TSUMO_AGARI" }
  | { type: "ANKAN"; kind: number }
  | { type: "KAKAN"; kind: number }
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
    kanCount: 0,
    anyCalls: false,
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
  extra: { rinshan?: boolean; chankan?: boolean } = {},
): HandValue | null {
  if (shantenWithMelds(hand14, state.players[seat].melds.length) !== -1) {
    return null;
  }
  const p = state.players[seat];
  const firstDraw =
    p.river.length === 0 && p.melds.length === 0 && !state.anyCalls;
  const sit: WinSituation = {
    riichi: p.riichi !== null && !p.riichi.double,
    doubleRiichi: p.riichi?.double ?? false,
    ippatsu: p.riichi?.ippatsu ?? false,
    rinshan: extra.rinshan ?? false,
    haitei: tsumo && state.wall.length === 0 && !extra.rinshan,
    houtei: !tsumo && state.wall.length === 0,
    chankan: extra.chankan ?? false,
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

/** hand14 のうち、切ると残りがテンパイになる index の一覧 */
function listTenpaiDiscards(hand14: TileId[], meldCount: number): number[] {
  const options: number[] = [];
  for (let i = 0; i < hand14.length; i++) {
    const rest = [...hand14.slice(0, i), ...hand14.slice(i + 1)];
    if (shantenWithMelds(rest, meldCount) === 0) options.push(i);
  }
  return options;
}

/** hand から指定の牌を 1 枚ずつ取り除く */
function removeTiles(hand: TileId[], toRemove: readonly TileId[]): TileId[] {
  const rest = [...hand];
  for (const t of toRemove) {
    const i = rest.indexOf(t);
    if (i < 0) throw new Error(`手牌にない牌です: ${t}`);
    rest.splice(i, 1);
  }
  return rest;
}

/** 全員の一発フラグを消す（鳴き・カン成立時） */
function clearIppatsu(players: Players): Players {
  let next = players;
  for (const seat of SEATS) {
    const r = players[seat].riichi;
    if (r?.ippatsu) {
      next = updatePlayer(next, seat, { riichi: { ...r, ippatsu: false } });
    }
  }
  return next;
}

/** 打牌者の立直宣言がまだ成立していなければ成立させる（供託・W立直判定） */
function finalizePendingRiichi(state: RoundState, seat: Seat): RoundState {
  const p = state.players[seat];
  const last = p.river[p.river.length - 1];
  if (!last?.riichiDeclare || p.riichi !== null) return state;
  return {
    ...state,
    kyotaku: state.kyotaku + 1000,
    players: updatePlayer(state.players, seat, {
      score: p.score - 1000,
      riichi: {
        double: p.river.length === 1 && !state.anyCalls,
        ippatsu: true,
      },
    }),
  };
}

/** 待ちに入っていた牌を取り逃した他家に同巡（立直中は永続）フリテンを付ける */
function markMissedWaits(players: Players, from: Seat, kind: number): Players {
  let next = players;
  for (const seat of SEATS) {
    if (seat === from) continue;
    const p = next[seat];
    if (!p.waits.includes(kind)) continue;
    next = updatePlayer(next, seat, {
      furiten: {
        ...p.furiten,
        temporary: true,
        riichi: p.furiten.riichi || p.riichi !== null,
      },
    });
  }
  return next;
}

/** 新しい槓ドラ表示牌をめくる */
function revealKanDora(state: RoundState): RoundState {
  return {
    ...state,
    doraIndicators: [
      ...state.doraIndicators,
      state.deadWall[4 + state.doraIndicators.length],
    ],
  };
}

/** 嶺上牌をツモり、生牌山の末尾から王牌を補充する（王牌は常に 14 枚） */
function drawRinshan(state: RoundState): { state: RoundState; tile: TileId } {
  const tile = state.deadWall[state.kanCount];
  const deadWall = [...state.deadWall];
  deadWall[state.kanCount] = state.wall[state.wall.length - 1];
  return {
    state: {
      ...state,
      deadWall,
      wall: state.wall.slice(0, -1),
      kanCount: state.kanCount + 1,
    },
    tile,
  };
}

/**
 * プレイヤーの手番フェーズを構築する。
 * drawn = null は鳴き直後（打牌のみ）、rinshan = true は嶺上ツモ。
 */
function makePlayerTurn(
  state: RoundState,
  drawn: TileId | null,
  rinshan: boolean,
  forbiddenKind: number | null,
): RoundState {
  if (drawn === null) {
    return {
      ...state,
      phase: {
        t: "playerTurn",
        drawn: null,
        rinshan: false,
        canTsumo: false,
        canRiichi: false,
        riichiOptions: [],
        mustTsumogiri: false,
        ankanKinds: [],
        kakanKinds: [],
        forbiddenKind,
      },
    };
  }
  const p = state.players[0];
  const handPlus = [...p.hand, drawn];
  const canTsumo =
    winValue(state, 0, handPlus, drawn, true, { rinshan }) !== null;
  const mustTsumogiri = p.riichi !== null;

  // カン（海底では不可・嶺上は 4 枚まで）
  let ankanKinds: number[] = [];
  let kakanKinds: number[] = [];
  if (state.kanCount < 4 && state.wall.length >= 1) {
    const counts = countsOf(handPlus);
    if (p.riichi) {
      // 立直後: ツモった牌自身の暗槓のみ、かつ待ちが変わらない場合（送り槓禁止）
      const k = tileKind(drawn);
      if (counts[k] === 4) {
        const rest = handPlus.filter((t) => tileKind(t) !== k);
        const newWaits = waitKindsWithMelds(rest, p.melds.length + 1);
        const same =
          newWaits.length === p.waits.length &&
          newWaits.every((w, i) => w === p.waits[i]);
        if (same) ankanKinds = [k];
      }
    } else {
      for (let k = 0; k < KIND_COUNT; k++) {
        if (counts[k] === 4) ankanKinds.push(k);
      }
      kakanKinds = p.melds
        .filter((m) => m.type === "pon")
        .map(meldKind)
        .filter((k) => handPlus.some((t) => tileKind(t) === k));
    }
  }

  // 立直（門前・1000 点以上・自分のツモが残っている）
  let riichiOptions: number[] = [];
  if (
    !mustTsumogiri &&
    p.melds.every((m) => m.type === "ankan") &&
    p.score >= 1000 &&
    state.wall.length >= 4
  ) {
    riichiOptions = listTenpaiDiscards(handPlus, p.melds.length);
  }

  return {
    ...state,
    phase: {
      t: "playerTurn",
      drawn,
      rinshan,
      canTsumo,
      canRiichi: riichiOptions.length > 0,
      riichiOptions,
      mustTsumogiri,
      ankanKinds,
      kakanKinds,
      forbiddenKind,
    },
  };
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
  return makePlayerTurn({ ...state, wall, players }, drawn, false, null);
}

/** 打牌を確定し、河・待ち・フリテンを更新してロン・鳴き裁定へ */
function performDiscard(
  state: RoundState,
  seat: Seat,
  hand: TileId[],
  tile: TileId,
  declareRiichi: boolean,
): RoundState {
  const p = state.players[seat];
  const sorted = sortTiles(hand);
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
  return resolveDiscard({ ...state, players }, seat, tile, false);
}

/** プレイヤーが取れる鳴きの選択肢（ロンは含まない） */
function playerCallOptions(
  state: RoundState,
  from: Seat,
  tile: TileId,
): ClaimOption[] {
  const p = state.players[0];
  // 立直中は鳴けない。河底の打牌も鳴けない
  if (from === 0 || p.riichi !== null || state.wall.length === 0) return [];
  const kind = tileKind(tile);
  const options: ClaimOption[] = [];
  const matching = p.hand.filter((t) => tileKind(t) === kind);
  if (matching.length >= 2) options.push({ kind: "pon" });
  if (matching.length >= 3 && state.kanCount < 4) {
    options.push({ kind: "minkan" });
  }
  // チーは上家（seat 3）からのみ。数牌のみ
  if (from === 3 && tileSuit(tile) !== "z") {
    const suit = tileSuit(tile);
    const rank = tileRank(tile);
    const shapes: [number, number][] = [
      [rank - 2, rank - 1],
      [rank - 1, rank + 1],
      [rank + 1, rank + 2],
    ];
    const seen = new Set<string>();
    for (const [a, b] of shapes) {
      if (a < 1 || b > 9) continue;
      for (const ta of distinctTilesOfRank(p.hand, suit, a)) {
        for (const tb of distinctTilesOfRank(p.hand, suit, b)) {
          const key = `${ta}${tb}`;
          if (seen.has(key)) continue;
          seen.add(key);
          options.push({ kind: "chi", tiles: [ta, tb] });
        }
      }
    }
  }
  return options;
}

/** 指定スート・ランクの牌を重複なしで列挙する（赤五は別の牌として区別） */
function distinctTilesOfRank(
  hand: readonly TileId[],
  suit: string,
  rank: number,
): TileId[] {
  const set = new Set<TileId>();
  for (const t of hand) {
    if (tileSuit(t) === suit && tileRank(t) === rank) set.add(t);
  }
  return [...set];
}

/**
 * 打牌に対するロン・鳴き裁定と手番の移行。
 * 優先順位はロン > ポン・カン > チー。ロン競合は頭ハネ
 * （打牌者から反時計回りで最初にロンできる 1 人だけが和了する）。
 */
function resolveDiscard(
  state: RoundState,
  from: Seat,
  tile: TileId,
  skipPlayer: boolean,
): RoundState {
  const kind = tileKind(tile);

  // --- ロン（最優先・頭ハネ） ---
  for (let i = 1; i <= 3; i++) {
    const seat = ((from + i) % 4) as Seat;
    if (seat === 0 && skipPlayer) continue;
    const p = state.players[seat];
    if (!p.waits.includes(kind) || isFuriten(p)) continue;
    const hand14 = [...p.hand, tile];
    const value = winValue(state, seat, hand14, tile, false);
    if (!value) continue; // 役なしはロン不可（見逃しフリテンは下で付く）
    if (seat === 0) {
      // プレイヤーにはロンと鳴きをまとめて提示する
      const options: ClaimOption[] = [
        { kind: "ron" },
        ...playerCallOptions(state, from, tile),
      ];
      return {
        ...state,
        phase: { t: "playerClaim", discarded: tile, from, options },
      };
    }
    return settleRon(state, seat, from, hand14, tile, value);
  }

  // --- 鳴き（ロンなしの場合。フェーズ4までは鳴くのはプレイヤーだけ） ---
  if (!skipPlayer) {
    const calls = playerCallOptions(state, from, tile);
    if (calls.length > 0) {
      return {
        ...state,
        phase: { t: "playerClaim", discarded: tile, from, options: calls },
      };
    }
  }

  // --- 誰も反応しない → 見逃しフリテン・立直成立・流局判定・次の手番 ---
  let s: RoundState = {
    ...state,
    players: markMissedWaits(state.players, from, kind),
  };
  s = finalizePendingRiichi(s, from);
  if (s.wall.length === 0) return settleRyuukyoku(s);
  const turn = ((from + 1) % 4) as Seat;
  return beginTurn({ ...s, turn });
}

/** 鳴き（ポン・チー・明槓）を実行する */
function executeClaim(
  state: RoundState,
  from: Seat,
  tile: TileId,
  option: Exclude<ClaimOption, { kind: "ron" }>,
): RoundState {
  const kind = tileKind(tile);
  const p = state.players[0];
  let meld: MeldCall;
  let hand: TileId[];
  if (option.kind === "pon") {
    // 赤五はなるべく手の中に残す
    const matching = p.hand
      .filter((t) => tileKind(t) === kind)
      .sort((a, b) => Number(isRedFive(a)) - Number(isRedFive(b)));
    const used = matching.slice(0, 2);
    meld = { type: "pon", tiles: [...used, tile], calledTile: tile, from };
    hand = removeTiles(p.hand, used);
  } else if (option.kind === "minkan") {
    const used = p.hand.filter((t) => tileKind(t) === kind);
    meld = { type: "minkan", tiles: [...used, tile], calledTile: tile, from };
    hand = removeTiles(p.hand, used);
  } else {
    meld = {
      type: "chi",
      tiles: [...option.tiles, tile],
      calledTile: tile,
      from,
    };
    hand = removeTiles(p.hand, option.tiles);
  }

  // 河の牌を「鳴かれた」表示にする（実体は副露へ移動）
  const discarder = state.players[from];
  const river = [...discarder.river];
  river[river.length - 1] = { ...river[river.length - 1], called: true };

  let s: RoundState = {
    ...state,
    anyCalls: true,
    players: updatePlayer(state.players, from, { river }),
  };
  s = finalizePendingRiichi(s, from); // 宣言牌が鳴かれても立直は成立する
  s = { ...s, players: clearIppatsu(s.players) };
  s = { ...s, players: markMissedWaits(s.players, from, kind) };
  s = {
    ...s,
    turn: 0,
    players: updatePlayer(s.players, 0, {
      hand: sortTiles(hand),
      melds: [...p.melds, meld],
    }),
  };
  if (option.kind === "minkan") {
    s = revealKanDora(s);
    const { state: s2, tile: rinshan } = drawRinshan(s);
    return makePlayerTurn(s2, rinshan, true, null);
  }
  // ポン・チーの後は現物喰い替え禁止
  return makePlayerTurn(s, null, false, kind);
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
    const pay =
      dealerWin || seat === state.dealer
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
      if (phase.t !== "playerTurn") {
        throw new Error("打牌できる局面ではありません");
      }
      const p = state.players[0];
      if (event.riichi && !phase.riichiOptions.includes(event.index)) {
        throw new Error("その牌では立直できません");
      }
      let tile: TileId;
      let hand: TileId[];
      if (phase.drawn === null) {
        // 鳴き直後: 手牌から 1 枚切る（ツモ牌はない）
        if (event.index < 0 || event.index >= p.hand.length) {
          throw new Error(`打牌 index が不正です: ${event.index}`);
        }
        tile = p.hand[event.index];
        hand = [
          ...p.hand.slice(0, event.index),
          ...p.hand.slice(event.index + 1),
        ];
      } else {
        if (phase.mustTsumogiri && event.index !== p.hand.length) {
          throw new Error("立直後はツモ切りのみ可能です");
        }
        if (event.index === p.hand.length) {
          tile = phase.drawn;
          hand = p.hand;
        } else if (event.index >= 0 && event.index < p.hand.length) {
          tile = p.hand[event.index];
          hand = [
            ...p.hand.slice(0, event.index),
            ...p.hand.slice(event.index + 1),
            phase.drawn,
          ];
        } else {
          throw new Error(`打牌 index が不正です: ${event.index}`);
        }
      }
      if (
        phase.forbiddenKind !== null &&
        tileKind(tile) === phase.forbiddenKind
      ) {
        throw new Error("鳴いた牌と同じ牌は切れません（現物喰い替え禁止）");
      }
      return performDiscard(state, 0, hand, tile, event.riichi === true);
    }
    case "TSUMO_AGARI": {
      if (phase.t !== "playerTurn" || !phase.canTsumo || phase.drawn === null) {
        throw new Error("ツモ和了できる局面ではありません");
      }
      const p = state.players[0];
      const hand14 = [...p.hand, phase.drawn];
      const value = winValue(state, 0, hand14, phase.drawn, true, {
        rinshan: phase.rinshan,
      });
      if (!value) throw new Error("和了できません");
      return settleTsumo(state, 0, hand14, phase.drawn, value);
    }
    case "ANKAN": {
      if (
        phase.t !== "playerTurn" ||
        phase.drawn === null ||
        !phase.ankanKinds.includes(event.kind)
      ) {
        throw new Error("暗槓できる局面ではありません");
      }
      const p = state.players[0];
      const handPlus = [...p.hand, phase.drawn];
      const used = handPlus.filter((t) => tileKind(t) === event.kind);
      const hand = handPlus.filter((t) => tileKind(t) !== event.kind);
      const meld: MeldCall = {
        type: "ankan",
        tiles: used,
        calledTile: null,
        from: null,
      };
      let s: RoundState = {
        ...state,
        anyCalls: true,
        players: updatePlayer(clearIppatsu(state.players), 0, {
          hand: sortTiles(hand),
          melds: [...p.melds, meld],
        }),
      };
      s = revealKanDora(s); // 暗槓も即めくり（doc/07）
      const { state: s2, tile: rinshan } = drawRinshan(s);
      return makePlayerTurn(s2, rinshan, true, null);
    }
    case "KAKAN": {
      if (
        phase.t !== "playerTurn" ||
        phase.drawn === null ||
        !phase.kakanKinds.includes(event.kind)
      ) {
        throw new Error("加槓できる局面ではありません");
      }
      const p = state.players[0];
      const handPlus = [...p.hand, phase.drawn];
      const addedIndex = handPlus.findIndex((t) => tileKind(t) === event.kind);
      const added = handPlus[addedIndex];
      const hand = sortTiles([
        ...handPlus.slice(0, addedIndex),
        ...handPlus.slice(addedIndex + 1),
      ]);
      // 搶槓チェック（頭ハネ）。成立したら加槓は不成立（槓ドラもめくらない）
      const base: RoundState = {
        ...state,
        players: updatePlayer(state.players, 0, { hand }),
      };
      for (let i = 1; i <= 3; i++) {
        const seat = i as Seat;
        const other = base.players[seat];
        if (!other.waits.includes(event.kind) || isFuriten(other)) continue;
        const hand14 = [...other.hand, added];
        const value = winValue(base, seat, hand14, added, false, {
          chankan: true,
        });
        if (!value) continue;
        return settleRon(base, seat, 0, hand14, added, value);
      }
      // 搶槓の見逃しもフリテン
      let s: RoundState = {
        ...base,
        anyCalls: true,
        players: markMissedWaits(clearIppatsu(base.players), 0, event.kind),
      };
      const melds = s.players[0].melds.map((m): MeldCall => {
        if (m.type === "pon" && meldKind(m) === event.kind) {
          return { ...m, type: "kakan", tiles: [...m.tiles, added] };
        }
        return m;
      });
      s = { ...s, players: updatePlayer(s.players, 0, { melds }) };
      s = revealKanDora(s);
      const { state: s2, tile: rinshan } = drawRinshan(s);
      return makePlayerTurn(s2, rinshan, true, null);
    }
    case "CLAIM": {
      if (phase.t !== "playerClaim") {
        throw new Error("応答できる局面ではありません");
      }
      const option = phase.options.find((o) =>
        o.kind === "chi" && event.option.kind === "chi"
          ? o.tiles[0] === event.option.tiles[0] &&
            o.tiles[1] === event.option.tiles[1]
          : o.kind === event.option.kind,
      );
      if (!option) throw new Error("その応答は選べません");
      if (option.kind === "ron") {
        const p = state.players[0];
        const hand14 = [...p.hand, phase.discarded];
        const value = winValue(state, 0, hand14, phase.discarded, false);
        if (!value) throw new Error("ロンできません");
        return settleRon(state, 0, phase.from, hand14, phase.discarded, value);
      }
      return executeClaim(state, phase.from, phase.discarded, option);
    }
    case "PASS": {
      if (phase.t !== "playerClaim") {
        throw new Error("応答できる局面ではありません");
      }
      return resolveDiscard(state, phase.from, phase.discarded, true);
    }
    case "CPU_STEP": {
      if (phase.t !== "cpuTurn") throw new Error("CPU の手番ではありません");
      return cpuStep(state, phase.seat);
    }
  }
}
