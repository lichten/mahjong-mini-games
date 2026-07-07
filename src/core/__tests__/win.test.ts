import { describe, expect, it } from "vitest";
import { randomCompleteHand } from "../generate";
import type { MeldCall } from "../meld";
import { mulberry32 } from "../random";
import { parseHand, type TileId } from "../tile";
import { evaluateWin, type WinSituation } from "../win";
import { evaluateHand, type HandValue } from "../yaku";

const sit = (over: Partial<WinSituation> = {}): WinSituation => ({
  seatWind: 2,
  roundWind: 1,
  doraIndicators: [],
  ...over,
});

const names = (result: HandValue) => result.yaku.map((y) => y.name);

const hanOf = (result: HandValue, name: string) =>
  result.yaku.find((y) => y.name === name)?.han;

const chi = (tiles: string, from: 0 | 1 | 2 | 3 = 3): MeldCall => {
  const t = parseHand(tiles);
  return { type: "chi", tiles: t, calledTile: t[0], from };
};

const pon = (tiles: string, from: 0 | 1 | 2 | 3 = 1): MeldCall => {
  const t = parseHand(tiles);
  return { type: "pon", tiles: t, calledTile: t[0], from };
};

const minkan = (tiles: string, from: 0 | 1 | 2 | 3 = 2): MeldCall => {
  const t = parseHand(tiles);
  return { type: "minkan", tiles: t, calledTile: t[0], from };
};

const ankan = (tiles: string): MeldCall => ({
  type: "ankan",
  tiles: parseHand(tiles),
  calledTile: null,
  from: null,
});

describe("evaluateWin: 門前一致性", () => {
  it("副露なしの手は evaluateHand と役・翻・符が一致する（ランダム 1000 手）", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const tiles = randomCompleteHand(rng);
      const winTile = tiles[i % 14];
      const tsumo = i % 2 === 0;
      const expected = evaluateHand(tiles, { winTile, tsumo });
      const actual = evaluateWin(
        { concealed: tiles, melds: [], winTile, tsumo },
        sit(),
      );
      expect(actual.han).toBe(expected.han);
      expect(actual.fu).toBe(expected.fu);
      expect(actual.yakuman).toBe(expected.yakuman);
      expect([...names(actual)].sort()).toEqual([...names(expected)].sort());
    }
  });
});

describe("evaluateWin: 食い下がり", () => {
  it("副露した混一色は 2 翻（一気通貫は 1 翻）", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("m456m789z11z333"),
        melds: [chi("m123")],
        winTile: "m4",
        tsumo: false,
      },
      sit(),
    );
    expect(hanOf(r, "混一色")).toBe(2);
    expect(hanOf(r, "一気通貫")).toBe(1);
    expect(r.han).toBe(3);
    expect(r.fu).toBe(30); // 20 + z333 暗刻 8 + 場風雀頭 2
  });

  it("副露した清一色は 5 翻", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("s234s456s789s99"),
        melds: [chi("s123")],
        winTile: "s2",
        tsumo: false,
      },
      sit(),
    );
    expect(hanOf(r, "清一色")).toBe(5);
    expect(hanOf(r, "一気通貫")).toBe(1);
    // 順子のみ・非役牌雀頭・両面ロンの喰い平和形は 30 符
    expect(r.fu).toBe(30);
  });

  it("副露した三色同順は 1 翻", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("m77p234s234s567"),
        melds: [chi("m234")],
        winTile: "s5",
        tsumo: false,
      },
      sit(),
    );
    expect(hanOf(r, "三色同順")).toBe(1);
    expect(hanOf(r, "断幺九")).toBe(1);
    expect(r.fu).toBe(30);
  });

  it("副露した混全帯幺九は 1 翻・純全帯幺九は 2 翻", () => {
    const chanta = evaluateWin(
      {
        concealed: parseHand("m789p111s789z22"),
        melds: [chi("m123")],
        winTile: "m7",
        tsumo: false,
      },
      sit({ seatWind: 3 }),
    );
    expect(hanOf(chanta, "混全帯幺九")).toBe(1);

    const junchan = evaluateWin(
      {
        concealed: parseHand("m789p123p11s999"),
        melds: [chi("m123")],
        winTile: "m7",
        tsumo: false,
      },
      sit(),
    );
    expect(hanOf(junchan, "純全帯幺九")).toBe(2);
  });
});

describe("evaluateWin: 門前限定役の除外", () => {
  it("副露手は平和がつかず、役なしなら 0 翻（ドラも無効）", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("p345s22s456s678"),
        melds: [chi("m123")],
        winTile: "p3",
        tsumo: false,
      },
      sit({ doraIndicators: ["p2"] }),
    );
    expect(r.han).toBe(0);
    expect(r.yaku).toEqual([]);
    expect(r.fu).toBe(30); // 喰い平和形の切り上げ
  });

  it("副露手は一盃口がつかない", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("m234m234m888p55"),
        melds: [chi("s678")],
        winTile: "m3",
        tsumo: false,
      },
      sit(),
    );
    expect(names(r)).not.toContain("一盃口");
    expect(r.han).toBe(1); // 断幺九のみ
    expect(r.fu).toBe(30); // 20 + 嵌張 2 + m888 暗刻 4 = 26 → 30
  });

  it("暗槓のみの手は門前扱い（門前清自摸和が成立、門前ロン加符あり）", () => {
    const input = {
      concealed: parseHand("m234m567p33p678"),
      melds: [ankan("z5555")],
      winTile: "m5" as TileId,
    };
    const ron = evaluateWin({ ...input, tsumo: false }, sit());
    expect(names(ron)).toContain("役牌 白");
    expect(ron.han).toBe(1);
    expect(ron.fu).toBe(70); // 20 + 門前ロン 10 + 幺九暗槓 32 = 62 → 70

    const tsumo = evaluateWin({ ...input, tsumo: true }, sit());
    expect(names(tsumo)).toContain("門前清自摸和");
    expect(tsumo.han).toBe(2);
    expect(tsumo.fu).toBe(60); // 20 + ツモ 2 + 幺九暗槓 32 = 54 → 60
  });
});

describe("evaluateWin: 符計算", () => {
  it("明槓は 8/16 符", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("m234p567s44s567"),
        melds: [minkan("m1111")],
        winTile: "s5",
        tsumo: false,
      },
      sit(),
    );
    expect(r.han).toBe(0);
    expect(r.fu).toBe(40); // 20 + 幺九明槓 16 = 36 → 40
  });

  it("ポンは 2/4 符", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("m234p567s44s567"),
        melds: [pon("z111")],
        winTile: "s5",
        tsumo: false,
      },
      sit({ seatWind: 3 }),
    );
    expect(hanOf(r, "場風 東")).toBe(1);
    expect(r.fu).toBe(30); // 20 + 幺九明刻 4 = 24 → 30
  });
});

describe("evaluateWin: 状況役", () => {
  const menzenHand = {
    concealed: parseHand("m234m567p22p678s345"),
    melds: [] as MeldCall[],
    winTile: "s3" as TileId,
  };

  it("嶺上開花", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("m234m567p88s234"),
        melds: [ankan("p2222")],
        winTile: "m4",
        tsumo: true,
      },
      sit({ rinshan: true }),
    );
    expect(names(r)).toEqual(
      expect.arrayContaining(["嶺上開花", "門前清自摸和", "断幺九"]),
    );
    expect(r.han).toBe(3);
  });

  it("海底摸月はツモ時のみ・河底撈魚と搶槓はロン時のみ", () => {
    const haitei = evaluateWin(
      { ...menzenHand, tsumo: true },
      sit({ haitei: true }),
    );
    expect(names(haitei)).toContain("海底摸月");

    const houtei = evaluateWin(
      { ...menzenHand, tsumo: false },
      sit({ houtei: true }),
    );
    expect(names(houtei)).toContain("河底撈魚");
    expect(names(houtei)).not.toContain("海底摸月");

    const chankan = evaluateWin(
      { ...menzenHand, tsumo: false },
      sit({ chankan: true }),
    );
    expect(names(chankan)).toContain("搶槓");
  });

  it("ダブル立直 + 一発 + 裏ドラ", () => {
    const r = evaluateWin(
      { ...menzenHand, tsumo: true },
      sit({ doubleRiichi: true, ippatsu: true, uraIndicators: ["p1"] }),
    );
    expect(hanOf(r, "ダブル立直")).toBe(2);
    expect(hanOf(r, "一発")).toBe(1);
    expect(hanOf(r, "裏ドラ")).toBe(2); // p2 が 2 枚
    expect(names(r)).not.toContain("立直");
    expect(r.han).toBe(8); // W立直2 + 一発1 + ツモ1 + 平和1 + 断幺九1 + 裏2
    expect(r.fu).toBe(20);
  });

  it("天和は役満として複合する", () => {
    const r = evaluateWin(
      { ...menzenHand, tsumo: true },
      sit({ tenhou: true }),
    );
    expect(r.yakuman).toBe(1);
    expect(names(r)).toEqual(["天和"]);
  });
});

describe("evaluateWin: ドラ計上", () => {
  it("カンの 4 枚すべてと赤ドラを数える", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("m234p234s22z555"),
        melds: [
          {
            type: "minkan",
            tiles: ["m5", "m5", "m5", "m0"],
            calledTile: "m5",
            from: 2,
          },
        ],
        winTile: "m2",
        tsumo: false,
      },
      sit({ doraIndicators: ["m4"] }),
    );
    expect(hanOf(r, "役牌 白")).toBe(1);
    expect(hanOf(r, "ドラ")).toBe(4); // 明槓 m5 の 4 枚（赤含む）
    expect(hanOf(r, "赤ドラ")).toBe(1);
    expect(r.han).toBe(6);
  });

  it("立直していなければ裏ドラは数えない", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("m234m567p22p678s345"),
        melds: [],
        winTile: "s3",
        tsumo: true,
      },
      sit({ uraIndicators: ["p1"] }),
    );
    expect(names(r)).not.toContain("裏ドラ");
  });
});

describe("evaluateWin: 暗刻系・特殊形", () => {
  const suuankouInput = {
    concealed: parseHand("m111m22p333s555"),
    melds: [ankan("z7777")],
    winTile: "m1" as TileId,
  };

  it("暗槓は暗刻として四暗刻に数える（ツモ）", () => {
    const r = evaluateWin({ ...suuankouInput, tsumo: true }, sit());
    expect(r.yakuman).toBe(1);
    expect(names(r)).toEqual(["四暗刻"]);
  });

  it("ロンで完成した刻子は明刻扱いで三暗刻に落ちる", () => {
    const r = evaluateWin({ ...suuankouInput, tsumo: false }, sit());
    expect(r.yakuman).toBe(0);
    expect(names(r)).toEqual(
      expect.arrayContaining(["三暗刻", "対々和", "役牌 中"]),
    );
    expect(r.han).toBe(5);
  });

  it("ポンを含む対々和と混老頭", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("s111z22z777"),
        melds: [pon("m111"), pon("p999")],
        winTile: "z7",
        tsumo: true,
      },
      sit(),
    );
    expect(names(r)).toEqual(
      expect.arrayContaining(["対々和", "混老頭", "役牌 中"]),
    );
    expect(r.han).toBe(5);
  });

  it("カン 4 組で四槓子", () => {
    const r = evaluateWin(
      {
        concealed: parseHand("m99"),
        melds: [
          minkan("m1111"),
          ankan("p3333"),
          {
            type: "kakan",
            tiles: parseHand("s9999"),
            calledTile: "s9",
            from: 0,
          },
          minkan("z1111"),
        ],
        winTile: "m9",
        tsumo: true,
      },
      sit({ rinshan: true }),
    );
    expect(names(r)).toContain("四槓子");
    expect(r.yakuman).toBeGreaterThanOrEqual(1);
  });

  it("七対子と国士無双は副露なしのときだけ成立する", () => {
    const chiitoi = evaluateWin(
      {
        concealed: parseHand("m2244p6688s1199z11"),
        melds: [],
        winTile: "z1",
        tsumo: true,
      },
      sit(),
    );
    expect(names(chiitoi)).toContain("七対子");
    expect(chiitoi.fu).toBe(25);

    const kokushi = evaluateWin(
      {
        concealed: parseHand("m119p19s19z1234567"),
        melds: [],
        winTile: "m1",
        tsumo: false,
      },
      sit(),
    );
    expect(kokushi.yakuman).toBe(1);
    expect(names(kokushi)).toEqual(["国士無双"]);
  });
});

describe("evaluateWin: 入力検証", () => {
  it("門前部分の枚数が合わなければエラー", () => {
    expect(() =>
      evaluateWin(
        {
          concealed: parseHand("m123m456p11s678"),
          melds: [],
          winTile: "m1",
          tsumo: true,
        },
        sit(),
      ),
    ).toThrow();
    expect(() =>
      evaluateWin(
        {
          concealed: parseHand("m123m456m789p11s678"),
          melds: [chi("s123")],
          winTile: "m1",
          tsumo: true,
        },
        sit(),
      ),
    ).toThrow();
  });
});
