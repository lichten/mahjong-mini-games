import { useMemo, useState } from "react";
import { Hand } from "../../components/Hand";
import { Tile } from "../../components/Tile";
import { ukeire } from "../../core";
import { generateQuizHand, type QuizHand } from "./logic";

const BEST_KEY = "shanten-quiz:best-streak";
const CHOICES = [0, 1, 2, 3];

function choiceLabel(value: number): string {
  return value === 0 ? "テンパイ" : `${value} シャンテン`;
}

export default function ShantenQuiz() {
  const [quiz, setQuiz] = useState<QuizHand>(() => generateQuizHand());
  const [picked, setPicked] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(
    () => Number(localStorage.getItem(BEST_KEY)) || 0,
  );

  const info = useMemo(() => ukeire(quiz.tiles), [quiz]);
  const correct = picked === quiz.shanten;

  const answer = (value: number) => {
    if (picked !== null) return;
    setPicked(value);
    if (value === quiz.shanten) {
      const next = streak + 1;
      setStreak(next);
      if (next > bestStreak) {
        setBestStreak(next);
        localStorage.setItem(BEST_KEY, String(next));
      }
    } else {
      setStreak(0);
    }
  };

  const next = () => {
    setQuiz(generateQuizHand());
    setPicked(null);
  };

  return (
    <main>
      <div className="scorebar">
        <span>連続正解: {streak}</span>
        <span>自己ベスト: {bestStreak}</span>
      </div>
      <p className="situation">この手牌は何シャンテン?</p>
      <Hand tiles={quiz.tiles} />
      {picked === null ? (
        <div className="choices">
          {CHOICES.map((value) => (
            <button
              key={value}
              type="button"
              className="choice-btn"
              onClick={() => answer(value)}
            >
              {choiceLabel(value)}
            </button>
          ))}
        </div>
      ) : (
        <div className="panel">
          <p className={`result ${correct ? "result-ok" : "result-ng"}`}>
            {correct ? "正解!" : "不正解…"}
          </p>
          <p>
            答え: <strong>{choiceLabel(quiz.shanten)}</strong>
          </p>
          <p>
            {quiz.shanten === 0 ? "待ち牌" : "有効牌"}:{" "}
            <span className="tile-row">
              {info.tiles.map((t) => (
                <Tile key={t.id} id={t.id} small />
              ))}
            </span>{" "}
            全 {info.total} 枚
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
