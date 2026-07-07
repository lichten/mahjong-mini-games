import {
  countsOf,
  createShuffledWall,
  type Rng,
  sortTiles,
  type TileId,
} from "../../core";
// 安全度ロジックは四人打ち麻雀の CPU と共用するため shared に昇格した
import { type SafetyLevel, safetyLevel } from "../shared/safety";

export { SAFETY_LABELS, type SafetyLevel, safetyLevel } from "../shared/safety";

export interface BetaoriQuestion {
  /** 自分の手牌（14 枚・理牌済み） */
  hand: TileId[];
  /** 相手（立直者）の捨て牌 */
  river: TileId[];
  /** 手牌それぞれの安全度 */
  levels: SafetyLevel[];
  /** 最も安全なレベル */
  bestLevel: SafetyLevel;
}

/** ベタオリ問題を 1 問生成する */
export function generateQuestion(rng: Rng = Math.random): BetaoriQuestion {
  const wall = createShuffledWall(rng, { redFives: false });
  const riverSize = 7 + Math.floor(rng() * 4); // 7〜10 枚
  const river = wall.slice(0, riverSize);
  const hand = sortTiles(wall.slice(riverSize, riverSize + 14));

  const riverCounts = countsOf(river);
  const handCounts = countsOf(hand);
  const levels = hand.map((tile) => safetyLevel(tile, riverCounts, handCounts));
  const bestLevel = Math.min(...levels) as SafetyLevel;
  return { hand, river, levels, bestLevel };
}
