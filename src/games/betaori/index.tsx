import { useState } from "react";
import { Hand } from "../../components/Hand";
import { Tile } from "../../components/Tile";
import { tileName } from "../../core";
import { type BetaoriQuestion, generateQuestion, SAFETY_LABELS } from "./logic";

const TOTAL = 10;

export default function Betaori() {
  const [question, setQuestion] = useState<BetaoriQuestion>(generateQuestion);
  const [round, setRound] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  const pick = (index: number) => {
    if (picked !== null) return;
    setPicked(index);
    if (question.levels[index] === question.bestLevel) {
      setCorrectCount((n) => n + 1);
    }
  };

  const next = () => {
    if (round >= TOTAL) {
      setFinished(true);
      return;
    }
    setRound(round + 1);
    setQuestion(generateQuestion());
    setPicked(null);
  };

  const restart = () => {
    setQuestion(generateQuestion());
    setRound(1);
    setCorrectCount(0);
    setPicked(null);
    setFinished(false);
  };

  if (finished) {
    return (
      <main className="finished">
        <p>全 {TOTAL} 問の結果</p>
        <p className="big">
          {correctCount} / {TOTAL}
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={restart}>
            もう一度
          </button>
        </div>
      </main>
    );
  }

  const isCorrect =
    picked !== null && question.levels[picked] === question.bestLevel;
  const bestTiles = [
    ...new Set(
      question.hand.filter((_, i) => question.levels[i] === question.bestLevel),
    ),
  ];

  return (
    <main>
      <div className="scorebar">
        <span>
          第 {round} 問 / {TOTAL}
        </span>
        <span>正解: {correctCount}</span>
      </div>
      <p className="situation">
        相手の立直に対してベタオリします。相手の捨て牌:
      </p>
      <div className="tile-row river">
        {question.river.map((tile, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 河は同一牌が複数あり並びも固定
          <Tile key={`${tile}-${i}`} id={tile} small />
        ))}
      </div>
      <p className="situation">いちばん安全な牌を切ってください</p>
      <Hand
        tiles={question.hand}
        onTileClick={picked === null ? pick : undefined}
        disabled={picked !== null}
      />
      {picked !== null && (
        <div className="panel">
          <p className={`result ${isCorrect ? "result-ok" : "result-ng"}`}>
            {isCorrect ? "正解!" : "もっと安全な牌があります…"}
          </p>
          <p>
            あなた: {tileName(question.hand[picked])} —{" "}
            {SAFETY_LABELS[question.levels[picked]]}
          </p>
          <p>
            最安全:{" "}
            <span className="tile-row">
              {bestTiles.map((tile) => (
                <Tile key={tile} id={tile} small />
              ))}
            </span>{" "}
            — {SAFETY_LABELS[question.bestLevel]}
          </p>
          <p className="note">
            ※ 判定は「現物 → スジ・枯れ字牌 → 端牌・字牌 →
            無スジ中張牌」の簡易モデルです。
            ワンチャンスや裏スジは考慮しません。
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={next}>
              {round >= TOTAL ? "結果を見る" : "次の問題"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
