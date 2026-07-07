/**
 * 牌の型定義と MPSZ 表記の取り扱い。
 *
 * 牌 ID は MPSZ 表記に統一する（doc/03-tile-assets.md）。
 * - 数牌: m1〜m9 / p1〜p9 / s1〜s9
 * - 字牌: z1(東) z2(南) z3(西) z4(北) z5(白) z6(發) z7(中)
 * - 赤五: m0 / p0 / s0
 */

export const NUMBER_SUITS = ["m", "p", "s"] as const;
export type NumberSuit = (typeof NUMBER_SUITS)[number];
export type Suit = NumberSuit | "z";

export type TileId =
  | `${NumberSuit}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | `z${1 | 2 | 3 | 4 | 5 | 6 | 7}`;

/** 牌種の総数（赤五は五と同一種として数える） */
export const KIND_COUNT = 34;

const SUIT_BASE: Record<Suit, number> = { m: 0, p: 9, s: 18, z: 27 };

/** 牌の種類インデックス（0..33）。赤五は通常の五と同じ種類になる */
export function tileKind(id: TileId): number {
  const suit = id[0] as Suit;
  let rank = Number(id[1]);
  if (rank === 0) rank = 5;
  return SUIT_BASE[suit] + rank - 1;
}

/** 種類インデックス（0..33）から通常牌の ID を返す */
export function kindToId(kind: number): TileId {
  if (!Number.isInteger(kind) || kind < 0 || kind >= KIND_COUNT) {
    throw new Error(`牌種インデックスが不正です: ${kind}`);
  }
  if (kind >= 27) return `z${kind - 27 + 1}` as TileId;
  const suit = NUMBER_SUITS[Math.floor(kind / 9)];
  return `${suit}${(kind % 9) + 1}` as TileId;
}

export function tileSuit(id: TileId): Suit {
  return id[0] as Suit;
}

/** 見た目上のランク（赤五は 5 を返す） */
export function tileRank(id: TileId): number {
  const rank = Number(id[1]);
  return rank === 0 ? 5 : rank;
}

export function isRedFive(id: TileId): boolean {
  return id[1] === "0";
}

const SUIT_ORDER: Record<Suit, number> = { m: 0, p: 1, s: 2, z: 3 };

/** 理牌順のソートキー。萬→筒→索→字、同ランクでは赤五を先に置く */
export function tileSortKey(id: TileId): number {
  return (
    SUIT_ORDER[tileSuit(id)] * 100 + tileRank(id) * 2 + (isRedFive(id) ? 0 : 1)
  );
}

/** 理牌（元配列は変更しない） */
export function sortTiles(tiles: readonly TileId[]): TileId[] {
  return [...tiles].sort((a, b) => tileSortKey(a) - tileSortKey(b));
}

/**
 * MPSZ 表記の手牌文字列をパースする。
 * "m123p456s789z11" / "m1m2m3" のどちらの書き方も受け付ける。
 */
export function parseHand(text: string): TileId[] {
  const tiles: TileId[] = [];
  let matchedLength = 0;
  for (const match of text.matchAll(/([mpsz])(\d+)/g)) {
    matchedLength += match[0].length;
    const suit = match[1] as Suit;
    for (const digit of match[2]) {
      const rank = Number(digit);
      if (suit === "z" && (rank < 1 || rank > 7)) {
        throw new Error(`字牌のランクが不正です: z${digit}`);
      }
      tiles.push(`${suit}${digit}` as TileId);
    }
  }
  if (matchedLength !== text.length) {
    throw new Error(`手牌表記をパースできません: ${text}`);
  }
  return tiles;
}

/** 手牌を MPSZ 表記の文字列にする（同スートの連続をまとめる） */
export function formatHand(tiles: readonly TileId[]): string {
  let result = "";
  let currentSuit: Suit | null = null;
  for (const tile of tiles) {
    const suit = tileSuit(tile);
    if (suit !== currentSuit) {
      result += suit;
      currentSuit = suit;
    }
    result += tile[1];
  }
  return result;
}

/** 34 種それぞれの枚数配列にする（赤五は五として数える） */
export function countsOf(tiles: readonly TileId[]): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0);
  for (const tile of tiles) {
    counts[tileKind(tile)]++;
  }
  return counts;
}

/** ドラ表示牌からドラの種類インデックスを返す（数牌は次位、北→東、中→白） */
export function doraKindFromIndicator(indicator: TileId): number {
  const kind = tileKind(indicator);
  if (kind < 27) {
    const base = Math.floor(kind / 9) * 9;
    return base + ((kind - base + 1) % 9);
  }
  if (kind < 31) return 27 + ((kind - 27 + 1) % 4);
  return 31 + ((kind - 31 + 1) % 3);
}

/**
 * ドラ表示牌の配列に対する tiles 中のドラ枚数を数える。
 * 赤ドラは含まない（呼び出し側で isRedFive を使って別途数える）。
 */
export function countDora(
  tiles: readonly TileId[],
  indicators: readonly TileId[],
): number {
  const doraKinds = indicators.map(doraKindFromIndicator);
  let count = 0;
  for (const tile of tiles) {
    const kind = tileKind(tile);
    for (const doraKind of doraKinds) {
      if (kind === doraKind) count++;
    }
  }
  return count;
}

const NUMBER_NAMES = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const SUIT_NAMES: Record<NumberSuit, string> = { m: "萬", p: "筒", s: "索" };
const HONOR_NAMES = ["東", "南", "西", "北", "白", "發", "中"];

/** 牌の日本語名（aria-label や解説文に使う） */
export function tileName(id: TileId): string {
  const suit = tileSuit(id);
  if (suit === "z") return HONOR_NAMES[Number(id[1]) - 1];
  if (isRedFive(id)) return `赤五${SUIT_NAMES[suit]}`;
  return `${NUMBER_NAMES[tileRank(id) - 1]}${SUIT_NAMES[suit]}`;
}
