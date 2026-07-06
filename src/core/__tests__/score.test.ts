import { describe, expect, it } from "vitest";
import { calcScore, scoreHand } from "../score";
import { parseHand } from "../tile";

describe("calcScore: 点数表の代表例", () => {
  it("20 符 2 翻 子ツモ = 400/700", () => {
    const r = calcScore(2, 20, { dealer: false, tsumo: true });
    expect(r.payments).toBe("400/700");
    expect(r.total).toBe(1500);
  });

  it("30 符 1 翻 子ロン = 1000", () => {
    expect(calcScore(1, 30, { dealer: false, tsumo: false }).total).toBe(1000);
  });

  it("25 符 2 翻 子ロン = 1600（七対子）", () => {
    expect(calcScore(2, 25, { dealer: false, tsumo: false }).total).toBe(1600);
  });

  it("60 符 3 翻 親ロン = 11600", () => {
    expect(calcScore(3, 60, { dealer: true, tsumo: false }).total).toBe(11600);
  });

  it("40 符 4 翻は切り上げで満貫 8000", () => {
    const r = calcScore(4, 40, { dealer: false, tsumo: false });
    expect(r.rank).toBe("満貫");
    expect(r.total).toBe(8000);
  });

  it("6 翻は跳満（親 18000）", () => {
    const r = calcScore(6, 30, { dealer: true, tsumo: false });
    expect(r.rank).toBe("跳満");
    expect(r.total).toBe(18000);
  });

  it("11 翻は三倍満（子 24000）", () => {
    const r = calcScore(11, 20, { dealer: false, tsumo: false });
    expect(r.rank).toBe("三倍満");
    expect(r.total).toBe(24000);
  });

  it("役満: 子ロン 32000 / 親ツモ 16000 オール", () => {
    expect(
      calcScore(0, 0, { dealer: false, tsumo: false, yakuman: 1 }).total,
    ).toBe(32000);
    const oya = calcScore(0, 0, { dealer: true, tsumo: true, yakuman: 1 });
    expect(oya.payments).toBe("16000オール");
    expect(oya.total).toBe(48000);
  });
});

describe("scoreHand: 役判定と点数の統合", () => {
  it("平和ツモ（子）は 20 符 2 翻 400/700", () => {
    const r = scoreHand(parseHand("m234567p23488s789"), {
      winTile: "m7",
      tsumo: true,
      dealer: false,
    });
    expect(r.han).toBe(2);
    expect(r.fu).toBe(20);
    expect(r.score.payments).toBe("400/700");
  });

  it("役なしは 0 点扱いにできる（han 0）", () => {
    const r = scoreHand(parseHand("m234p345s345678z33"), {
      winTile: "z3",
      tsumo: false,
    });
    expect(r.han).toBe(0);
  });

  it("国士無双（子ロン）は 32000", () => {
    const r = scoreHand(parseHand("m119p19s19z1234567"), {
      winTile: "m1",
      tsumo: false,
    });
    expect(r.yakuman).toBe(1);
    expect(r.score.total).toBe(32000);
  });
});
