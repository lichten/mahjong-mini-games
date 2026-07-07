/**
 * 四人打ち麻雀の標準 AI（doc/07 6 章）。
 *
 * - 打牌: 牌効率（シャンテン最小 → 受け入れ最大 → 字牌/端牌から切る、ドラ・赤は残す）
 * - 守備: 立直者または副露 3 組以上の他家がいて自分が 2 シャンテン以上ならベタオリ
 *   （shared/safety の安全度で現物 > スジ > 字牌 > 端 > 中張の順に切る）
 * - 鳴き: 役牌ポンは常時。それ以外はシャンテンが進み役の見込み
 *   （役牌・タンヤオ・染め手）があるときのみ。ドラ 3 枚以上で基準を緩和。
 *   大明槓・加槓はしない（保守的な選択。搶槓リスクも避ける）
 * - 立直: テンパイしたら原則宣言。待ちの残り枚数 0 のときのみダマ
 * - 暗槓: 立直者がいないときに、シャンテンが戻らないなら実行
 *
 * すべて決定論的（乱数なし）。エンジンの step(state, event, standardAi) で使う。
 */

import {
  countDora,
  countsOf,
  doraKindFromIndicator,
  isOpenMeld,
  isRedFive,
  KIND_COUNT,
  type MeldCall,
  meldKind,
  type Seat,
  shantenFromCountsWithMelds,
  shantenWithMelds,
  type TileId,
  tileKind,
  tileRank,
  tileSuit,
  waitKindsWithMelds,
} from "../../core";
import { safetyLevel } from "../shared/safety";
import {
  type ClaimOption,
  type CpuAi,
  type RoundState,
  SEATS,
  windOf,
} from "./engine";

/** 攻めてくる可能性が高い他家（立直者・副露 3 組以上） */
function threatSeats(state: RoundState, seat: Seat): Seat[] {
  return SEATS.filter(
    (s) =>
      s !== seat &&
      (state.players[s].riichi !== null ||
        state.players[s].melds.filter(isOpenMeld).length >= 3),
  );
}

/** seat から見えている牌（全員の河・全副露・ドラ表示牌）の枚数配列 */
function externalCounts(state: RoundState, seat: Seat): number[] {
  const tiles: TileId[] = [...state.doraIndicators];
  for (const s of SEATS) {
    const p = state.players[s];
    for (const rt of p.river) {
      if (!rt.called) tiles.push(rt.tile);
    }
    for (const m of p.melds) {
      if (s === seat && m.type === "ankan") continue; // 自分の暗槓は手牌相当
      tiles.push(...m.tiles);
    }
  }
  return countsOf(tiles);
}

/** 脅威となる他家の河（現物・スジ判定用） */
function threatRiverCounts(state: RoundState, threats: Seat[]): number[] {
  const tiles: TileId[] = [];
  for (const s of threats) {
    for (const rt of state.players[s].river) tiles.push(rt.tile);
  }
  return countsOf(tiles);
}

function isYaochuuTile(tile: TileId): boolean {
  return tileSuit(tile) === "z" || tileRank(tile) === 1 || tileRank(tile) === 9;
}

/** 捨てやすさ（大きいほど先に切る）。字牌 > 端牌 > 中張、ドラ・赤は残す */
function discardPreference(state: RoundState, tile: TileId): number {
  let pref =
    tileSuit(tile) === "z"
      ? 2
      : tileRank(tile) === 1 || tileRank(tile) === 9
        ? 1
        : 0;
  const doraKinds = state.doraIndicators.map(doraKindFromIndicator);
  if (doraKinds.includes(tileKind(tile))) pref -= 3;
  if (isRedFive(tile)) pref -= 3;
  return pref;
}

interface DiscardEval {
  index: number;
  tile: TileId;
  rest: TileId[];
  shanten: number;
}

/**
 * 打牌候補（牌種ごとに 1 つ。赤五は通常牌があればそちらを切る）と
 * 各候補のシャンテン数。
 */
function evaluateDiscards(
  state: RoundState,
  seat: Seat,
  handPlus: TileId[],
  forbiddenKind: number | null,
): DiscardEval[] {
  const meldCount = state.players[seat].melds.length;
  const byKind = new Map<number, number>();
  handPlus.forEach((t, i) => {
    const k = tileKind(t);
    if (forbiddenKind !== null && k === forbiddenKind) return;
    const cur = byKind.get(k);
    if (cur === undefined || (isRedFive(handPlus[cur]) && !isRedFive(t))) {
      byKind.set(k, i);
    }
  });
  const evals: DiscardEval[] = [];
  for (const index of byKind.values()) {
    const rest = [...handPlus.slice(0, index), ...handPlus.slice(index + 1)];
    evals.push({
      index,
      tile: handPlus[index],
      rest,
      shanten: shantenWithMelds(rest, meldCount),
    });
  }
  return evals;
}

/** rest（13 枚相当）の受け入れ枚数（見えていない残り枚数で重み付け） */
function ukeireCount(
  rest: TileId[],
  meldCount: number,
  external: readonly number[],
): number {
  const counts = countsOf(rest);
  const base = shantenFromCountsWithMelds(counts, meldCount);
  let total = 0;
  for (let k = 0; k < KIND_COUNT; k++) {
    const unseen = Math.max(0, 4 - external[k] - counts[k]);
    if (unseen === 0 || counts[k] >= 4) continue;
    counts[k]++;
    if (shantenFromCountsWithMelds(counts, meldCount) < base) total += unseen;
    counts[k]--;
  }
  return total;
}

/** 鳴いた後の手に役の見込みがあるか（役牌・タンヤオ・染め手） */
function hasYakuProspect(
  state: RoundState,
  seat: Seat,
  hand: TileId[],
  melds: MeldCall[],
): boolean {
  const yakuhaiKinds = [31, 32, 33, 27, 27 + windOf(seat, state.dealer) - 1];
  // 役牌: 刻子系の副露にある、または手に対子が残っている
  for (const m of melds) {
    if (m.type !== "chi" && yakuhaiKinds.includes(meldKind(m))) return true;
  }
  const counts = countsOf(hand);
  for (const k of yakuhaiKinds) {
    if (counts[k] >= 2) return true;
  }
  // タンヤオ: 副露がすべて中張で、手の幺九牌が 2 枚以下
  const meldTiles = melds.flatMap((m) => m.tiles);
  if (
    meldTiles.every((t) => !isYaochuuTile(t)) &&
    hand.filter(isYaochuuTile).length <= 2
  ) {
    return true;
  }
  // 染め手: 副露と手が 1 色 + 字牌に収まる（色違いは 2 枚まで）
  for (const suit of ["m", "p", "s"]) {
    const offMeld = meldTiles.filter(
      (t) => tileSuit(t) !== suit && tileSuit(t) !== "z",
    ).length;
    if (offMeld > 0) continue;
    const offHand = hand.filter(
      (t) => tileSuit(t) !== suit && tileSuit(t) !== "z",
    ).length;
    if (offHand <= 2) return true;
  }
  return false;
}

function removeFirst(hand: TileId[], toRemove: readonly TileId[]): TileId[] {
  const rest = [...hand];
  for (const t of toRemove) {
    const i = rest.indexOf(t);
    if (i >= 0) rest.splice(i, 1);
  }
  return rest;
}

/** 手牌 + 副露のドラ枚数（赤含む）。鳴き基準の緩和判定に使う */
function ownDoraCount(state: RoundState, seat: Seat): number {
  const p = state.players[seat];
  const tiles = [...p.hand, ...p.melds.flatMap((m) => m.tiles)];
  return (
    countDora(tiles, state.doraIndicators) + tiles.filter(isRedFive).length
  );
}

export const standardAi: CpuAi = {
  chooseDiscard(state, seat, handPlus, forbiddenKind) {
    const evals = evaluateDiscards(state, seat, handPlus, forbiddenKind);
    if (evals.length === 0) return handPlus.length - 1;
    const bestShanten = Math.min(...evals.map((e) => e.shanten));
    const threats = threatSeats(state, seat);

    if (threats.length > 0 && bestShanten >= 2) {
      // ベタオリ: 最も安全な牌を切る
      const riverCounts = threatRiverCounts(state, threats);
      const handCounts = countsOf(handPlus);
      let best = evals[0];
      let bestLevel = Number.POSITIVE_INFINITY;
      for (const e of evals) {
        const level = safetyLevel(e.tile, riverCounts, handCounts);
        if (level < bestLevel) {
          bestLevel = level;
          best = e;
        }
      }
      return best.index;
    }

    // 攻め: シャンテン最小 → 受け入れ最大 → 捨てやすい牌
    const external = externalCounts(state, seat);
    const meldCount = state.players[seat].melds.length;
    let best = evals[0];
    let bestKey: [number, number] = [
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ];
    for (const e of evals) {
      if (e.shanten !== bestShanten) continue;
      const ukeire = ukeireCount(e.rest, meldCount, external);
      const pref = discardPreference(state, e.tile);
      if (ukeire > bestKey[0] || (ukeire === bestKey[0] && pref > bestKey[1])) {
        best = e;
        bestKey = [ukeire, pref];
      }
    }
    return best.index;
  },

  chooseRiichi(state, seat, handPlus, options) {
    const meldCount = state.players[seat].melds.length;
    const external = externalCounts(state, seat);
    let best: number | null = null;
    let bestRemain = 0;
    for (const index of options) {
      const rest = [...handPlus.slice(0, index), ...handPlus.slice(index + 1)];
      const waits = waitKindsWithMelds(rest, meldCount);
      const counts = countsOf(rest);
      const remain = waits.reduce(
        (sum, k) => sum + Math.max(0, 4 - external[k] - counts[k]),
        0,
      );
      if (remain > bestRemain) {
        bestRemain = remain;
        best = index;
      }
    }
    return best; // 待ちの残りが 0 枚ならダマ（null）
  },

  chooseClaim(state, seat, tile, _from, options) {
    const p = state.players[seat];
    const meldCount = p.melds.length;
    const kind = tileKind(tile);
    const shantenNow = shantenWithMelds(p.hand, meldCount);

    // 守備中は鳴かない
    if (threatSeats(state, seat).length > 0 && shantenNow >= 2) return null;

    // 役牌ポンは常時
    const yakuhaiKinds = [31, 32, 33, 27, 27 + windOf(seat, state.dealer) - 1];
    const ponOption = options.find((o) => o.kind === "pon");
    if (ponOption && yakuhaiKinds.includes(kind)) return ponOption;

    // シャンテンが進み、役の見込みがあるときだけ鳴く（ドラ 3 枚以上で緩和）
    const doraRich = ownDoraCount(state, seat) >= 3;
    let best: ClaimOption | null = null;
    let bestAfter = shantenNow + 1;
    for (const option of options) {
      if (option.kind !== "pon" && option.kind !== "chi") continue;
      const used =
        option.kind === "pon"
          ? p.hand.filter((t) => tileKind(t) === kind).slice(0, 2)
          : option.tiles;
      const rest = removeFirst(p.hand, used);
      const after = shantenWithMelds(rest, meldCount + 1);
      const improves = after < shantenNow || (doraRich && after <= shantenNow);
      if (!improves) continue;
      const meldsAfter: MeldCall[] = [
        ...p.melds,
        {
          type: option.kind === "pon" ? "pon" : "chi",
          tiles: [...used, tile],
          calledTile: tile,
          from: _from,
        },
      ];
      if (!hasYakuProspect(state, seat, rest, meldsAfter)) continue;
      if (after < bestAfter) {
        bestAfter = after;
        best = option;
      }
    }
    return best;
  },

  chooseAnkan(state, seat, handPlus, kinds) {
    // 立直者がいるときは手を変えない（安全第一）
    if (SEATS.some((s) => s !== seat && state.players[s].riichi !== null)) {
      return null;
    }
    const meldCount = state.players[seat].melds.length;
    const before = shantenWithMelds(handPlus, meldCount);
    for (const kind of kinds) {
      const rest = handPlus.filter((t) => tileKind(t) !== kind);
      if (shantenWithMelds(rest, meldCount + 1) <= before) return kind;
    }
    return null;
  },
};
