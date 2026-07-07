import { describe, expect, it } from "vitest";
import {
  parseHand,
  sortTiles,
  type TileId,
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

/** 手牌+河+山+王牌+ツモ中の牌の総数（結果表示前まで常に 136） */
function countTiles(s: RoundState): number {
  let n = s.wall.length + s.deadWall.length;
  for (const p of s.players) {
    n += p.hand.length + p.river.length;
    n += p.melds.reduce((sum, m) => sum + m.tiles.length, 0);
  }
  if (s.phase.t === "playerTurn") n += 1;
  return n;
}

function totalPoints(s: RoundState): number {
  return s.players.reduce((sum, p) => sum + p.score, 0) + s.kyotaku;
}

/** プレイヤーもツモ切り+即和了で打つ自動ドライバー */
function autoEvent(s: RoundState, pass: boolean): GameEvent {
  switch (s.phase.t) {
    case "playerTurn":
      if (s.phase.canTsumo) return { type: "TSUMO_AGARI" };
      return { type: "DISCARD", index: s.players[0].hand.length };
    case "playerClaim":
      return pass
        ? { type: "PASS" }
        : { type: "CLAIM", option: { kind: "ron" } };
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

  it("プレイヤーが全ロンを見逃しても進行が破綻しない", {
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
  return {
    hand: tiles,
    melds: [],
    river: [],
    score: START_SCORE,
    riichi: null,
    furiten: { river: false, temporary: false, riichi: false },
    waits: waitKindsWithMelds(tiles, 0),
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
  canTsumo: false,
  canRiichi: false,
  riichiOptions: [],
  mustTsumogiri: false,
  ...over,
});

describe("engine: 立直シナリオ", () => {
  // プレイヤー: m123 m456 p789 s23 + s55 のテンパイ（待ち s1/s4）
  const TENPAI = "m123m456p789s2355";

  it("立直宣言 → 供託 → 一発ロンまで通る", () => {
    let s = testState({
      // CPU3 が z7 をツモ切り → プレイヤーが z1 をツモ → CPU1 が z8=なし…
      // wall: [CPU3のツモ, プレイヤーのツモ, CPU1のツモ, CPU2のツモ(=プレイヤーの当たり牌), 残り4枚]
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
      // CPU1 が s1（当たり牌）をツモ切り → プレイヤーが見逃す
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
      // CPU2 が s1 → 見逃し → CPU3 が s4 → 同巡フリテンでロン不可 → プレイヤーの手番
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
    expect(s.players[0].furiten.riichi).toBe(false); // 立直していないので永続ではない

    s = step(s, { type: "CPU_STEP" }); // CPU3 が s4 をツモ切り
    expect(s.phase.t).toBe("playerTurn"); // ロンは出ずに自分の手番へ
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
      phase: playerTurnPhase("s1"), // 当たり牌 s1 をツモ切りする
    });
    s = step(s, { type: "DISCARD", index: 13 });
    expect(s.players[0].furiten.river).toBe(true);
  });
});

describe("engine: 頭ハネ", () => {
  it("複数人が同じ牌でロンできるときは打牌者に近い 1 人だけが和了する", () => {
    // CPU1 と CPU3 が同じ s1 待ち（役牌あり）でテンパイ。プレイヤーが s1 を切る
    const cpu1 = "m234p567z555s23s99"; // 白
    const cpu3 = "m234p567z777s23s99"; // 中
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
    // 門前清自摸和 + 平和 = 2 翻 20 符、親ツモ 700 オール
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
    // 立直棒 1000 返却 + テンパイ料 3000
    expect(result.scoreDeltas).toEqual([3000, -1000, -1000, -1000]);
    expect(s.kyotaku).toBe(0);
  });
});
