import { useEffect, useReducer, useRef, useState } from "react";
import { Hand } from "../../components/Hand";
import { Tile } from "../../components/Tile";
import { kindToId, type MeldCall, type Seat, tileKind } from "../../core";
import { standardAi } from "./ai";
import {
  deal,
  type GameEvent,
  type RiverTile,
  type RoundResult,
  type RoundState,
  SEATS,
  START_SCORE,
  step,
  windOf,
} from "./engine";

const SEAT_NAMES = ["自分", "下家", "対面", "上家"];
const WIND_CHARS = ["東", "南", "西", "北"];
/** 各家の牌をその家の向きに回す CSS クラス（seat 順） */
const SEAT_ROT = ["fpm-rot-0", "fpm-rot-270", "fpm-rot-180", "fpm-rot-90"];

const STATS_KEY = "four-player-mahjong:stats";
const FAST_KEY = "four-player-mahjong:fast";

interface Stats {
  games: number;
  wins: number;
  deals: number;
  best: number;
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw)
      return { games: 0, wins: 0, deals: 0, best: 0, ...JSON.parse(raw) };
  } catch {
    // 壊れた保存データは初期化する
  }
  return { games: 0, wins: 0, deals: 0, best: 0 };
}

type Action = GameEvent | { type: "NEW_GAME"; seed: number };

function reducer(state: RoundState | null, action: Action): RoundState | null {
  if (action.type === "NEW_GAME") return deal(action.seed);
  if (!state || state.phase.t === "finished") return state;
  // タイマー由来の遅延 dispatch が局面とずれていたら無視する
  if (action.type === "CPU_STEP" && state.phase.t !== "cpuTurn") return state;
  if (
    (action.type === "DISCARD" ||
      action.type === "TSUMO_AGARI" ||
      action.type === "ANKAN" ||
      action.type === "KAKAN") &&
    state.phase.t !== "playerTurn"
  ) {
    return state;
  }
  if (
    (action.type === "CLAIM" || action.type === "PASS") &&
    state.phase.t !== "playerClaim"
  ) {
    return state;
  }
  return step(state, action, standardAi);
}

function RiverView({ river }: { river: RiverTile[] }) {
  return (
    <div className="fpm-river">
      {river.map((rt, i) => {
        const classes = [
          rt.riichiDeclare ? "fpm-riichi" : "",
          rt.called ? "fpm-called" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 河は追記のみで並びが変わらない
            key={`${rt.tile}-${i}`}
            className={classes || undefined}
          >
            <Tile id={rt.tile} small />
          </span>
        );
      })}
    </div>
  );
}

function MeldsView({ melds }: { melds: MeldCall[] }) {
  if (melds.length === 0) return null;
  return (
    <div className="fpm-melds">
      {melds.map((m, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: 副露は追記のみ
          key={`${m.type}-${i}`}
          className="fpm-meld"
        >
          {m.tiles.map((t, j) => (
            <Tile
              // biome-ignore lint/suspicious/noArrayIndexKey: 副露の並びは固定
              key={`${t}-${j}`}
              id={t}
              small
              faceDown={m.type === "ankan" && (j === 0 || j === 3)}
            />
          ))}
        </span>
      ))}
    </div>
  );
}

/** 卓の辺に沿った手牌（牌裏）と副露の帯。帯ごと席の向きに回転する */
function EdgeHand({
  state,
  seat,
  zone,
}: {
  state: RoundState;
  seat: Seat;
  zone: string;
}) {
  const p = state.players[seat];
  return (
    <div className={`fpm-rzone ${zone} ${SEAT_ROT[seat]}`}>
      <div className="fpm-strip">
        {p.hand.map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 裏向き表示で並びに意味がない
          <Tile key={i} id="z1" faceDown small />
        ))}
        <span className="fpm-strip-melds">
          <MeldsView melds={p.melds} />
        </span>
      </div>
    </div>
  );
}

/** 席の向きに回転した河ゾーン */
function SeatRiver({
  state,
  seat,
  zone,
}: {
  state: RoundState;
  seat: Seat;
  zone: string;
}) {
  const self = seat === 0 ? " fpm-self" : "";
  return (
    <div className={`fpm-rzone ${zone} ${SEAT_ROT[seat]}${self}`}>
      <RiverView river={state.players[seat].river} />
    </div>
  );
}

/** 中央の点数表示機風パネル */
function CenterPanel({ state }: { state: RoundState }) {
  const ph = state.phase;
  const activeSeat: Seat | null =
    ph.t === "cpuTurn" ? ph.seat : ph.t === "playerTurn" ? 0 : null;
  return (
    <div className="fpm-center">
      {SEATS.map((seat) => {
        const p = state.players[seat];
        return (
          <div
            key={seat}
            className={`fpm-score fpm-score-${seat}${
              activeSeat === seat ? " fpm-score-active" : ""
            }`}
          >
            <span className="fpm-score-wind">
              {WIND_CHARS[windOf(seat, state.dealer) - 1]}
            </span>
            <span>{p.score}</span>
            {p.riichi && (
              <span className="fpm-stick" role="img" aria-label="リーチ棒" />
            )}
          </div>
        );
      })}
      <div className="fpm-center-info">
        <div className="fpm-center-dora">
          {state.doraIndicators.map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 槓ドラで同じ表示牌が増え得る
            <Tile key={`${t}-${i}`} id={t} small />
          ))}
        </div>
        <div className="fpm-center-wall">残り {state.wall.length}</div>
        {state.kyotaku > 0 && (
          <div className="fpm-center-kyotaku">供託 {state.kyotaku / 1000}</div>
        )}
      </div>
    </div>
  );
}

/** 実卓風の卓面（5×5 グリッド） */
function TableView({
  state,
  callout,
}: {
  state: RoundState;
  callout: { seat: Seat; text: string } | null;
}) {
  return (
    <div className="fpm-table">
      <EdgeHand state={state} seat={2} zone="fpm-edge-top" />
      <EdgeHand state={state} seat={3} zone="fpm-edge-left" />
      <EdgeHand state={state} seat={1} zone="fpm-edge-right" />
      <SeatRiver state={state} seat={2} zone="fpm-zone-top" />
      <SeatRiver state={state} seat={3} zone="fpm-zone-left" />
      <SeatRiver state={state} seat={1} zone="fpm-zone-right" />
      <SeatRiver state={state} seat={0} zone="fpm-zone-bottom" />
      <CenterPanel state={state} />
      <div className="fpm-rzone fpm-edge-bottom fpm-rot-0">
        <div className="fpm-strip fpm-strip-end">
          <span className="fpm-strip-melds">
            <MeldsView melds={state.players[0].melds} />
          </span>
        </div>
      </div>
      {callout && (
        <div className={`fpm-callout fpm-callout-${callout.seat}`}>
          {SEAT_NAMES[callout.seat]}
          <strong>{callout.text}!</strong>
        </div>
      )}
    </div>
  );
}

function ResultPanel({
  result,
  winnerMelds,
  stats,
  onRestart,
}: {
  result: RoundResult;
  winnerMelds: MeldCall[];
  stats: Stats;
  onRestart: () => void;
}) {
  const statsLine = (
    <p className="note">
      通算: {stats.games} 局 / 和了 {stats.wins} / 放銃 {stats.deals}
      {stats.best > 0 && ` / 最高 ${stats.best} 点`}
    </p>
  );
  if (result.type === "ryuukyoku") {
    return (
      <div className="fpm-overlay">
        <div className="panel fpm-modal">
          <p className="result">流局</p>
          {SEAT_NAMES.map((name, seat) => (
            <div key={name} className="ukeire-row">
              <span>{name}</span>
              <span>{result.tenpai[seat] ? "テンパイ" : "ノーテン"}</span>
            </div>
          ))}
          <ScoreDeltas deltas={result.scoreDeltas} />
          {statsLine}
          <div className="btn-row">
            <button type="button" className="btn" onClick={onRestart}>
              もう一度
            </button>
          </div>
        </div>
      </div>
    );
  }
  const { value, score } = result;
  return (
    <div className="fpm-overlay">
      <div className="panel fpm-modal">
        <p
          className={`result ${result.winner === 0 ? "result-ok" : "result-ng"}`}
        >
          {SEAT_NAMES[result.winner]} の
          {result.tsumo
            ? "ツモ和了"
            : `ロン和了（放銃: ${SEAT_NAMES[result.loser ?? 0]}）`}
        </p>
        <Hand
          tiles={result.hand.slice(0, -1)}
          drawn={result.winTile}
          disabled
        />
        <MeldsView melds={winnerMelds} />
        {result.uraIndicators.length > 0 && (
          <p className="tile-row">
            裏ドラ表示:{" "}
            {result.uraIndicators.map((t, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 表示専用
              <Tile key={`${t}-${i}`} id={t} small />
            ))}
          </p>
        )}
        <div>
          {value.yaku.map((y) => (
            <div key={y.name} className="ukeire-row">
              <span>{y.name}</span>
              <span className="ukeire-count">
                {y.yakuman ? "役満" : `${y.han} 翻`}
              </span>
            </div>
          ))}
        </div>
        <p>
          <strong>
            {value.yakuman > 0
              ? `${score.rank} ${score.payments} 点`
              : `${value.fu} 符 ${value.han} 翻 ${score.payments} 点`}
          </strong>
          {value.yakuman === 0 && score.rank && `（${score.rank}）`}
        </p>
        <ScoreDeltas deltas={result.scoreDeltas} />
        {statsLine}
        <div className="btn-row">
          <button type="button" className="btn" onClick={onRestart}>
            もう一度
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreDeltas({ deltas }: { deltas: number[] }) {
  return (
    <div>
      {SEAT_NAMES.map((name, seat) => (
        <div key={name} className="ukeire-row">
          <span>{name}</span>
          <span className="ukeire-count">
            {START_SCORE + deltas[seat]}（{deltas[seat] >= 0 ? "+" : ""}
            {deltas[seat]}）
          </span>
        </div>
      ))}
    </div>
  );
}

/** 四人打ち麻雀 */
export default function FourPlayerMahjong() {
  const [state, dispatch] = useReducer(reducer, null);
  const [riichiArmed, setRiichiArmed] = useState(false);
  const [fast, setFast] = useState(
    () => localStorage.getItem(FAST_KEY) === "1",
  );
  const [stats, setStats] = useState<Stats>(loadStats);
  const [callout, setCallout] = useState<{ seat: Seat; text: string } | null>(
    null,
  );
  const prevRef = useRef<RoundState | null>(null);

  const delay = fast ? 150 : 500;

  // 局面の変化から鳴き・立直の発声と戦績更新を導出する
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;
    if (!state || !prev || state === prev) return;

    for (const seat of SEATS) {
      const before = prev.players[seat];
      const after = state.players[seat];
      if (after.melds.length > before.melds.length) {
        const meld = after.melds[after.melds.length - 1];
        const text =
          meld.type === "chi" ? "チー" : meld.type === "pon" ? "ポン" : "カン";
        setCallout({ seat, text });
      } else if (
        after.melds.some(
          (m, i) => before.melds[i] && before.melds[i].type !== m.type,
        )
      ) {
        setCallout({ seat, text: "カン" }); // 加槓
      } else if (!before.riichi && after.riichi) {
        setCallout({ seat, text: "リーチ" });
      }
    }

    // 終局したら戦績を更新する
    if (prev.phase.t !== "finished" && state.phase.t === "finished") {
      const result = state.phase.result;
      const next = { ...loadStats() };
      next.games += 1;
      if (result.type === "win") {
        if (result.winner === 0) {
          next.wins += 1;
          next.best = Math.max(next.best, result.score.total);
        }
        if (!result.tsumo && result.loser === 0) next.deals += 1;
      }
      localStorage.setItem(STATS_KEY, JSON.stringify(next));
      setStats(next);
    }
  }, [state]);

  // 発声は少し表示して自動で消す
  useEffect(() => {
    if (!callout) return;
    const id = setTimeout(() => setCallout(null), 1200);
    return () => clearTimeout(id);
  }, [callout]);

  // CPU の手番と立直後の自動ツモ切りをタイマーで進める
  useEffect(() => {
    if (!state) return;
    const ph = state.phase;
    if (ph.t === "cpuTurn") {
      const id = setTimeout(() => dispatch({ type: "CPU_STEP" }), delay);
      return () => clearTimeout(id);
    }
    if (
      ph.t === "playerTurn" &&
      ph.mustTsumogiri &&
      !ph.canTsumo &&
      ph.ankanKinds.length === 0
    ) {
      const id = setTimeout(
        () =>
          dispatch({ type: "DISCARD", index: state.players[0].hand.length }),
        delay,
      );
      return () => clearTimeout(id);
    }
  }, [state, delay]);

  const newGame = () => {
    setRiichiArmed(false);
    setCallout(null);
    dispatch({ type: "NEW_GAME", seed: Math.floor(Math.random() * 2 ** 31) });
  };

  const toggleFast = () => {
    setFast((f) => {
      localStorage.setItem(FAST_KEY, f ? "0" : "1");
      return !f;
    });
  };

  if (!state) {
    return (
      <main>
        <div className="panel">
          <p>
            CPU 3 人との東 1 局一本勝負。立直・鳴き（ポン・チー・カン）に
            フル対応。CPU は牌効率で手を進め、立直が入ると降りる標準思考です。
          </p>
          {stats.games > 0 && (
            <p className="note">
              通算: {stats.games} 局 / 和了 {stats.wins} / 放銃 {stats.deals}
              {stats.best > 0 && ` / 最高 ${stats.best} 点`}
            </p>
          )}
          <div className="btn-row">
            <button type="button" className="btn" onClick={newGame}>
              対局開始
            </button>
          </div>
        </div>
      </main>
    );
  }

  const ph = state.phase;
  const p0 = state.players[0];

  const discard = (index: number) => {
    if (ph.t !== "playerTurn") return;
    if (ph.drawn !== null && ph.mustTsumogiri && index !== p0.hand.length)
      return;
    if (riichiArmed && !ph.riichiOptions.includes(index)) return;
    if (
      ph.forbiddenKind !== null &&
      index < p0.hand.length &&
      tileKind(p0.hand[index]) === ph.forbiddenKind
    ) {
      return; // 現物喰い替え禁止
    }
    dispatch({ type: "DISCARD", index, riichi: riichiArmed });
    setRiichiArmed(false);
  };

  const turnLabel =
    ph.t === "playerTurn"
      ? "あなたの番"
      : ph.t === "playerClaim"
        ? "アクションを選択"
        : ph.t === "cpuTurn"
          ? `${SEAT_NAMES[ph.seat]}の番…`
          : "終局";

  return (
    <main>
      <div className="fpm-topbar">
        <span className="fpm-turnlabel">{turnLabel}</span>
        <button
          type="button"
          className="fpm-speed"
          onClick={toggleFast}
          aria-label="進行速度の切り替え"
        >
          {fast ? "高速 ▶▶" : "通常 ▶"}
        </button>
      </div>

      <TableView state={state} callout={callout} />

      {ph.t === "playerTurn" && (
        <div className="fpm-actions">
          {ph.canTsumo && (
            <button
              type="button"
              className="btn fpm-win-btn"
              onClick={() => dispatch({ type: "TSUMO_AGARI" })}
            >
              ツモ
            </button>
          )}
          {ph.canRiichi && !riichiArmed && (
            <button
              type="button"
              className="btn"
              onClick={() => setRiichiArmed(true)}
            >
              リーチ
            </button>
          )}
          {riichiArmed && (
            <button
              type="button"
              className="btn"
              onClick={() => setRiichiArmed(false)}
            >
              リーチ取消
            </button>
          )}
          {ph.ankanKinds.map((k) => (
            <button
              key={`ankan-${k}`}
              type="button"
              className="btn"
              onClick={() => dispatch({ type: "ANKAN", kind: k })}
            >
              カン <Tile id={kindToId(k)} small />
            </button>
          ))}
          {ph.kakanKinds.map((k) => (
            <button
              key={`kakan-${k}`}
              type="button"
              className="btn"
              onClick={() => dispatch({ type: "KAKAN", kind: k })}
            >
              加カン <Tile id={kindToId(k)} small />
            </button>
          ))}
          {riichiArmed && (
            <span className="note">テンパイが崩れない牌だけ切れます</span>
          )}
          {ph.drawn === null && (
            <span className="note">
              鳴いた牌と同じ牌以外を 1 枚切ってください
            </span>
          )}
          {ph.mustTsumogiri && !ph.canTsumo && ph.ankanKinds.length === 0 && (
            <span className="note">立直中: 自動ツモ切り</span>
          )}
        </div>
      )}

      {ph.t === "playerClaim" && (
        <div className="fpm-actions">
          <span className="tile-row">
            {SEAT_NAMES[ph.from]} の捨て牌 <Tile id={ph.discarded} small />
          </span>
          {ph.options.map((opt) =>
            opt.kind === "ron" ? (
              <button
                key="ron"
                type="button"
                className="btn fpm-win-btn"
                onClick={() => dispatch({ type: "CLAIM", option: opt })}
              >
                ロン
              </button>
            ) : opt.kind === "chi" ? (
              <button
                key={`chi-${opt.tiles.join("")}`}
                type="button"
                className="btn"
                onClick={() => dispatch({ type: "CLAIM", option: opt })}
              >
                チー <Tile id={opt.tiles[0]} small />
                <Tile id={opt.tiles[1]} small />
              </button>
            ) : (
              <button
                key={opt.kind}
                type="button"
                className="btn"
                onClick={() => dispatch({ type: "CLAIM", option: opt })}
              >
                {opt.kind === "pon" ? "ポン" : "カン"}
              </button>
            ),
          )}
          <button
            type="button"
            className="btn"
            onClick={() => dispatch({ type: "PASS" })}
          >
            スルー
          </button>
        </div>
      )}

      <Hand
        tiles={p0.hand}
        drawn={
          ph.t === "playerTurn" && ph.drawn !== null ? ph.drawn : undefined
        }
        onTileClick={ph.t === "playerTurn" ? discard : undefined}
        disabled={ph.t !== "playerTurn"}
      />

      {ph.t === "finished" && (
        <ResultPanel
          result={ph.result}
          winnerMelds={
            ph.result.type === "win"
              ? state.players[ph.result.winner].melds
              : []
          }
          stats={stats}
          onRestart={newGame}
        />
      )}
    </main>
  );
}
