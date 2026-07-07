import { describe, expect, it } from "vitest";
import { decomposeConcealed } from "../agari";
import {
  isKanMeld,
  isOpenMeld,
  type MeldCall,
  meldKind,
  toAgariMeld,
} from "../meld";
import { mulberry32 } from "../random";
import { shanten, shantenWithMelds, waitKindsWithMelds } from "../shanten";
import { countDora, countsOf, parseHand, tileKind } from "../tile";
import { createShuffledWall } from "../wall";

const chi = (tiles: string): MeldCall => ({
  type: "chi",
  tiles: parseHand(tiles),
  calledTile: parseHand(tiles)[0],
  from: 3,
});

const ankan = (tiles: string): MeldCall => ({
  type: "ankan",
  tiles: parseHand(tiles),
  calledTile: null,
  from: null,
});

describe("meld: ユーティリティ", () => {
  it("meldKind はチーの最小牌を返す", () => {
    expect(meldKind(chi("m312"))).toBe(0);
    expect(meldKind(chi("s789"))).toBe(24);
  });

  it("赤五を含む副露でも牌種は五として扱う", () => {
    const pon: MeldCall = {
      type: "pon",
      tiles: parseHand("m0m5m5"),
      calledTile: "m5",
      from: 1,
    };
    expect(meldKind(pon)).toBe(tileKind("m5"));
  });

  it("暗槓のみ門前扱い", () => {
    expect(isOpenMeld(ankan("z5555"))).toBe(false);
    expect(isOpenMeld(chi("m123"))).toBe(true);
  });

  it("isKanMeld はカン 3 種で true", () => {
    expect(isKanMeld(ankan("z5555"))).toBe(true);
    expect(isKanMeld(chi("m123"))).toBe(false);
    expect(
      isKanMeld({
        type: "kakan",
        tiles: parseHand("p1111"),
        calledTile: "p1",
        from: 2,
      }),
    ).toBe(true);
  });

  it("toAgariMeld はチーを順子、それ以外を刻子に変換する", () => {
    expect(toAgariMeld(chi("m123"))).toEqual({ type: "run", kind: 0 });
    expect(toAgariMeld(ankan("z5555"))).toEqual({ type: "triplet", kind: 31 });
  });
});

describe("countDora", () => {
  it("表示牌の次位がドラになる", () => {
    expect(countDora(parseHand("m2m2p5"), ["m1"])).toBe(2);
  });

  it("字牌は北→東、中→白に循環する", () => {
    expect(countDora(parseHand("z1z1"), ["z4"])).toBe(2);
    expect(countDora(parseHand("z5"), ["z7"])).toBe(1);
    expect(countDora(parseHand("m1"), ["m9"])).toBe(1);
  });

  it("表示牌が複数あれば重複して数える", () => {
    expect(countDora(parseHand("m2"), ["m1", "m1"])).toBe(2);
  });

  it("赤五はドラとして数えない（別カウント）", () => {
    expect(countDora(parseHand("m0"), ["p1"])).toBe(0);
    // ただし五がドラなら赤五も種類としては一致する
    expect(countDora(parseHand("m0"), ["m4"])).toBe(1);
  });
});

describe("decomposeConcealed", () => {
  it("副露 2 組なら 8 枚を 2 面子 1 雀頭に分解する", () => {
    const result = decomposeConcealed(countsOf(parseHand("m123m456p11")), 2);
    expect(result).toEqual([
      {
        pair: 9,
        melds: [
          { type: "run", kind: 0 },
          { type: "run", kind: 3 },
        ],
      },
    ]);
  });

  it("副露 4 組なら雀頭のみ", () => {
    const result = decomposeConcealed(countsOf(parseHand("p99")), 4);
    expect(result).toEqual([{ pair: tileKind("p9"), melds: [] }]);
  });

  it("枚数が合わなければエラー", () => {
    expect(() =>
      decomposeConcealed(countsOf(parseHand("m123m456p11")), 1),
    ).toThrow();
  });
});

describe("shantenWithMelds", () => {
  it("副露 0 組は既存 shanten と一致する（ランダム 1000 手）", () => {
    const rng = mulberry32(20260707);
    for (let i = 0; i < 1000; i++) {
      const wall = createShuffledWall(rng, { redFives: false });
      const hand = wall.slice(0, 13);
      expect(shantenWithMelds(hand, 0)).toBe(shanten(hand));
    }
  });

  it("副露ありの既知ケース", () => {
    // チー 1 組 + m123 + 両面 2 つ + 雀頭 + 浮き牌 → 1 シャンテン
    expect(shantenWithMelds(parseHand("m123m45p11s78z3"), 1)).toBe(1);
    // 面子が 1 つ増えるとテンパイ
    expect(shantenWithMelds(parseHand("m123m456p11s78"), 1)).toBe(0);
    // 和了形
    expect(shantenWithMelds(parseHand("m123m456p11s678"), 1)).toBe(-1);
  });

  it("副露 4 組は単騎待ち（テンパイ）と和了", () => {
    expect(shantenWithMelds(parseHand("p1"), 4)).toBe(0);
    expect(shantenWithMelds(parseHand("p11"), 4)).toBe(-1);
  });

  it("副露があると七対子は考慮されない", () => {
    // 対子 4 つ + 副露 1 組: 標準形として評価される
    const concealed = parseHand("m11p22s33z44m5s9");
    expect(concealed).toHaveLength(10);
    expect(shantenWithMelds(concealed, 1)).toBe(2);
  });

  it("枚数が合わなければエラー", () => {
    expect(() => shantenWithMelds(parseHand("m123"), 1)).toThrow();
  });
});

describe("waitKindsWithMelds", () => {
  it("副露 1 組のテンパイ形の待ち", () => {
    const waits = waitKindsWithMelds(parseHand("m123m456p11s78"), 1);
    expect(waits).toEqual([tileKind("s6"), tileKind("s9")]);
  });

  it("副露 4 組は単騎待ち", () => {
    expect(waitKindsWithMelds(parseHand("z7"), 4)).toEqual([tileKind("z7")]);
  });

  it("ノーテンなら空配列", () => {
    expect(waitKindsWithMelds(parseHand("m19p19s19z1234"), 1)).toEqual([]);
  });

  it("副露 0 組は国士・七対子の待ちも拾う", () => {
    const kokushi = parseHand("m19p19s19z1234567");
    expect(waitKindsWithMelds(kokushi, 0)).toHaveLength(13);
  });
});
