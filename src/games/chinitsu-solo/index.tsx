import {
  countsOf,
  createWall,
  isWinningCounts,
  NUMBER_SUITS,
  randomInt,
  shantenFromCounts,
  shuffled,
  sortTiles,
  type TileId,
  tileSuit,
} from "../../core";
import { SoloPlay } from "../shared/SoloPlay";

const MAX_DRAWS = 20;

/** 配牌を清一色寄り（1 色 10 枚 + その他 3 枚）に調整して配る */
function biasedDeal() {
  const suit = NUMBER_SUITS[randomInt(3)];
  const wall = shuffled(createWall());
  const suitTiles: TileId[] = [];
  const others: TileId[] = [];
  for (const tile of wall) {
    (tileSuit(tile) === suit ? suitTiles : others).push(tile);
  }
  const hand = sortTiles([...suitTiles.slice(0, 10), ...others.slice(0, 3)]);
  const rest = shuffled([...suitTiles.slice(10), ...others.slice(3)]);
  return { hand, wall: rest };
}

/** 清一色（字牌なし・1 色のみ）の和了形か */
function isChinitsuWin(hand14: readonly TileId[]): boolean {
  const suits = new Set(hand14.map((t) => tileSuit(t)));
  if (suits.size !== 1 || suits.has("z")) return false;
  return isWinningCounts(countsOf(hand14));
}

export default function ChinitsuSolo() {
  return (
    <SoloPlay
      deal={biasedDeal}
      maxDraws={MAX_DRAWS}
      canWin={isChinitsuWin}
      statusLine={(hand) => {
        // 最も枚数の多いスートを主色として、混ざっている牌数を出す
        const bySuit = new Map<string, number>();
        for (const tile of hand) {
          bySuit.set(tileSuit(tile), (bySuit.get(tileSuit(tile)) ?? 0) + 1);
        }
        const main = [...bySuit.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const offSuit = hand.filter((tile) => tileSuit(tile) !== main).length;
        const s = shantenFromCounts(countsOf(hand));
        const shantenText = s === 0 ? "テンパイ" : `${s} シャンテン`;
        const mixText = offSuit > 0 ? `色違い ${offSuit} 枚・` : "";
        return `${mixText}${shantenText}（清一色のみ和了できます）`;
      }}
      loseMessage="流局… 清一色は完成しなかった"
    />
  );
}
