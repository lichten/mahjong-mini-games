/**
 * 対局セッション層。1 局分の RoundState（engine.ts）の上に「東風戦」の
 * 局進行（連荘・親交代・本場・供託持ち越し・終局判定・最終順位）を束ねる。
 *
 * 責務分割: 累積持ち点・親・本場・供託は RoundState を唯一の正とし、
 * MatchState は局番号（kyoku）・モード・起家（startDealer）のみを持つ。
 */

import type { Seat } from "../../core";
import { deal, type RoundState, SEATS, START_SCORE } from "./engine";

export type MatchMode = "single" | "tonpuu";

export interface MatchState {
  mode: MatchMode;
  /** 現在（または最終）の局 */
  round: RoundState;
  /** 局番号（東 N 局の N）。single は常に 1 */
  kyoku: number;
  /** 起家（東 1 局の親）。最終順位の同点タイブレークと表示に使う */
  startDealer: Seat;
  /** 対局全体が終了したか（true なら最終順位を表示） */
  done: boolean;
}

/** 終了した局から次局の進行を決める（下記決定表）。round は finished 前提 */
interface Transition {
  /** 親が続投するか（親和了 or 親テンパイ流局） */
  renchan: boolean;
  nextDealer: Seat;
  nextKyoku: number;
  nextHonba: number;
  nextKyotaku: number;
  /** この局で対局が終了するか */
  over: boolean;
}

/** dealer が単独トップか（アガリやめ判定用） */
function isSoleTop(round: RoundState, seat: Seat): boolean {
  const scores = round.players.map((p) => p.score);
  const max = Math.max(...scores);
  return scores[seat] === max && scores.filter((s) => s === max).length === 1;
}

/**
 * tonpuu の局終了 → 次局パラメータと終局判定。
 *
 * | 結果 | 条件 | kyoku | dealer | honba | 供託 |
 * |---|---|---|---|---|---|
 * | 和了 | 親和了（連荘） | 据置 | 据置 | +1 | 0（回収済） |
 * | 和了 | 子和了（親流れ） | +1 | +1 | 0 | 0（回収済） |
 * | 流局 | 親テンパイ（連荘） | 据置 | 据置 | +1 | 持ち越し |
 * | 流局 | 親ノーテン（親流れ） | +1 | +1 | +1 | 持ち越し |
 *
 * 終局（優先順）: ①トビ（0 未満） ②東 4 局で親流れ ③オーラス親トップのアガリやめ
 */
function transition(match: MatchState): Transition {
  const { round, kyoku } = match;
  if (round.phase.t !== "finished") {
    throw new Error("局が終了していません");
  }
  const result = round.phase.result;
  const dealer = round.dealer;

  let renchan: boolean;
  let nextHonba: number;
  if (result.type === "win") {
    renchan = result.winner === dealer;
    nextHonba = renchan ? round.honba + 1 : 0;
  } else {
    renchan = result.tenpai[dealer];
    nextHonba = round.honba + 1; // 流局は常に本場 +1
  }
  // 供託: 和了は回収済で round.kyotaku=0、流局は持ち越しで round.kyotaku に残る
  const nextKyotaku = round.kyotaku;
  const nextDealer = (renchan ? dealer : (dealer + 1) % 4) as Seat;
  const nextKyoku = renchan ? kyoku : kyoku + 1;

  // 終局判定
  const tobi = round.players.some((p) => p.score < 0);
  const eastFour = !renchan && kyoku >= 4; // 東 4 局で親流れ
  const agariYame = renchan && kyoku >= 4 && isSoleTop(round, dealer);
  const over = tobi || eastFour || agariYame;

  return { renchan, nextDealer, nextKyoku, nextHonba, nextKyotaku, over };
}

/** 対局を開始する（東 1 局を配牌）。起家はシード付き乱数でランダム決定 */
export function startMatch(mode: MatchMode, seed: number): MatchState {
  const round =
    mode === "tonpuu" ? deal(seed, { keepKyotakuOnDraw: true }) : deal(seed);
  return { mode, round, kyoku: 1, startDealer: round.dealer, done: false };
}

/**
 * 終了した局から次局へ進む（tonpuu）。終局なら done=true にして最終局を保持。
 * single は 1 局で終了。
 */
export function advanceMatch(match: MatchState, nextSeed: number): MatchState {
  if (match.round.phase.t !== "finished") return match;
  if (match.mode === "single") return { ...match, done: true };

  const t = transition(match);
  if (t.over) return { ...match, done: true };

  const nextRound = deal(nextSeed, {
    dealer: t.nextDealer,
    scores: match.round.players.map((p) => p.score),
    honba: t.nextHonba,
    kyotaku: t.nextKyotaku,
    keepKyotakuOnDraw: true,
  });
  return { ...match, round: nextRound, kyoku: t.nextKyoku, done: false };
}

/** 現局終了時に対局全体が終了するか（deal せず判定。UI のボタン分岐用） */
export function isMatchOver(match: MatchState): boolean {
  if (match.round.phase.t !== "finished") return false;
  if (match.mode === "single") return true;
  return transition(match).over;
}

/** 最終順位（1 位 → 4 位の seat 配列）。同点は起家に近い席（東>南>西>北）優先 */
export function finalRanking(round: RoundState, startDealer: Seat): Seat[] {
  return [...SEATS].sort((a, b) => {
    const diff = round.players[b].score - round.players[a].score;
    if (diff !== 0) return diff;
    return ((a - startDealer + 4) % 4) - ((b - startDealer + 4) % 4);
  }) as Seat[];
}

/** 返し点（オカの基準） */
export const RETURN_SCORE = 30000;
/** ウマ（1 位 → 4 位） */
export const UMA = [20, 10, -10, -20];
/** オカ（返し点との差 ×4。トップに一括加算） */
const OKA = ((RETURN_SCORE - START_SCORE) * 4) / 1000;

/**
 * ウマ・オカ換算の最終ポイント（seat 順）。
 * 流局終局では供託が卓上に残り得るためトップ取りとする。これで
 * Σ(score)+kyotaku = 100000 の不変式からポイント合計 ±0 が保たれる。
 * 同点時のウマ配分は finalRanking と同一基準（起家に近い席優先）。
 */
export function finalPoints(round: RoundState, startDealer: Seat): number[] {
  const order = finalRanking(round, startDealer);
  const points = [0, 0, 0, 0];
  for (let rank = 0; rank < 4; rank++) {
    const seat = order[rank];
    const kyotakuBonus = rank === 0 ? round.kyotaku : 0;
    const raw = round.players[seat].score + kyotakuBonus - RETURN_SCORE;
    // 持ち点は 100 点単位なので 0.1pt 整数に丸めてから戻す（浮動小数誤差回避）
    points[seat] = Math.round(raw / 100) / 10 + UMA[rank];
  }
  points[order[0]] += OKA;
  return points;
}
