import {
  countsOf,
  createShuffledWall,
  isKokushiCounts,
  kokushiShanten,
  sortTiles,
} from "../../core";
import { SoloPlay } from "../shared/SoloPlay";

const MAX_DRAWS = 30;

export default function KokushiChallenge() {
  return (
    <SoloPlay
      deal={() => {
        const wall = createShuffledWall(Math.random, { redFives: false });
        return { hand: sortTiles(wall.slice(0, 13)), wall: wall.slice(13) };
      }}
      maxDraws={MAX_DRAWS}
      canWin={(hand14) => isKokushiCounts(countsOf(hand14))}
      statusLine={(hand) => {
        const s = kokushiShanten(countsOf(hand));
        return s === 0 ? "国士無双テンパイ!" : `国士無双まで ${s} シャンテン`;
      }}
      loseMessage="流局… 国士無双は遠かった"
    />
  );
}
