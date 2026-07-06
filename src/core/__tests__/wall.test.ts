import { describe, expect, it } from "vitest";
import { mulberry32, shuffled } from "../random";
import { countsOf } from "../tile";
import { createShuffledWall, createWall } from "../wall";

describe("createWall", () => {
  it("136 枚で各種 4 枚ずつある", () => {
    const wall = createWall();
    expect(wall).toHaveLength(136);
    for (const count of countsOf(wall)) {
      expect(count).toBe(4);
    }
  });

  it("赤五が各色 1 枚ずつ入る", () => {
    const wall = createWall();
    expect(wall.filter((t) => t === "m0")).toHaveLength(1);
    expect(wall.filter((t) => t === "p0")).toHaveLength(1);
    expect(wall.filter((t) => t === "s0")).toHaveLength(1);
    expect(wall.filter((t) => t === "m5")).toHaveLength(3);
  });

  it("redFives: false で赤五なしになる", () => {
    const wall = createWall({ redFives: false });
    expect(wall.filter((t) => t[1] === "0")).toHaveLength(0);
    expect(wall.filter((t) => t === "m5")).toHaveLength(4);
  });
});

describe("createShuffledWall / shuffled", () => {
  it("同じシードなら同じ並びになる", () => {
    const a = createShuffledWall(mulberry32(42));
    const b = createShuffledWall(mulberry32(42));
    expect(a).toEqual(b);
  });

  it("シャッフルしても中身は変わらない", () => {
    const wall = createShuffledWall(mulberry32(1));
    expect([...wall].sort()).toEqual([...createWall()].sort());
  });

  it("元配列を破壊しない", () => {
    const original = [1, 2, 3, 4, 5];
    shuffled(original, mulberry32(7));
    expect(original).toEqual([1, 2, 3, 4, 5]);
  });
});
