import { describe, expect, it } from "vitest";
import {
  parseHand,
  sortTiles,
  type TileId,
  tileKind,
  waitKindsWithMelds,
} from "../../core";
import {
  deal,
  type GameEvent,
  type Phase,
  type PlayerState,
  type RoundState,
  START_SCORE,
  step,
} from "./engine";

/**
 * 手牌+副露+河+山+王牌+ツモ中の牌の総数（結果表示前まで常に 136）。
 * 鳴かれた河の牌は実体が副露に移っているため数えない。
 */
function countTiles(s: RoundState): number {
  let n = s.wall.length + s.deadWall.length;
  for (const p of s.players) {
    n += p.hand.length + p.river.filter((rt) => !rt.called).length;
    n += p.melds.reduce((sum, m) => sum + m.tiles.length, 0);
  }
  if (s.phase.t === "playerTurn" && s.phase.drawn !== null) n += 1;
  return n;
}

function totalPoints(s: RoundState): number {
  return s.players.reduce((sum, p) => sum + p.score, 0) + s.kyotaku;
}

/** プレイヤーも自動で打つドライバー（和了・カン・鳴きは常に実行） */
function autoEvent(s: RoundState, pass: boolean): GameEvent {
  switch (s.phase.t) {
    case "playerTurn": {
      const ph = s.phase;
      if (ph.canTsumo) return { type: "TSUMO_AGARI" };
      if (ph.drawn !== null && ph.ankanKinds.length > 0) {
        return { type: "ANKAN", kind: ph.ankanKinds[0] };
      }
      if (ph.drawn !== null && ph.kakanKinds.length > 0) {
        return { type: "KAKAN", kind: ph.kakanKinds[0] };
      }
      const hand = s.players[0].hand;
      if (ph.drawn === null) {
        // 鳴き直後: 現物喰い替えにならない最初の牌を切る
        const index = hand.findIndex(
          (t) => ph.forbiddenKind === null || tileKind(t) !== ph.forbiddenKind,
        );
        return { type: "DISCARD", index };
      }
      return { type: "DISCARD", index: hand.length };
    }
    case "playerClaim":
      if (pass) return { type: "PASS" };
      return { type: "CLAIM", option: s.phase.options[0] };
    case "cpuTurn":
      return { type: "CPU_STEP" };
    default:
      throw new Error("終局後にイベントは発生しない");
  }
}

function autoPlay(seed: number, pass = false): RoundState {
  let s = deal(seed);
  for (let i = 0; i < 400; i++) {
    if (s.phase.t === "finished") return s;
    expect(countTiles(s)).toBe(136);
    expect(totalPoints(s)).toBe(4 * START_SCORE);
    expect(s.deadWall).toHaveLength(14);
    s = step(s, autoEvent(s, pass));
  }
  throw new Error(`seed ${seed}: 400 手で終局しなかった`);
}

describe("engine: 自動対局の不変条件", () => {
  it("シード 1〜25 で必ず終局し、牌 136 枚と点数総和 100000 が保たれる", {
    timeout: 60_000,
  }, () => {
    for (let seed = 1; seed <= 25; seed++) {
      const final = autoPlay(seed);
      expect(final.phase.t).toBe("finished");
      expect(totalPoints(final)).toBe(4 * START_SCORE);
      expect(final.kyotaku).toBe(0);
      if (final.phase.t === "finished") {
        const deltas = final.phase.result.scoreDeltas;
        expect(deltas.reduce((a, b) => a + b, 0)).toBe(0);
        for (const seat of [0, 1, 2, 3]) {
          expect(final.players[seat].score).toBe(START_SCORE + deltas[seat]);
        }
      }
    }
  });

  it("プレイヤーが全応答をスルーしても進行が破綻しない", {
    timeout: 60_000,
  }, () => {
    for (let seed = 1; seed <= 5; seed++) {
      const final = autoPlay(seed, true);
      expect(final.phase.t).toBe("finished");
    }
  });

  it("同じシードなら同じ結果になる（決定論）", { timeout: 60_000 }, () => {
    const a = autoPlay(11);
    const b = autoPlay(11);
    expect(a).toEqual(b);
  });
});

// --- シナリオテスト用のステートビルダー ---

function testPlayer(
  hand: string,
  over: Partial<PlayerState> = {},
): PlayerState {
  const tiles = sortTiles(parseHand(hand));
  const melds = over.melds ?? [];
  return {
    hand: tiles,
    melds,
    river: [],
    score: START_SCORE,
    riichi: null,
    furiten: { river: false, temporary: false, riichi: false },
    waits: waitKindsWithMelds(tiles, melds.length),
    ...over,
  };
}

/** ノーテンかつ和了に遠い CPU 用の手牌 */
const JUNK_HAND = "m147p258s369z1122";

const TEST_DEAD_WALL = parseHand("z6z6z6z6z3z6z6z6z6z3z6z6z6z6") as TileId[];
// deadWall[4] = z3 → ドラ z4 / deadWall[9] = z3 → 裏ドラ z4（どの手にも含めない）

function testState(over: Partial<RoundState>): RoundState {
  return {
    wall: [],
    deadWall: TEST_DEAD_WALL,
    doraIndicators: [TEST_DEAD_WALL[4]],
    players: [
      testPlayer(JUNK_HAND),
      testPlayer(JUNK_HAND),
      testPlayer(JUNK_HAND),
      testPlayer(JUNK_HAND),
    ],
    dealer: 0,
    turn: 0,
    phase: { t: "cpuTurn", seat: 0 },
    kyotaku: 0,
    kanCount: 0,
    anyCalls: false,
    ...over,
  };
}

type PlayerTurnPhase = Extract<Phase, { t: "playerTurn" }>;

const playerTurnPhase = (
  drawn: TileId,
  over: Partial<PlayerTurnPhase> = {},
): Phase => ({
  t: "playerTurn",
  drawn,
  rinshan: false,
  canTsumo: false,
  canRiichi: false,
  riichiOptions: [],
  mustTsumogiri: false,
  ankanKinds: [],
  kakanKinds: [],
  forbiddenKind: null,
  ...over,
});

describe("engine: 立直シナリオ", () => {
  // プレイヤー: m123 m456 p789 s23 + s55 のテンパイ（待ち s1/s4）
  const TENPAI = "m123m456p789s2355";

  it("立直宣言 → 供託 → 一発ロンまで通る", () => {
    let s = testState({
      // wall: [CPU3のツモ, プレイヤーのツモ, CPU1のツモ, CPU2のツモ(=当たり牌), 残り]
      wall: parseHand("z7z1p2s1z2z2z2z2"),
      players: [
        testPlayer(TENPAI, { river: [{ tile: "z6" }] }),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      turn: 3,
      phase: { t: "cpuTurn", seat: 3 },
    });

    // CPU3 ツモ切り → プレイヤーの手番
    s = step(s, { type: "CPU_STEP" });
    expect(s.phase.t).toBe("playerTurn");
    if (s.phase.t !== "playerTurn") return;
    expect(s.phase.drawn).toBe("z1");
    expect(s.phase.canRiichi).toBe(true);
    // 立直宣言できるのはツモ切り（index 13）のみ
    expect(s.phase.riichiOptions).toEqual([13]);

    // 不正な立直宣言は拒否される
    expect(() =>
      step(s, { type: "DISCARD", index: 0, riichi: true }),
    ).toThrow();

    // 立直宣言（ツモ切り）
    s = step(s, { type: "DISCARD", index: 13, riichi: true });
    const p0 = s.players[0];
    expect(p0.riichi).toEqual({ double: false, ippatsu: true });
    expect(p0.score).toBe(START_SCORE - 1000);
    expect(s.kyotaku).toBe(1000);
    expect(p0.river[p0.river.length - 1]).toEqual({
      tile: "z1",
      riichiDeclare: true,
    });

    // CPU1 がツモ切り（p2: 当たり牌ではない）→ CPU2 が s1 をツモ切り → ロン可能
    s = step(s, { type: "CPU_STEP" });
    s = step(s, { type: "CPU_STEP" });
    expect(s.phase).toEqual({
      t: "playerClaim",
      discarded: "s1",
      from: 2,
      options: [{ kind: "ron" }],
    });

    // ロン: 立直 + 一発 + 平和 = 3 翻 30 符、親ロン 5800 + 供託 1000
    s = step(s, { type: "CLAIM", option: { kind: "ron" } });
    expect(s.phase.t).toBe("finished");
    if (s.phase.t !== "finished") return;
    const result = s.phase.result;
    if (result.type !== "win") throw new Error("和了のはず");
    expect(result.winner).toBe(0);
    expect(result.loser).toBe(2);
    const names = result.value.yaku.map((y) => y.name);
    expect(names).toEqual(expect.arrayContaining(["立直", "一発", "平和"]));
    expect(result.value.han).toBe(3);
    expect(result.value.fu).toBe(30);
    expect(result.score.total).toBe(5800);
    expect(result.uraIndicators).toEqual(["z3"]);
    expect(s.players[0].score).toBe(START_SCORE - 1000 + 5800 + 1000);
    expect(s.players[2].score).toBe(START_SCORE - 5800);
    expect(s.kyotaku).toBe(0);
  });

  it("立直後の見逃しは永続フリテンになる", () => {
    let s = testState({
      wall: parseHand("s1s4z2z2z2z2z2z2"),
      players: [
        testPlayer(TENPAI, {
          riichi: { double: false, ippatsu: false },
          score: START_SCORE - 1000,
        }),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      kyotaku: 1000,
      turn: 1,
      phase: { t: "cpuTurn", seat: 1 },
    });

    s = step(s, { type: "CPU_STEP" });
    expect(s.phase.t).toBe("playerClaim");
    s = step(s, { type: "PASS" });
    expect(s.players[0].furiten.riichi).toBe(true);

    // 次の当たり牌 s4 が出てもロンの選択肢は出ない
    s = step(s, { type: "CPU_STEP" }); // CPU2 が s4 をツモ切り
    expect(s.phase.t).not.toBe("playerClaim");
  });
});

describe("engine: フリテン", () => {
  const TENPAI = "m123m456p789s2355";

  it("見逃し後の同巡は別の待ち牌でもロンできず、自分のツモ番で解除される", () => {
    let s = testState({
      wall: parseHand("s1s4z2z2z2z2z2z2"),
      players: [
        testPlayer(TENPAI),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      turn: 2,
      phase: { t: "cpuTurn", seat: 2 },
    });

    s = step(s, { type: "CPU_STEP" });
    expect(s.phase.t).toBe("playerClaim");
    s = step(s, { type: "PASS" });
    expect(s.players[0].furiten.temporary).toBe(true);
    expect(s.players[0].furiten.riichi).toBe(false);

    s = step(s, { type: "CPU_STEP" }); // CPU3（上家）が s4 をツモ切り
    // フリテンでロンは選べないが、チーは可能なので選択肢は出る
    expect(s.phase.t).toBe("playerClaim");
    if (s.phase.t !== "playerClaim") return;
    expect(s.phase.options.some((o) => o.kind === "ron")).toBe(false);
    expect(s.phase.options.every((o) => o.kind === "chi")).toBe(true);

    s = step(s, { type: "PASS" });
    expect(s.phase.t).toBe("playerTurn"); // 自分の手番へ
    expect(s.players[0].furiten.temporary).toBe(false); // ツモ番で解除
  });

  it("自分の河に待ち牌があると河フリテン", () => {
    let s = testState({
      wall: parseHand("z2z2z2z2z2z2"),
      players: [
        testPlayer(TENPAI, { river: [] }),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      turn: 0,
      phase: playerTurnPhase("s1"),
    });
    s = step(s, { type: "DISCARD", index: 13 });
    expect(s.players[0].furiten.river).toBe(true);
  });
});

describe("engine: 頭ハネ", () => {
  it("複数人が同じ牌でロンできるときは打牌者に近い 1 人だけが和了する", () => {
    const cpu1 = "m234p567z555s23s99"; // 白 s1/s4 待ち
    const cpu3 = "m234p567z777s23s99"; // 中 s1/s4 待ち
    let s = testState({
      wall: parseHand("z2z2z2z2z2z2"),
      players: [
        testPlayer(JUNK_HAND),
        testPlayer(cpu1),
        testPlayer(JUNK_HAND),
        testPlayer(cpu3),
      ],
      turn: 0,
      phase: playerTurnPhase("s1"),
    });
    s = step(s, { type: "DISCARD", index: 13 });
    expect(s.phase.t).toBe("finished");
    if (s.phase.t !== "finished") return;
    const result = s.phase.result;
    if (result.type !== "win") throw new Error("和了のはず");
    expect(result.winner).toBe(1); // 下家（打牌者 0 から最も近い）
    expect(result.loser).toBe(0);
  });
});

describe("engine: ツモ和了と流局", () => {
  it("親のツモ和了は全員から徴収し供託も得る", () => {
    let s = testState({
      wall: parseHand("z2z2z2z2z2z2"),
      players: [
        // 河に 1 枚置いて天和判定を避ける
        testPlayer("m123m456p789s2355", { river: [{ tile: "z6" }] }),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      dealer: 0,
      turn: 0,
      phase: playerTurnPhase("s1", { canTsumo: true }),
    });
    s = step(s, { type: "TSUMO_AGARI" });
    expect(s.phase.t).toBe("finished");
    if (s.phase.t !== "finished") return;
    const result = s.phase.result;
    if (result.type !== "win") throw new Error("和了のはず");
    expect(result.value.han).toBe(2);
    expect(result.value.fu).toBe(20);
    expect(result.score.payments).toBe("700オール");
    expect(result.scoreDeltas).toEqual([2100, -700, -700, -700]);
  });

  it("流局: ノーテン罰符と立直棒の返却", () => {
    let s = testState({
      wall: ["z2"], // CPU3 が最後の 1 枚をツモ切りして流局
      players: [
        testPlayer("m123m456p789s2355", {
          riichi: { double: false, ippatsu: false },
          score: START_SCORE - 1000,
        }),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      kyotaku: 1000,
      turn: 3,
      phase: { t: "cpuTurn", seat: 3 },
    });
    s = step(s, { type: "CPU_STEP" });
    expect(s.phase.t).toBe("finished");
    if (s.phase.t !== "finished") return;
    const result = s.phase.result;
    if (result.type !== "ryuukyoku") throw new Error("流局のはず");
    expect(result.tenpai).toEqual([true, false, false, false]);
    expect(result.scoreDeltas).toEqual([3000, -1000, -1000, -1000]);
    expect(s.kyotaku).toBe(0);
  });
});

describe("engine: ポン", () => {
  it("ポン → 打牌 → 手番が下家に移る", () => {
    let s = testState({
      wall: parseHand("z5z2z2z2z2z2"),
      players: [
        testPlayer("m147p258s369z1155"),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      turn: 1,
      phase: { t: "cpuTurn", seat: 1 },
    });
    // CPU1 が z5 をツモ切り → ポンの選択肢
    s = step(s, { type: "CPU_STEP" });
    expect(s.phase).toEqual({
      t: "playerClaim",
      discarded: "z5",
      from: 1,
      options: [{ kind: "pon" }],
    });

    s = step(s, { type: "CLAIM", option: { kind: "pon" } });
    expect(s.players[0].melds).toEqual([
      { type: "pon", tiles: ["z5", "z5", "z5"], calledTile: "z5", from: 1 },
    ]);
    expect(s.players[0].hand).toHaveLength(11);
    expect(s.players[1].river[s.players[1].river.length - 1]).toEqual({
      tile: "z5",
      called: true,
    });
    expect(s.phase.t).toBe("playerTurn");
    if (s.phase.t !== "playerTurn") return;
    expect(s.phase.drawn).toBeNull();
    expect(s.phase.forbiddenKind).toBe(tileKind("z5"));

    // 打牌すると下家（CPU1）の手番へ
    s = step(s, { type: "DISCARD", index: 0 });
    expect(s.players[0].hand).toHaveLength(10);
    expect(s.phase).toEqual({ t: "cpuTurn", seat: 1 });
  });
});

describe("engine: チー", () => {
  // m4 m0(赤5) m5 m6 m7 m8 + バラ牌
  const CHI_HAND = "m405678p25s369z12";

  it("上家の捨て牌は赤五を区別してチーの構成を列挙する", () => {
    let s = testState({
      wall: parseHand("m6z2z2z2z2z2"),
      players: [
        testPlayer(CHI_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      turn: 3,
      phase: { t: "cpuTurn", seat: 3 },
    });
    s = step(s, { type: "CPU_STEP" });
    expect(s.phase.t).toBe("playerClaim");
    if (s.phase.t !== "playerClaim") return;
    const options = s.phase.options;
    expect(options).toHaveLength(5);
    expect(options.every((o) => o.kind === "chi")).toBe(true);
    expect(options).toContainEqual({ kind: "chi", tiles: ["m4", "m0"] });
    expect(options).toContainEqual({ kind: "chi", tiles: ["m4", "m5"] });
    expect(options).toContainEqual({ kind: "chi", tiles: ["m0", "m7"] });
    expect(options).toContainEqual({ kind: "chi", tiles: ["m7", "m8"] });
  });

  it("チー後は鳴いた牌と同じ牌を切れない（現物喰い替え禁止）", () => {
    let s = testState({
      wall: parseHand("m6z2z2z2z2z2"),
      players: [
        testPlayer(CHI_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      turn: 3,
      phase: { t: "cpuTurn", seat: 3 },
    });
    s = step(s, { type: "CPU_STEP" });
    s = step(s, {
      type: "CLAIM",
      option: { kind: "chi", tiles: ["m7", "m8"] },
    });
    expect(s.players[0].melds).toEqual([
      { type: "chi", tiles: ["m7", "m8", "m6"], calledTile: "m6", from: 3 },
    ]);
    expect(s.phase.t).toBe("playerTurn");
    if (s.phase.t !== "playerTurn") return;
    expect(s.phase.forbiddenKind).toBe(tileKind("m6"));

    // 手牌に残っている m6（index 3）は切れない
    const m6Index = s.players[0].hand.indexOf("m6");
    expect(m6Index).toBeGreaterThanOrEqual(0);
    expect(() => step(s, { type: "DISCARD", index: m6Index })).toThrow();

    // 別の牌なら切れる
    s = step(s, { type: "DISCARD", index: 0 });
    expect(s.phase).toEqual({ t: "cpuTurn", seat: 1 });
  });

  it("下家・対面の捨て牌はチーできない", () => {
    let s = testState({
      wall: parseHand("m6z2z2z2z2z2"),
      players: [
        testPlayer(CHI_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      turn: 1,
      phase: { t: "cpuTurn", seat: 1 },
    });
    s = step(s, { type: "CPU_STEP" });
    // 鳴けないのでそのまま次の手番（CPU2）へ
    expect(s.phase).toEqual({ t: "cpuTurn", seat: 2 });
  });
});

describe("engine: カン", () => {
  it("暗槓 → 槓ドラ即めくり → 嶺上ツモ → 嶺上開花", () => {
    let s = testState({
      // deadWall[0] = s1（嶺上牌 = 和了牌）
      deadWall: parseHand("s1z6z6z6z3z3z6z6z6z6z6z6z6z6") as TileId[],
      doraIndicators: ["z3"],
      wall: parseHand("z2z5z6z6z6z6"),
      players: [
        // m123 m456 s23 z555 p99: z5 をツモると暗槓できる
        testPlayer("m123m456s23z555p99"),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      turn: 3,
      phase: { t: "cpuTurn", seat: 3 },
    });

    // CPU3 ツモ切り → プレイヤーが z5 をツモ
    s = step(s, { type: "CPU_STEP" });
    expect(s.phase.t).toBe("playerTurn");
    if (s.phase.t !== "playerTurn") return;
    expect(s.phase.ankanKinds).toEqual([tileKind("z5")]);

    const wallBefore = s.wall.length;
    s = step(s, { type: "ANKAN", kind: tileKind("z5") });
    expect(s.players[0].melds).toEqual([
      {
        type: "ankan",
        tiles: ["z5", "z5", "z5", "z5"],
        calledTile: null,
        from: null,
      },
    ]);
    expect(s.players[0].hand).toHaveLength(10);
    expect(s.doraIndicators).toEqual(["z3", "z3"]); // 槓ドラ即めくり
    expect(s.kanCount).toBe(1);
    expect(s.wall).toHaveLength(wallBefore - 1); // 王牌へ 1 枚補充
    expect(s.deadWall).toHaveLength(14);
    expect(s.phase.t).toBe("playerTurn");
    if (s.phase.t !== "playerTurn") return;
    expect(s.phase.drawn).toBe("s1"); // 嶺上牌
    expect(s.phase.rinshan).toBe(true);
    expect(s.phase.canTsumo).toBe(true);

    // 嶺上開花
    s = step(s, { type: "TSUMO_AGARI" });
    expect(s.phase.t).toBe("finished");
    if (s.phase.t !== "finished") return;
    const result = s.phase.result;
    if (result.type !== "win") throw new Error("和了のはず");
    const names = result.value.yaku.map((y) => y.name);
    expect(names).toEqual(
      expect.arrayContaining(["嶺上開花", "門前清自摸和", "役牌 白"]),
    );
    expect(names).not.toContain("海底摸月");
  });

  it("加槓 → 搶槓でロンされると加槓は不成立", () => {
    let s = testState({
      wall: parseHand("z2m3z6z6z6z6"),
      players: [
        testPlayer("m47p258s369z12", {
          melds: [
            {
              type: "pon",
              tiles: ["m3", "m3", "m3"],
              calledTile: "m3",
              from: 1,
            },
          ],
        }),
        // m12 + p234 s567 z555 m99: m3 単独待ち（搶槓できる）
        testPlayer("m12p234s567z555m99"),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      turn: 3,
      phase: { t: "cpuTurn", seat: 3 },
    });

    // CPU3 ツモ切り → プレイヤーが m3 をツモ → 加槓可能
    s = step(s, { type: "CPU_STEP" });
    expect(s.phase.t).toBe("playerTurn");
    if (s.phase.t !== "playerTurn") return;
    expect(s.phase.kakanKinds).toEqual([tileKind("m3")]);

    s = step(s, { type: "KAKAN", kind: tileKind("m3") });
    expect(s.phase.t).toBe("finished");
    if (s.phase.t !== "finished") return;
    const result = s.phase.result;
    if (result.type !== "win") throw new Error("和了のはず");
    expect(result.winner).toBe(1);
    expect(result.loser).toBe(0);
    const names = result.value.yaku.map((y) => y.name);
    expect(names).toContain("搶槓");
    // 加槓は不成立: ポンのまま・槓ドラなし
    expect(s.players[0].melds[0].type).toBe("pon");
    expect(s.doraIndicators).toHaveLength(1);
    expect(s.kanCount).toBe(0);
  });

  it("搶槓されなければ加槓が成立し嶺上をツモる", () => {
    let s = testState({
      wall: parseHand("z2m3z6z6z6z6"),
      players: [
        testPlayer("m47p258s369z12", {
          melds: [
            {
              type: "pon",
              tiles: ["m3", "m3", "m3"],
              calledTile: "m3",
              from: 1,
            },
          ],
        }),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      turn: 3,
      phase: { t: "cpuTurn", seat: 3 },
    });
    s = step(s, { type: "CPU_STEP" });
    s = step(s, { type: "KAKAN", kind: tileKind("m3") });
    expect(s.players[0].melds[0]).toEqual({
      type: "kakan",
      tiles: ["m3", "m3", "m3", "m3"],
      calledTile: "m3",
      from: 1,
    });
    expect(s.doraIndicators).toHaveLength(2);
    expect(s.kanCount).toBe(1);
    expect(s.phase.t).toBe("playerTurn");
    if (s.phase.t !== "playerTurn") return;
    expect(s.phase.rinshan).toBe(true);
  });

  it("海底ではカンできない", () => {
    let s = testState({
      wall: parseHand("z2z5"), // プレイヤーのツモで山が尽きる
      players: [
        testPlayer("m147p258s369z1555"),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      turn: 3,
      phase: { t: "cpuTurn", seat: 3 },
    });
    s = step(s, { type: "CPU_STEP" });
    expect(s.phase.t).toBe("playerTurn");
    if (s.phase.t !== "playerTurn") return;
    expect(s.phase.drawn).toBe("z5"); // 4 枚目の z5 だが…
    expect(s.wall).toHaveLength(0);
    expect(s.phase.ankanKinds).toEqual([]); // 海底なのでカン不可
  });
});

describe("engine: 立直後の暗槓", () => {
  it("待ちが変わらないツモ牌の暗槓は可能で、一発は消える", () => {
    let s = testState({
      wall: parseHand("z2z5z6z6z6z6"),
      players: [
        testPlayer("m123m456s23z555p99", {
          riichi: { double: false, ippatsu: true },
          score: START_SCORE - 1000,
        }),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      kyotaku: 1000,
      turn: 3,
      phase: { t: "cpuTurn", seat: 3 },
    });
    s = step(s, { type: "CPU_STEP" });
    expect(s.phase.t).toBe("playerTurn");
    if (s.phase.t !== "playerTurn") return;
    expect(s.phase.mustTsumogiri).toBe(true);
    expect(s.phase.ankanKinds).toEqual([tileKind("z5")]);

    s = step(s, { type: "ANKAN", kind: tileKind("z5") });
    expect(s.players[0].riichi).toEqual({ double: false, ippatsu: false });
  });

  it("待ちが変わる暗槓はできない（送り槓相当）", () => {
    let s = testState({
      wall: parseHand("z2m1z6z6z6z6"),
      players: [
        // 純正九蓮宝燈: 9 面待ち。m1 をツモってもカンすると待ちが変わる
        testPlayer("m1112345678999", {
          riichi: { double: false, ippatsu: false },
          score: START_SCORE - 1000,
        }),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
        testPlayer(JUNK_HAND),
      ],
      kyotaku: 1000,
      turn: 3,
      phase: { t: "cpuTurn", seat: 3 },
    });
    s = step(s, { type: "CPU_STEP" });
    expect(s.phase.t).toBe("playerTurn");
    if (s.phase.t !== "playerTurn") return;
    // m1 ツモは和了（九蓮）なので canTsumo は真だが、カンは選べない
    expect(s.phase.ankanKinds).toEqual([]);
  });
});
