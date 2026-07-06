import { useMemo, useState } from "react";
import { Hand } from "../../components/Hand";
import { Tile } from "../../components/Tile";
import {
  countsOf,
  createShuffledWall,
  type DiscardOption,
  discardOptions,
  shantenFromCounts,
  sortTiles,
  type TileId,
  tileName,
} from "../../core";

const TURNS = 10;
const BEST_KEY = "efficiency-training:best";

interface Session {
  wall: TileId[];
  hand: TileId[]; // 13 枚（理牌済み）
  wallPos: number;
  turn: number;
  correct: number;
}

function newSession(): Session {
  const wall = createShuffledWall();
  return {
    wall,
    hand: sortTiles(wall.slice(0, 13)),
    wallPos: 14,
    turn: 1,
    correct: 0,
  };
}

type Phase = "pick" | "feedback" | "won" | "finished";

export default function EfficiencyTraining() {
  const [session, setSession] = useState<Session>(newSession);
  const [phase, setPhase] = useState<Phase>("pick");
  const [pickedOption, setPickedOption] = useState<DiscardOption | null>(null);
  const [bestRecord, setBestRecord] = useState(
    () => Number(localStorage.getItem(BEST_KEY)) || 0,
  );

  const drawn = session.wall[session.wallPos - 1];
  const hand14 = useMemo(() => [...session.hand, drawn], [session, drawn]);
  const options = useMemo(() => discardOptions(hand14), [hand14]);
  const isWin = useMemo(
    () => shantenFromCounts(countsOf(hand14)) === -1,
    [hand14],
  );
  const bestOptions = options.filter((o) => o.best);

  if (phase === "pick" && isWin) {
    setPhase("won");
  }

  const pick = (index: number) => {
    if (phase !== "pick") return;
    const tile = index < 13 ? session.hand[index] : drawn;
    const option = options.find((o) => o.tile === tile);
    if (!option) return;
    setPickedOption(option);
    setSession((s) => ({ ...s, correct: s.correct + (option.best ? 1 : 0) }));
    setPhase("feedback");
  };

  const nextTurn = () => {
    if (!pickedOption) return;
    const rest = [...hand14];
    rest.splice(rest.indexOf(pickedOption.tile), 1);
    if (session.turn >= TURNS) {
      const score = session.correct;
      if (score > bestRecord) {
        setBestRecord(score);
        localStorage.setItem(BEST_KEY, String(score));
      }
      setPhase("finished");
      return;
    }
    setSession((s) => ({
      ...s,
      hand: sortTiles(rest),
      wallPos: s.wallPos + 1,
      turn: s.turn + 1,
    }));
    setPickedOption(null);
    setPhase("pick");
  };

  const restart = () => {
    setSession(newSession());
    setPickedOption(null);
    setPhase("pick");
  };

  if (phase === "finished") {
    return (
      <main className="finished">
        <p>{TURNS} 巡の結果</p>
        <p className="big">
          {session.correct} / {TURNS}
        </p>
        <p>自己ベスト: {bestRecord} 問正解</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={restart}>
            もう一度
          </button>
        </div>
      </main>
    );
  }

  if (phase === "won") {
    return (
      <main className="finished">
        <p className="big">ツモ和了!</p>
        <Hand tiles={session.hand} drawn={drawn} />
        <p>
          {session.turn} 巡目でアガリました（それまでの正解 {session.correct}）
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={restart}>
            もう一度
          </button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="scorebar">
        <span>
          {session.turn} / {TURNS} 巡目
        </span>
        <span>正解: {session.correct}</span>
      </div>
      <p className="situation">
        {phase === "pick"
          ? "受け入れが最大になる牌を切ってください"
          : pickedOption?.best
            ? "正解! 最善の一打です"
            : "もっと良い打牌がありました"}
      </p>
      <Hand
        tiles={session.hand}
        drawn={drawn}
        onTileClick={phase === "pick" ? pick : undefined}
        disabled={phase !== "pick"}
      />
      {phase === "feedback" && pickedOption && (
        <div className="panel">
          <p
            className={`result ${pickedOption.best ? "result-ok" : "result-ng"}`}
          >
            {pickedOption.best ? "正解!" : "不正解…"}
          </p>
          <p>
            あなた: {tileName(pickedOption.tile)} 切り →{" "}
            {pickedOption.shanten === 0
              ? "テンパイ"
              : `${pickedOption.shanten} シャンテン`}
            ・受け入れ {pickedOption.total} 枚
          </p>
          {!pickedOption.best && (
            <div>
              {bestOptions.slice(0, 3).map((option) => (
                <div key={option.tile} className="ukeire-row">
                  <Tile id={option.tile} small />
                  <span>切り</span>
                  <span className="ukeire-count">
                    {option.shanten === 0
                      ? "テンパイ"
                      : `${option.shanten} シャンテン`}
                    ・{option.total} 枚
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="btn-row">
            <button type="button" className="btn" onClick={nextTurn}>
              {session.turn >= TURNS ? "結果を見る" : "次のツモ"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
