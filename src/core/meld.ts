/**
 * 副露（鳴き）の型とユーティリティ。
 *
 * 四人打ち麻雀（doc/07）で使う。チー・ポン・カン（暗槓/明槓/加槓）を表現し、
 * 面子分解（agari.ts の Meld）への変換を提供する。
 */

import type { Meld } from "./agari";
import { type TileId, tileKind } from "./tile";

/** 席番号。0 = 自家（画面下）、以降反時計回り（1 = 下家、2 = 対面、3 = 上家） */
export type Seat = 0 | 1 | 2 | 3;

export type MeldType = "chi" | "pon" | "minkan" | "ankan" | "kakan";

export interface MeldCall {
  type: MeldType;
  /** 実牌（赤含む）。chi / pon は 3 枚、カンは 4 枚 */
  tiles: TileId[];
  /** 鳴いた牌。ankan は null */
  calledTile: TileId | null;
  /** 鳴いた相手。ankan は null、kakan は元のポンの相手 */
  from: Seat | null;
}

/** 副露の牌種インデックス（チーは最小牌、それ以外は構成牌の種類） */
export function meldKind(call: MeldCall): number {
  return Math.min(...call.tiles.map(tileKind));
}

/** 門前が崩れる副露か（暗槓のみ門前扱い） */
export function isOpenMeld(call: MeldCall): boolean {
  return call.type !== "ankan";
}

/** カン（暗槓・明槓・加槓）か */
export function isKanMeld(call: MeldCall): boolean {
  return (
    call.type === "minkan" || call.type === "ankan" || call.type === "kakan"
  );
}

/** 面子分解の Meld 表現に変換する（カンは刻子として扱う） */
export function toAgariMeld(call: MeldCall): Meld {
  return call.type === "chi"
    ? { type: "run", kind: meldKind(call) }
    : { type: "triplet", kind: meldKind(call) };
}
