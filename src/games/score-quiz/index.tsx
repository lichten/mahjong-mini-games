import { useState } from "react";
import { Hand } from "../../components/Hand";
import { contextLabel, WIND_LABELS } from "../shared/context";
import { generateScoreQuestion, type ScoreQuestion } from "./logic";

const BEST_KEY = "score-quiz:best-streak";

export default function ScoreQuiz() {
  const [question, setQuestion] = useState<ScoreQuestion>(
    generateScoreQuestion,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(
    () => Number(localStorage.getItem(BEST_KEY)) || 0,
  );

  const correct = picked === question.result.score.payments;

  const answer = (choice: string) => {
    if (picked !== null) return;
    setPicked(choice);
    if (choice === question.result.score.payments) {
      const next = streak + 1;
      setStreak(next);
      if (next > best) {
        setBest(next);
        localStorage.setItem(BEST_KEY, String(next));
      }
    } else {
      setStreak(0);
    }
  };

  const next = () => {
    setQuestion(generateScoreQuestion());
    setPicked(null);
  };

  const { result } = question;

  return (
    <main>
      <div className="scorebar">
        <span>連続正解: {streak}</span>
        <span>自己ベスト: {best}</span>
      </div>
      <p className="situation">{contextLabel(question)} — 何点?</p>
      <Hand tiles={question.hand} drawn={question.winTile} />
      {picked === null ? (
        <div className="choices">
          {question.choices.map((choice) => (
            <button
              key={choice}
              type="button"
              className="choice-btn"
              onClick={() => answer(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <div className="panel">
          <p className={`result ${correct ? "result-ok" : "result-ng"}`}>
            {correct ? "正解!" : "不正解…"}
          </p>
          <p>
            答え: <strong>{result.score.payments}</strong>
            {result.score.rank && `（${result.score.rank}）`}
            {result.yakuman === 0 && ` — ${result.fu} 符 ${result.han} 翻`}
          </p>
          <div>
            {result.yaku.map((y) => (
              <div key={y.name} className="ukeire-row">
                <span>{y.name}</span>
                <span className="ukeire-count">
                  {y.yakuman ? "役満" : `${y.han} 翻`}
                </span>
              </div>
            ))}
          </div>
          <p className="note">
            自風: {WIND_LABELS[question.seatWind - 1]}
            {question.dealer ? "（親）" : "（子）"} ／ 場風:{" "}
            {WIND_LABELS[question.roundWind - 1]} ／ ドラ {question.doraCount}{" "}
            枚
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={next}>
              次の問題
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
