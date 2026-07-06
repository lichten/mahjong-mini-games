import { type Rng, shuffled } from "./random";
import { KIND_COUNT, kindToId, type TileId } from "./tile";

export interface WallOptions {
  /** 赤五（m0/p0/s0）を各 1 枚入れるか。既定は true */
  redFives?: boolean;
}

/** 136 枚の山を生成する（シャッフルなし） */
export function createWall(options: WallOptions = {}): TileId[] {
  const { redFives = true } = options;
  const wall: TileId[] = [];
  for (let kind = 0; kind < KIND_COUNT; kind++) {
    const id = kindToId(kind);
    for (let i = 0; i < 4; i++) {
      const isRedSlot = redFives && i === 0 && id[1] === "5" && id[0] !== "z";
      wall.push(isRedSlot ? (`${id[0]}0` as TileId) : id);
    }
  }
  return wall;
}

/** シャッフル済みの山を生成する */
export function createShuffledWall(
  rng: Rng = Math.random,
  options: WallOptions = {},
): TileId[] {
  return shuffled(createWall(options), rng);
}
