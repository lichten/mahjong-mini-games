import { describe, expect, it } from "vitest";
import {
  decompose,
  isChiitoitsuCounts,
  isKokushiCounts,
  winningTiles,
} from "../agari";
import { countsOf, parseHand } from "../tile";

describe("winningTiles", () => {
  it("嵌張・両面などの待ちを列挙する", () => {
    expect(winningTiles(parseHand("m123456789p12z11"))).toEqual(["p3"]);
    expect(winningTiles(parseHand("m123p456s789m45z11"))).toEqual(["m3", "m6"]);
  });

  it("シャンポン待ち", () => {
    expect(winningTiles(parseHand("m123p456s789z1122"))).toEqual(["z1", "z2"]);
  });

  it("国士無双 13 面待ち", () => {
    expect(winningTiles(parseHand("m19p19s19z1234567"))).toHaveLength(13);
  });

  it("多面待ち（清一色）", () => {
    // m1112345678999 は九蓮宝燈形: 全 9 種待ち
    expect(winningTiles(parseHand("m1112345678999"))).toHaveLength(9);
  });

  it("ノーテンなら空", () => {
    expect(winningTiles(parseHand("m147p258s369z1234"))).toEqual([]);
  });
});

describe("decompose", () => {
  it("複数の分解を列挙する（三連刻 = 3 順子にもなる形）", () => {
    const results = decompose(countsOf(parseHand("m111222333p999z11")));
    expect(results).toHaveLength(2);
    const types = results.map((r) => r.melds.map((m) => m.type).join(","));
    expect(types).toContain("triplet,triplet,triplet,triplet");
    expect(types).toContain("run,run,run,triplet");
  });

  it("七対子のみの形は標準分解できない", () => {
    expect(decompose(countsOf(parseHand("m1133p5577s99z2244")))).toHaveLength(
      0,
    );
  });
});

describe("isChiitoitsuCounts / isKokushiCounts", () => {
  it("七対子（4 枚使いは不可）", () => {
    expect(isChiitoitsuCounts(countsOf(parseHand("m1133p5577s99z2244")))).toBe(
      true,
    );
    expect(isChiitoitsuCounts(countsOf(parseHand("m11113355p77s99z22")))).toBe(
      false,
    );
  });

  it("国士無双", () => {
    expect(isKokushiCounts(countsOf(parseHand("m119p19s19z1234567")))).toBe(
      true,
    );
    expect(isKokushiCounts(countsOf(parseHand("m129p19s19z1234567")))).toBe(
      false,
    );
  });
});
