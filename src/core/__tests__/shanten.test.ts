import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  chiitoitsuShanten,
  discardOptions,
  kokushiShanten,
  shanten,
  ukeire,
} from "../shanten";
import { countsOf, parseHand } from "../tile";
import { createShuffledWall } from "../wall";

const shantenOf = (hand: string) => shanten(parseHand(hand));

describe("shanten: 標準形", () => {
  it("和了形は -1", () => {
    expect(shantenOf("m123456789p123z11")).toBe(-1);
    expect(shantenOf("m112233p44556677")).toBe(-1);
  });

  it("テンパイは 0", () => {
    expect(shantenOf("m123456789p12z11")).toBe(0);
    expect(shantenOf("m123p456s789m45z11")).toBe(0);
    expect(shantenOf("m123p456s789z1122")).toBe(0); // シャンポン待ち
  });

  it("1 シャンテン", () => {
    expect(shantenOf("m123p456s789m4z113")).toBe(1);
    expect(shantenOf("m123p456s78m45z11m9")).toBe(1);
  });

  it("14 枚の手牌も計算できる（テンパイ + 浮き牌）", () => {
    expect(shantenOf("m123p456s789z1122m9")).toBe(0);
  });

  it("バラバラの手", () => {
    // 標準形 8 / 七対子 6 / 国士 7 → 最小 6
    expect(shantenOf("m147p258s369z1234")).toBe(6);
  });

  it("赤五も五として計算される", () => {
    expect(shantenOf("m123p406s789m45z11")).toBe(0);
  });
});

describe("shanten: 七対子", () => {
  it("6 対子 + 単騎はテンパイ", () => {
    expect(shantenOf("m1133557799s11p1")).toBe(0);
  });

  it("7 対子は和了", () => {
    expect(shantenOf("m1133557799s1122")).toBe(-1);
  });

  it("同種 4 枚は 1 対子としてしか数えない", () => {
    // m1111 + 5 対子: 対子 6・種類 6 → 6 - 6 + 1 = 1
    expect(chiitoitsuShanten(countsOf(parseHand("m1111p2233445566")))).toBe(1);
  });
});

describe("shanten: 国士無双", () => {
  it("13 種すべてあれば 13 面待ちテンパイ", () => {
    expect(shantenOf("m19p19s19z1234567")).toBe(0);
  });

  it("12 種 + 対子もテンパイ", () => {
    expect(shantenOf("m1199p19s19z123456")).toBe(0);
  });

  it("13 種 + 対子で和了", () => {
    expect(shantenOf("m119p19s19z1234567")).toBe(-1);
  });

  it("么九牌以外は数えない", () => {
    expect(kokushiShanten(countsOf(parseHand("m2345678p234567")))).toBe(13);
  });
});

describe("shanten: 入力チェック", () => {
  it("13/14 枚以外はエラー", () => {
    expect(() => shantenOf("m123")).toThrow();
  });
});

describe("ukeire", () => {
  it("両面待ちの有効牌と残り枚数", () => {
    const result = ukeire(parseHand("m123p456s789m45z11"));
    expect(result.shanten).toBe(0);
    expect(result.tiles.map((t) => t.id)).toEqual(["m3", "m6"]);
    // m3 は手牌に 1 枚あるので残り 3、m6 は 4
    expect(result.tiles.map((t) => t.count)).toEqual([3, 4]);
    expect(result.total).toBe(7);
  });

  it("1 シャンテンの有効牌", () => {
    const result = ukeire(parseHand("m123p456s78m45z11m9"));
    expect(result.shanten).toBe(1);
    expect(result.tiles.map((t) => t.id)).toEqual(["m3", "m6", "s6", "s9"]);
    expect(result.total).toBe(15);
  });
});

describe("discardOptions", () => {
  it("明確な不要牌が best になる", () => {
    const options = discardOptions(parseHand("m123p456s789m45z113"));
    const best = options.filter((o) => o.best);
    expect(best.map((o) => o.tile)).toEqual(["z3"]);
    expect(best[0].shanten).toBe(0);
    expect(best[0].total).toBe(7);
  });

  it("ランダムな 14 枚でも安定して計算できる", () => {
    const rng = mulberry32(2026);
    for (let i = 0; i < 20; i++) {
      const wall = createShuffledWall(rng);
      const options = discardOptions(wall.slice(0, 14));
      expect(options.length).toBeGreaterThan(0);
      expect(options.some((o) => o.best)).toBe(true);
      // ソート順: シャンテン昇順 → 受け入れ降順
      for (let j = 1; j < options.length; j++) {
        const prev = options[j - 1];
        const cur = options[j];
        expect(
          prev.shanten < cur.shanten ||
            (prev.shanten === cur.shanten && prev.total >= cur.total),
        ).toBe(true);
      }
    }
  });
});
