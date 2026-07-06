import { describe, expect, it } from "vitest";
import { parseHand } from "../tile";
import { evaluateHand, type WinContext } from "../yaku";

function evalHand(hand: string, ctx: WinContext) {
  return evaluateHand(parseHand(hand), ctx);
}

function names(result: { yaku: { name: string }[] }): string[] {
  return result.yaku.map((y) => y.name);
}

describe("evaluateHand: 基本役", () => {
  it("平和ツモは 20 符 2 翻", () => {
    const r = evalHand("m234567p23488s789", { winTile: "m7", tsumo: true });
    expect(names(r)).toEqual(expect.arrayContaining(["平和", "門前清自摸和"]));
    expect(r.han).toBe(2);
    expect(r.fu).toBe(20);
  });

  it("タンヤオ + 平和のロンは 30 符", () => {
    const r = evalHand("m234p34588s345678", { winTile: "s6", tsumo: false });
    expect(names(r)).toEqual(expect.arrayContaining(["断幺九", "平和"]));
    expect(r.han).toBe(2);
    expect(r.fu).toBe(30);
  });

  it("役なしロンは 0 翻（単騎で平和不成立、符は 40）", () => {
    const r = evalHand("m234p345s345678z33", { winTile: "z3", tsumo: false });
    expect(r.han).toBe(0);
    expect(r.yaku).toEqual([]);
    expect(r.fu).toBe(40); // 20 + 門前ロン 10 + 単騎 2 → 切り上げ
  });

  it("役牌 白（暗刻 8 符込みで 40 符）", () => {
    const r = evalHand("m234p345s34588z555", { winTile: "m2", tsumo: false });
    expect(names(r)).toContain("役牌 白");
    expect(r.han).toBe(1);
    expect(r.fu).toBe(40); // 20 + ロン 10 + 白暗刻 8 = 38 → 40
  });

  it("七対子ツモは 25 符 3 翻", () => {
    const r = evalHand("m1133p5577s99z2244", { winTile: "m1", tsumo: true });
    expect(names(r)).toEqual(
      expect.arrayContaining(["七対子", "門前清自摸和"]),
    );
    expect(r.han).toBe(3);
    expect(r.fu).toBe(25);
  });

  it("三色同順", () => {
    const r = evalHand("m234p234s234m567z22", { winTile: "s2", tsumo: false });
    expect(names(r)).toContain("三色同順");
  });

  it("対々和 + 三暗刻（ロンで完成した刻子は明刻扱い）", () => {
    const r = evalHand("m11199p222s333z444", { winTile: "z4", tsumo: false });
    expect(names(r)).toEqual(expect.arrayContaining(["対々和", "三暗刻"]));
    expect(r.han).toBe(4);
    // 20 + ロン 10 + m111 暗 8 + p222 暗 4 + s333 暗 4 + z444 明 4 = 50
    expect(r.fu).toBe(50);
  });

  it("清一色 + 二盃口 + 平和 + ツモ = 11 翻", () => {
    const r = evalHand("m11223344556677", { winTile: "m7", tsumo: true });
    expect(names(r)).toEqual(
      expect.arrayContaining(["清一色", "二盃口", "平和", "門前清自摸和"]),
    );
    expect(r.han).toBe(11);
  });

  it("ドラは役がある場合のみ加算される", () => {
    const withYaku = evalHand("m234p34588s345678", {
      winTile: "s6",
      tsumo: false,
      doraCount: 2,
    });
    expect(withYaku.han).toBe(4);
    expect(names(withYaku)).toContain("ドラ");

    const noYaku = evalHand("m234p345s345678z33", {
      winTile: "z3",
      tsumo: false,
      doraCount: 2,
    });
    expect(noYaku.han).toBe(0);
  });

  it("自風・場風", () => {
    // 東場・東家で東の刻子はダブ東
    const r = evalHand("m234p345s34588z111", {
      winTile: "m2",
      tsumo: false,
      seatWind: 1,
      roundWind: 1,
    });
    expect(names(r)).toEqual(expect.arrayContaining(["自風 東", "場風 東"]));
    expect(r.han).toBe(2);
  });
});

describe("evaluateHand: 役満", () => {
  it("国士無双", () => {
    const r = evalHand("m119p19s19z1234567", { winTile: "m1", tsumo: true });
    expect(r.yakuman).toBe(1);
    expect(names(r)).toEqual(["国士無双"]);
  });

  it("四暗刻（単騎ロンは成立）", () => {
    const r = evalHand("m11199p222s333z444", { winTile: "m9", tsumo: false });
    expect(r.yakuman).toBe(1);
    expect(names(r)).toEqual(["四暗刻"]);
  });

  it("大三元", () => {
    const r = evalHand("z555666777m123p99", { winTile: "m1", tsumo: false });
    expect(r.yakuman).toBe(1);
    expect(names(r)).toEqual(["大三元"]);
  });

  it("九蓮宝燈", () => {
    const r = evalHand("m11123456789995", { winTile: "m5", tsumo: true });
    expect(r.yakuman).toBe(1);
    expect(names(r)).toEqual(["九蓮宝燈"]);
  });

  it("字一色 + 大四喜 + 四暗刻の複合役満", () => {
    const r = evalHand("z111222333444z55", { winTile: "z5", tsumo: true });
    expect(r.yakuman).toBe(3);
    expect(names(r)).toEqual(
      expect.arrayContaining(["字一色", "大四喜", "四暗刻"]),
    );
  });
});
