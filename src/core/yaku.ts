/**
 * 役判定と符計算（門前手専用）。
 *
 * 本プロジェクトのゲームはすべて鳴きなしの一人用なので、門前手のみを扱う。
 * 面子分解 × 待ち取り方の全組み合わせを評価し、
 * (役満 > 翻数 > 符) が最大になる解釈を採用する。
 */

import {
  type Decomposition,
  decompose,
  isChiitoitsuCounts,
  isKokushiCounts,
} from "./agari";
import { countsOf, KIND_COUNT, type TileId, tileKind } from "./tile";
import {
  ceil10,
  DRAGON_KINDS,
  DRAGON_NAMES,
  enumerateWaits,
  GREEN_KINDS,
  isYaochuuKind,
  type WaitPlacement,
  WIND_NAMES,
} from "./yakuCommon";

export interface WinContext {
  /** 和了牌 */
  winTile: TileId;
  /** ツモ和了か（false = ロン） */
  tsumo: boolean;
  /** 立直しているか */
  riichi?: boolean;
  /** 自風 (1=東 2=南 3=西 4=北)。既定は 2（子） */
  seatWind?: 1 | 2 | 3 | 4;
  /** 場風 (1=東 2=南)。既定は 1 */
  roundWind?: 1 | 2;
  /** ドラの枚数（赤ドラ込み。役がある場合のみ加算される） */
  doraCount?: number;
}

export interface Yaku {
  name: string;
  /** 通常役の翻数（役満の場合は 0） */
  han: number;
  /** 役満か */
  yakuman?: boolean;
}

export interface HandValue {
  /** 成立した役（ドラ含む）。役なしなら空配列 */
  yaku: Yaku[];
  /** 合計翻数（ドラ込み。役満時は 0） */
  han: number;
  /** 符（役満時は 0） */
  fu: number;
  /** 役満の倍数（0 = 通常手） */
  yakuman: number;
}

/** 手牌全体で決まる役（面子分解に依存しないもの）。役満は含まない */
function wholeHandYaku(
  counts: readonly number[],
  ctx: Required<WinContext>,
): Yaku[] {
  const yaku: Yaku[] = [];
  if (ctx.riichi) yaku.push({ name: "立直", han: 1 });
  if (ctx.tsumo) yaku.push({ name: "門前清自摸和", han: 1 });

  let hasHonor = false;
  let hasTerminal = false;
  let allYaochuu = true;
  const suits = new Set<number>();
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] === 0) continue;
    if (k >= 27) hasHonor = true;
    else {
      suits.add(Math.floor(k / 9));
      if (k % 9 === 0 || k % 9 === 8) hasTerminal = true;
    }
    if (!isYaochuuKind(k)) allYaochuu = false;
  }
  if (!hasHonor && !hasTerminal && !allYaochuu) {
    // 幺九牌が 1 枚もない
    let tanyao = true;
    for (let k = 0; k < KIND_COUNT; k++) {
      if (counts[k] > 0 && isYaochuuKind(k)) tanyao = false;
    }
    if (tanyao) yaku.push({ name: "断幺九", han: 1 });
  }
  if (allYaochuu && hasHonor && hasTerminal)
    yaku.push({ name: "混老頭", han: 2 });
  if (suits.size === 1) {
    if (hasHonor) yaku.push({ name: "混一色", han: 3 });
    else yaku.push({ name: "清一色", han: 6 });
  }
  return yaku;
}

/** 手牌全体で決まる役満 */
function wholeHandYakuman(counts: readonly number[]): Yaku[] {
  const result: Yaku[] = [];
  let allHonor = true;
  let allTerminal = true;
  let allGreen = true;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (counts[k] === 0) continue;
    if (k < 27) allHonor = false;
    if (k >= 27 || (k % 9 !== 0 && k % 9 !== 8)) allTerminal = false;
    if (!GREEN_KINDS.includes(k)) allGreen = false;
  }
  if (allHonor) result.push({ name: "字一色", han: 0, yakuman: true });
  if (allTerminal) result.push({ name: "清老頭", han: 0, yakuman: true });
  if (allGreen) result.push({ name: "緑一色", han: 0, yakuman: true });

  // 九蓮宝燈（清一色 + 1112345678999 + 1 枚）
  for (let suit = 0; suit < 3; suit++) {
    const base = suit * 9;
    let ok = true;
    let inSuit = 0;
    for (let k = 0; k < KIND_COUNT; k++) {
      if (counts[k] > 0 && (k < base || k >= base + 9)) ok = false;
      if (k >= base && k < base + 9) inSuit += counts[k];
    }
    if (!ok || inSuit !== 14) continue;
    const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
    let chuuren = true;
    for (let r = 0; r < 9; r++) {
      if (counts[base + r] < need[r]) chuuren = false;
    }
    if (chuuren) result.push({ name: "九蓮宝燈", han: 0, yakuman: true });
  }
  return result;
}

/** 面子分解 1 通り + 待ちの取り方 1 通りに対する評価 */
function evaluateVariant(
  d: Decomposition,
  wait: WaitPlacement,
  ctx: Required<WinContext>,
): { yaku: Yaku[]; yakumanList: Yaku[]; fu: number } {
  const yaku: Yaku[] = [];
  const yakumanList: Yaku[] = [];
  const runs = d.melds.filter((m) => m.type === "run");
  const triplets = d.melds.filter((m) => m.type === "triplet");
  const seatWindKind = 27 + ctx.seatWind - 1;
  const roundWindKind = 27 + ctx.roundWind - 1;
  const isYakuhaiPair =
    DRAGON_KINDS.includes(d.pair) ||
    d.pair === seatWindKind ||
    d.pair === roundWindKind;

  // --- 平和 ---
  const pinfu = runs.length === 4 && !isYakuhaiPair && wait.type === "ryanmen";
  if (pinfu) yaku.push({ name: "平和", han: 1 });

  // --- 一盃口・二盃口 ---
  const runKinds = runs.map((m) => m.kind).sort((a, b) => a - b);
  let peikoCount = 0;
  for (let i = 0; i < runKinds.length - 1; i++) {
    if (runKinds[i] === runKinds[i + 1]) {
      peikoCount++;
      i++; // 同じ順子は 2 つで 1 組
    }
  }
  if (peikoCount === 2) yaku.push({ name: "二盃口", han: 3 });
  else if (peikoCount === 1) yaku.push({ name: "一盃口", han: 1 });

  // --- 役牌 ---
  for (const t of triplets) {
    if (DRAGON_KINDS.includes(t.kind))
      yaku.push({ name: `役牌 ${DRAGON_NAMES[t.kind]}`, han: 1 });
    if (t.kind === seatWindKind)
      yaku.push({ name: `自風 ${WIND_NAMES[ctx.seatWind - 1]}`, han: 1 });
    if (t.kind === roundWindKind)
      yaku.push({ name: `場風 ${WIND_NAMES[ctx.roundWind - 1]}`, han: 1 });
  }

  // --- 三色同順 / 一気通貫 / 三色同刻 ---
  const runSet = new Set(runKinds);
  for (let r = 0; r <= 6; r++) {
    if (runSet.has(r) && runSet.has(r + 9) && runSet.has(r + 18)) {
      yaku.push({ name: "三色同順", han: 2 });
      break;
    }
  }
  for (const base of [0, 9, 18]) {
    if (runSet.has(base) && runSet.has(base + 3) && runSet.has(base + 6)) {
      yaku.push({ name: "一気通貫", han: 2 });
      break;
    }
  }
  const tripletKinds = new Set(triplets.map((m) => m.kind));
  for (let r = 0; r < 9; r++) {
    if (
      tripletKinds.has(r) &&
      tripletKinds.has(r + 9) &&
      tripletKinds.has(r + 18)
    ) {
      yaku.push({ name: "三色同刻", han: 2 });
      break;
    }
  }

  // --- 対々和・暗刻系 ---
  if (triplets.length === 4) yaku.push({ name: "対々和", han: 2 });
  // ロンで完成した刻子は明刻扱い
  const ronTripletIndex =
    !ctx.tsumo && wait.type === "shanpon" ? wait.meldIndex : -1;
  const concealedTriplets = triplets.length - (ronTripletIndex >= 0 ? 1 : 0);
  if (concealedTriplets === 4)
    yakumanList.push({ name: "四暗刻", han: 0, yakuman: true });
  else if (concealedTriplets === 3) yaku.push({ name: "三暗刻", han: 2 });

  // --- チャンタ系 ---
  const meldHasYaochuu = (m: Meld0) =>
    m.type === "triplet"
      ? isYaochuuKind(m.kind)
      : m.kind % 9 === 0 || m.kind % 9 === 6;
  type Meld0 = (typeof d.melds)[number];
  const allSetsYaochuu = d.melds.every(meldHasYaochuu) && isYaochuuKind(d.pair);
  if (allSetsYaochuu && runs.length > 0) {
    let hasHonor = d.pair >= 27;
    for (const t of triplets) if (t.kind >= 27) hasHonor = true;
    if (hasHonor) yaku.push({ name: "混全帯幺九", han: 2 });
    else yaku.push({ name: "純全帯幺九", han: 3 });
  }

  // --- 三元牌・風牌の役満/準役満 ---
  const dragonTriplets = triplets.filter((t) =>
    DRAGON_KINDS.includes(t.kind),
  ).length;
  if (dragonTriplets === 3)
    yakumanList.push({ name: "大三元", han: 0, yakuman: true });
  else if (dragonTriplets === 2 && DRAGON_KINDS.includes(d.pair))
    yaku.push({ name: "小三元", han: 2 });

  const windTriplets = triplets.filter(
    (t) => t.kind >= 27 && t.kind <= 30,
  ).length;
  const windPair = d.pair >= 27 && d.pair <= 30;
  if (windTriplets === 4)
    yakumanList.push({ name: "大四喜", han: 0, yakuman: true });
  else if (windTriplets === 3 && windPair)
    yakumanList.push({ name: "小四喜", han: 0, yakuman: true });

  // --- 符計算 ---
  let fu = 20;
  if (pinfu) {
    fu = ctx.tsumo ? 20 : 30;
  } else {
    if (!ctx.tsumo) fu += 10; // 門前ロン
    if (ctx.tsumo) fu += 2;
    if (
      wait.type === "tanki" ||
      wait.type === "kanchan" ||
      wait.type === "penchan"
    )
      fu += 2;
    triplets.forEach((t, _i) => {
      const yao = isYaochuuKind(t.kind);
      const meldIndexInAll = d.melds.indexOf(t);
      const open = meldIndexInAll === ronTripletIndex;
      fu += (yao ? 8 : 4) / (open ? 2 : 1);
    });
    if (DRAGON_KINDS.includes(d.pair)) fu += 2;
    if (d.pair === seatWindKind) fu += 2;
    if (d.pair === roundWindKind) fu += 2;
    fu = ceil10(fu);
  }

  return { yaku, yakumanList, fu };
}

function withDefaults(ctx: WinContext): Required<WinContext> {
  return {
    riichi: false,
    seatWind: 2,
    roundWind: 1,
    doraCount: 0,
    ...ctx,
  };
}

/**
 * 和了形（14 枚）の役と符を評価する。
 * 和了形でない場合はエラー。役なしの場合は han 0・yaku 空。
 */
export function evaluateHand(
  tiles: readonly TileId[],
  context: WinContext,
): HandValue {
  if (tiles.length !== 14) {
    throw new Error(`役判定は 14 枚の手牌が対象です（${tiles.length} 枚）`);
  }
  const ctx = withDefaults(context);
  const counts = countsOf(tiles);
  const winKind = tileKind(ctx.winTile);

  // --- 国士無双 ---
  if (isKokushiCounts(counts)) {
    return {
      yaku: [{ name: "国士無双", han: 0, yakuman: true }],
      han: 0,
      fu: 0,
      yakuman: 1,
    };
  }

  const whole = wholeHandYaku(counts, ctx);
  const wholeYakuman = wholeHandYakuman(counts);

  interface Candidate {
    yaku: Yaku[];
    yakumanList: Yaku[];
    fu: number;
  }
  const candidates: Candidate[] = [];

  // --- 七対子 ---
  if (isChiitoitsuCounts(counts)) {
    candidates.push({
      yaku: [...whole, { name: "七対子", han: 2 }],
      yakumanList: [...wholeYakuman],
      fu: 25,
    });
  }

  // --- 標準形 ---
  for (const d of decompose(counts)) {
    for (const wait of enumerateWaits(d, winKind)) {
      const v = evaluateVariant(d, wait, ctx);
      candidates.push({
        yaku: [...whole, ...v.yaku],
        yakumanList: [...wholeYakuman, ...v.yakumanList],
        fu: v.fu,
      });
    }
  }

  if (candidates.length === 0) {
    throw new Error("和了形ではありません");
  }

  // 役満 > 翻数 > 符 の順で最良の解釈を選ぶ
  let best: Candidate | null = null;
  let bestKey: [number, number, number] = [-1, -1, -1];
  for (const c of candidates) {
    const han = c.yaku.reduce((sum, y) => sum + y.han, 0);
    const key: [number, number, number] = [c.yakumanList.length, han, c.fu];
    if (
      key[0] > bestKey[0] ||
      (key[0] === bestKey[0] &&
        (key[1] > bestKey[1] || (key[1] === bestKey[1] && key[2] > bestKey[2])))
    ) {
      best = c;
      bestKey = key;
    }
  }
  if (!best) throw new Error("評価に失敗しました");

  if (best.yakumanList.length > 0) {
    return {
      yaku: best.yakumanList,
      han: 0,
      fu: 0,
      yakuman: best.yakumanList.length,
    };
  }

  const yaku = [...best.yaku];
  let han = yaku.reduce((sum, y) => sum + y.han, 0);
  if (han > 0 && ctx.doraCount > 0) {
    yaku.push({ name: "ドラ", han: ctx.doraCount });
    han += ctx.doraCount;
  }
  return {
    yaku: han > 0 ? yaku : [],
    han: han > 0 ? han : 0,
    fu: best.fu,
    yakuman: 0,
  };
}
