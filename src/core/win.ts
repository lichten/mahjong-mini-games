/**
 * 副露（鳴き）対応の和了評価。
 *
 * 門前専用の evaluateHand（yaku.ts）はそのまま残し、こちらは副露・
 * 食い下がり・状況役（嶺上開花等）・ドラ計上まで含めて評価する。
 * 四人打ち麻雀（doc/07）の精算はこの関数を使う。
 * 点数化は既存の calcScore（score.ts）をそのまま使える。
 */

import {
  type Decomposition,
  decomposeConcealed,
  isChiitoitsuCounts,
  isKokushiCounts,
} from "./agari";
import { isKanMeld, type MeldCall, meldKind } from "./meld";
import {
  countDora,
  countsOf,
  isRedFive,
  KIND_COUNT,
  type TileId,
  tileKind,
} from "./tile";
import type { HandValue, Yaku } from "./yaku";
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

export interface WinInput {
  /** 和了牌を含む門前部分（14 − 3 × melds.length 枚） */
  concealed: TileId[];
  melds: MeldCall[];
  winTile: TileId;
  /** ツモ和了か（false = ロン） */
  tsumo: boolean;
}

export interface WinSituation {
  riichi?: boolean;
  /** ダブルリーチ（立直と置換して 2 翻） */
  doubleRiichi?: boolean;
  ippatsu?: boolean;
  /** 嶺上開花 */
  rinshan?: boolean;
  /** 海底摸月（ツモ時のみ有効） */
  haitei?: boolean;
  /** 河底撈魚（ロン時のみ有効） */
  houtei?: boolean;
  /** 搶槓（ロン時のみ有効） */
  chankan?: boolean;
  tenhou?: boolean;
  chiihou?: boolean;
  /** 自風 (1=東 2=南 3=西 4=北) */
  seatWind: 1 | 2 | 3 | 4;
  /** 場風 (1=東 2=南) */
  roundWind: 1 | 2;
  /** 表ドラ表示牌（槓ドラ含む） */
  doraIndicators: TileId[];
  /** 裏ドラ表示牌（立直時のみ参照される） */
  uraIndicators?: TileId[];
}

/** 手牌全体（副露含む）で決まる役。食い下がりを反映する */
function wholeHandYakuOpen(
  countsAll: readonly number[],
  menzen: boolean,
): Yaku[] {
  const yaku: Yaku[] = [];
  let hasHonor = false;
  let hasTerminal = false;
  let allYaochuu = true;
  const suits = new Set<number>();
  for (let k = 0; k < KIND_COUNT; k++) {
    if (countsAll[k] === 0) continue;
    if (k >= 27) hasHonor = true;
    else {
      suits.add(Math.floor(k / 9));
      if (k % 9 === 0 || k % 9 === 8) hasTerminal = true;
    }
    if (!isYaochuuKind(k)) allYaochuu = false;
  }
  if (!hasHonor && !hasTerminal) yaku.push({ name: "断幺九", han: 1 });
  if (allYaochuu && hasHonor && hasTerminal)
    yaku.push({ name: "混老頭", han: 2 });
  if (suits.size === 1) {
    if (hasHonor) yaku.push({ name: "混一色", han: menzen ? 3 : 2 });
    else yaku.push({ name: "清一色", han: menzen ? 6 : 5 });
  }
  return yaku;
}

/** 手牌全体で決まる役満（九蓮は門前のみ、四槓子はカン 4 組） */
function wholeHandYakumanOpen(
  countsAll: readonly number[],
  concealedCounts: readonly number[],
  melds: MeldCall[],
): Yaku[] {
  const result: Yaku[] = [];
  let allHonor = true;
  let allTerminal = true;
  let allGreen = true;
  for (let k = 0; k < KIND_COUNT; k++) {
    if (countsAll[k] === 0) continue;
    if (k < 27) allHonor = false;
    if (k >= 27 || (k % 9 !== 0 && k % 9 !== 8)) allTerminal = false;
    if (!GREEN_KINDS.includes(k)) allGreen = false;
  }
  if (allHonor) result.push({ name: "字一色", han: 0, yakuman: true });
  if (allTerminal) result.push({ name: "清老頭", han: 0, yakuman: true });
  if (allGreen) result.push({ name: "緑一色", han: 0, yakuman: true });

  // 九蓮宝燈（清一色 + 1112345678999 + 1 枚。門前のみ）
  if (melds.length === 0) {
    for (let suit = 0; suit < 3; suit++) {
      const base = suit * 9;
      let ok = true;
      let inSuit = 0;
      for (let k = 0; k < KIND_COUNT; k++) {
        if (concealedCounts[k] > 0 && (k < base || k >= base + 9)) ok = false;
        if (k >= base && k < base + 9) inSuit += concealedCounts[k];
      }
      if (!ok || inSuit !== 14) continue;
      const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
      let chuuren = true;
      for (let r = 0; r < 9; r++) {
        if (concealedCounts[base + r] < need[r]) chuuren = false;
      }
      if (chuuren) result.push({ name: "九蓮宝燈", han: 0, yakuman: true });
    }
  }

  if (melds.filter(isKanMeld).length === 4)
    result.push({ name: "四槓子", han: 0, yakuman: true });
  return result;
}

/** 面子分解 1 通り + 待ちの取り方 1 通りに対する評価（副露込み） */
function evaluateVariantOpen(
  d: Decomposition,
  wait: WaitPlacement,
  melds: MeldCall[],
  tsumo: boolean,
  menzen: boolean,
  seatWind: number,
  roundWind: number,
): { yaku: Yaku[]; yakumanList: Yaku[]; fu: number } {
  const yaku: Yaku[] = [];
  const yakumanList: Yaku[] = [];
  const concealedRuns = d.melds.filter((m) => m.type === "run");
  const concealedTriplets = d.melds.filter((m) => m.type === "triplet");
  const chiKinds = melds.filter((m) => m.type === "chi").map(meldKind);
  const ponKanKinds = melds.filter((m) => m.type !== "chi").map(meldKind);
  const runKinds = [...concealedRuns.map((m) => m.kind), ...chiKinds];
  const tripletKinds = [
    ...concealedTriplets.map((m) => m.kind),
    ...ponKanKinds,
  ];
  const seatWindKind = 27 + seatWind - 1;
  const roundWindKind = 27 + roundWind - 1;
  const isYakuhaiPair =
    DRAGON_KINDS.includes(d.pair) ||
    d.pair === seatWindKind ||
    d.pair === roundWindKind;

  // --- 平和（副露・暗槓が 1 組でもあれば不成立） ---
  const pinfu =
    melds.length === 0 &&
    concealedRuns.length === 4 &&
    !isYakuhaiPair &&
    wait.type === "ryanmen";
  if (pinfu) yaku.push({ name: "平和", han: 1 });

  // --- 一盃口・二盃口（門前のみ。対象は門前部分の順子） ---
  if (menzen) {
    const sorted = concealedRuns.map((m) => m.kind).sort((a, b) => a - b);
    let peikoCount = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i] === sorted[i + 1]) {
        peikoCount++;
        i++; // 同じ順子は 2 つで 1 組
      }
    }
    if (peikoCount === 2) yaku.push({ name: "二盃口", han: 3 });
    else if (peikoCount === 1) yaku.push({ name: "一盃口", han: 1 });
  }

  // --- 役牌（ポン・カン含む全刻子） ---
  for (const kind of tripletKinds) {
    if (DRAGON_KINDS.includes(kind))
      yaku.push({ name: `役牌 ${DRAGON_NAMES[kind]}`, han: 1 });
    if (kind === seatWindKind)
      yaku.push({ name: `自風 ${WIND_NAMES[seatWind - 1]}`, han: 1 });
    if (kind === roundWindKind)
      yaku.push({ name: `場風 ${WIND_NAMES[roundWind - 1]}`, han: 1 });
  }

  // --- 三色同順 / 一気通貫（食い下がりあり）/ 三色同刻 ---
  const runSet = new Set(runKinds);
  for (let r = 0; r <= 6; r++) {
    if (runSet.has(r) && runSet.has(r + 9) && runSet.has(r + 18)) {
      yaku.push({ name: "三色同順", han: menzen ? 2 : 1 });
      break;
    }
  }
  for (const base of [0, 9, 18]) {
    if (runSet.has(base) && runSet.has(base + 3) && runSet.has(base + 6)) {
      yaku.push({ name: "一気通貫", han: menzen ? 2 : 1 });
      break;
    }
  }
  const tripletSet = new Set(tripletKinds);
  for (let r = 0; r < 9; r++) {
    if (tripletSet.has(r) && tripletSet.has(r + 9) && tripletSet.has(r + 18)) {
      yaku.push({ name: "三色同刻", han: 2 });
      break;
    }
  }

  // --- 対々和・暗刻系 ---
  if (tripletKinds.length === 4) yaku.push({ name: "対々和", han: 2 });
  // ロンで完成した刻子は明刻扱い（wait.meldIndex は門前部分 d.melds の位置）
  const ronTripletIndex =
    !tsumo && wait.type === "shanpon" ? wait.meldIndex : -1;
  const ankanCount = melds.filter((m) => m.type === "ankan").length;
  const concealedTripletCount =
    concealedTriplets.length - (ronTripletIndex >= 0 ? 1 : 0) + ankanCount;
  if (concealedTripletCount === 4)
    yakumanList.push({ name: "四暗刻", han: 0, yakuman: true });
  else if (concealedTripletCount === 3) yaku.push({ name: "三暗刻", han: 2 });

  // --- チャンタ系（食い下がりあり） ---
  const concealedYaochuu = d.melds.every((m) =>
    m.type === "triplet"
      ? isYaochuuKind(m.kind)
      : m.kind % 9 === 0 || m.kind % 9 === 6,
  );
  const meldYaochuu = melds.every((m) =>
    m.type === "chi"
      ? meldKind(m) % 9 === 0 || meldKind(m) % 9 === 6
      : isYaochuuKind(meldKind(m)),
  );
  if (
    concealedYaochuu &&
    meldYaochuu &&
    isYaochuuKind(d.pair) &&
    runKinds.length > 0
  ) {
    let hasHonor = d.pair >= 27;
    for (const kind of tripletKinds) if (kind >= 27) hasHonor = true;
    if (hasHonor) yaku.push({ name: "混全帯幺九", han: menzen ? 2 : 1 });
    else yaku.push({ name: "純全帯幺九", han: menzen ? 3 : 2 });
  }

  // --- 三元牌・風牌の役満/準役満 ---
  const dragonTriplets = tripletKinds.filter((k) =>
    DRAGON_KINDS.includes(k),
  ).length;
  if (dragonTriplets === 3)
    yakumanList.push({ name: "大三元", han: 0, yakuman: true });
  else if (dragonTriplets === 2 && DRAGON_KINDS.includes(d.pair))
    yaku.push({ name: "小三元", han: 2 });

  const windTriplets = tripletKinds.filter((k) => k >= 27 && k <= 30).length;
  const windPair = d.pair >= 27 && d.pair <= 30;
  if (windTriplets === 4)
    yakumanList.push({ name: "大四喜", han: 0, yakuman: true });
  else if (windTriplets === 3 && windPair)
    yakumanList.push({ name: "小四喜", han: 0, yakuman: true });

  // --- 符計算 ---
  let fu = 20;
  if (pinfu) {
    fu = tsumo ? 20 : 30;
  } else {
    if (!tsumo && menzen) fu += 10; // 門前ロン
    if (tsumo) fu += 2;
    if (
      wait.type === "tanki" ||
      wait.type === "kanchan" ||
      wait.type === "penchan"
    )
      fu += 2;
    d.melds.forEach((m, i) => {
      if (m.type !== "triplet") return;
      const yao = isYaochuuKind(m.kind);
      fu += (yao ? 8 : 4) / (i === ronTripletIndex ? 2 : 1);
    });
    for (const m of melds) {
      if (m.type === "chi") continue;
      const yao = isYaochuuKind(meldKind(m));
      if (m.type === "pon") fu += yao ? 4 : 2;
      else if (m.type === "ankan") fu += yao ? 32 : 16;
      else fu += yao ? 16 : 8; // 明槓・加槓
    }
    if (DRAGON_KINDS.includes(d.pair)) fu += 2;
    if (d.pair === seatWindKind) fu += 2;
    if (d.pair === roundWindKind) fu += 2;
    fu = ceil10(fu);
    if (!menzen && fu === 20) fu = 30; // 喰い平和形は 30 符に切り上げ
  }

  return { yaku, yakumanList, fu };
}

/**
 * 副露を含む和了手の役・符を評価する。
 * 和了形でない場合はエラー。役なしの場合は han 0・yaku 空（ドラも無効）。
 */
export function evaluateWin(input: WinInput, sit: WinSituation): HandValue {
  const { concealed, melds, winTile, tsumo } = input;
  const expected = 14 - melds.length * 3;
  if (concealed.length !== expected) {
    throw new Error(
      `副露 ${melds.length} 組では門前部分は ${expected} 枚が必要です（${concealed.length} 枚）`,
    );
  }
  const menzen = melds.every((m) => m.type === "ankan");
  const noCalls = melds.length === 0;
  const riichi = menzen && (sit.riichi === true || sit.doubleRiichi === true);
  const counts = countsOf(concealed);
  const winKind = tileKind(winTile);
  const allTiles = [...concealed, ...melds.flatMap((m) => m.tiles)];
  const countsAll = countsOf(allTiles);

  // --- 状況役（面子分解に依存しないもの） ---
  const situational: Yaku[] = [];
  if (riichi) {
    if (sit.doubleRiichi) situational.push({ name: "ダブル立直", han: 2 });
    else situational.push({ name: "立直", han: 1 });
    if (sit.ippatsu) situational.push({ name: "一発", han: 1 });
  }
  if (menzen && tsumo) situational.push({ name: "門前清自摸和", han: 1 });
  if (sit.rinshan) situational.push({ name: "嶺上開花", han: 1 });
  if (tsumo && sit.haitei) situational.push({ name: "海底摸月", han: 1 });
  if (!tsumo && sit.houtei) situational.push({ name: "河底撈魚", han: 1 });
  if (!tsumo && sit.chankan) situational.push({ name: "搶槓", han: 1 });

  const situationalYakuman: Yaku[] = [];
  if (sit.tenhou)
    situationalYakuman.push({ name: "天和", han: 0, yakuman: true });
  if (sit.chiihou)
    situationalYakuman.push({ name: "地和", han: 0, yakuman: true });

  // --- 国士無双（門前のみ） ---
  if (noCalls && isKokushiCounts(counts)) {
    const yakumanList = [
      { name: "国士無双", han: 0, yakuman: true },
      ...situationalYakuman,
    ];
    return { yaku: yakumanList, han: 0, fu: 0, yakuman: yakumanList.length };
  }

  const whole = [...situational, ...wholeHandYakuOpen(countsAll, menzen)];
  const wholeYakuman = [
    ...situationalYakuman,
    ...wholeHandYakumanOpen(countsAll, counts, melds),
  ];

  interface Candidate {
    yaku: Yaku[];
    yakumanList: Yaku[];
    fu: number;
  }
  const candidates: Candidate[] = [];

  // --- 七対子（門前のみ） ---
  if (noCalls && isChiitoitsuCounts(counts)) {
    candidates.push({
      yaku: [...whole, { name: "七対子", han: 2 }],
      yakumanList: [...wholeYakuman],
      fu: 25,
    });
  }

  // --- 標準形 ---
  for (const d of decomposeConcealed(counts, melds.length)) {
    for (const wait of enumerateWaits(d, winKind)) {
      const v = evaluateVariantOpen(
        d,
        wait,
        melds,
        tsumo,
        menzen,
        sit.seatWind,
        sit.roundWind,
      );
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
  if (han > 0) {
    const dora = countDora(allTiles, sit.doraIndicators);
    const ura =
      riichi && sit.uraIndicators ? countDora(allTiles, sit.uraIndicators) : 0;
    const red = allTiles.filter(isRedFive).length;
    if (dora > 0) {
      yaku.push({ name: "ドラ", han: dora });
      han += dora;
    }
    if (ura > 0) {
      yaku.push({ name: "裏ドラ", han: ura });
      han += ura;
    }
    if (red > 0) {
      yaku.push({ name: "赤ドラ", han: red });
      han += red;
    }
  }
  return {
    yaku: han > 0 ? yaku : [],
    han: han > 0 ? han : 0,
    fu: best.fu,
    yakuman: 0,
  };
}
