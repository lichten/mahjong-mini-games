import { describe, expect, it } from "vitest";
import {
  countsOf,
  formatHand,
  KIND_COUNT,
  kindToId,
  parseHand,
  sortTiles,
  tileKind,
  tileName,
} from "../tile";

describe("parseHand", () => {
  it("まとめ書き (m123) をパースできる", () => {
    expect(parseHand("m123p456s789z1122")).toEqual([
      "m1",
      "m2",
      "m3",
      "p4",
      "p5",
      "p6",
      "s7",
      "s8",
      "s9",
      "z1",
      "z1",
      "z2",
      "z2",
    ]);
  });

  it("個別書き (m1m2m3) も同じ結果になる", () => {
    expect(parseHand("m1m2m3")).toEqual(parseHand("m123"));
  });

  it("赤五 (m0) をパースできる", () => {
    expect(parseHand("m05")).toEqual(["m0", "m5"]);
  });

  it("不正な表記はエラーになる", () => {
    expect(() => parseHand("z8")).toThrow();
    expect(() => parseHand("x123")).toThrow();
    expect(() => parseHand("m12 p3")).toThrow();
  });
});

describe("tileKind / kindToId", () => {
  it("0..33 の全種で往復できる", () => {
    for (let kind = 0; kind < KIND_COUNT; kind++) {
      expect(tileKind(kindToId(kind))).toBe(kind);
    }
  });

  it("赤五は通常の五と同じ種類になる", () => {
    expect(tileKind("m0")).toBe(tileKind("m5"));
    expect(tileKind("p0")).toBe(tileKind("p5"));
    expect(tileKind("s0")).toBe(tileKind("s5"));
  });
});

describe("sortTiles / formatHand", () => {
  it("萬→筒→索→字の順に理牌される", () => {
    const sorted = sortTiles(parseHand("z1s9p1m9m1"));
    expect(formatHand(sorted)).toBe("m19p1s9z1");
  });

  it("赤五は五の位置に並ぶ", () => {
    const sorted = sortTiles(parseHand("m946m0"));
    expect(sorted).toEqual(["m4", "m0", "m6", "m9"]);
  });
});

describe("countsOf", () => {
  it("34 種の枚数を数え、赤五は五として数える", () => {
    const counts = countsOf(parseHand("m05z77"));
    expect(counts[tileKind("m5")]).toBe(2);
    expect(counts[tileKind("z7")]).toBe(2);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(4);
  });
});

describe("tileName", () => {
  it("日本語の牌名を返す", () => {
    expect(tileName("m1")).toBe("一萬");
    expect(tileName("p9")).toBe("九筒");
    expect(tileName("s0")).toBe("赤五索");
    expect(tileName("z1")).toBe("東");
    expect(tileName("z7")).toBe("中");
  });
});
