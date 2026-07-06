import {
  countsOf,
  createShuffledWall,
  isWinningCounts,
  shantenFromCounts,
  sortTiles,
} from "../../core";
import { SoloPlay } from "../shared/SoloPlay";

const MAX_DRAWS = 18;

export default function SoloMahjong() {
  return (
    <SoloPlay
      deal={() => {
        const wall = createShuffledWall();
        return { hand: sortTiles(wall.slice(0, 13)), wall: wall.slice(13) };
      }}
      maxDraws={MAX_DRAWS}
      canWin={(hand14) => isWinningCounts(countsOf(hand14))}
      statusLine={(hand) => {
        const s = shantenFromCounts(countsOf(hand));
        return s === 0
          ? "テンパイ! 少ない巡目での和了を目指そう"
          : `${s} シャンテン`;
      }}
      loseMessage="流局… 18 巡以内の和了を目指そう"
    />
  );
}
