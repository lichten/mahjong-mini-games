import { useState } from "react";
import { Hand } from "../../components/Hand";
import { contextLabel } from "../shared/context";
import { generateYakuQuestion, type YakuQuestion } from "./logic";

const BEST_KEY = "yaku-quiz:best-streak";

export default function YakuQuiz() {
  const [question, setQuestion] = useState<YakuQuestion>(generateYakuQuestion);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [answered, setAnswered] = useState(false);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(
    () => Number(localStorage.getItem(BEST_KEY)) || 0,
  );

  const answerSet = new Set(question.answers);
  const correct =
    selected.size === answerSet.size &&
    [...selected].every((name) => answerSet.has(name));

  const toggle = (name: string) => {
    if (answered) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const submit = () => {
    if (selected.size === 0) return;
    setAnswered(true);
    if (correct) {
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
    setQuestion(generateYakuQuestion());
    setSelected(new Set());
    setAnswered(false);
  };

  return (
    <main>
      <div className="scorebar">
        <span>連続正解: {streak}</span>
        <span>自己ベスト: {best}</span>
      </div>
      <p className="situation">
        {contextLabel(question)} — ついている役をすべて選んでください
        {question.tsumo && "（門前清自摸和は除く）"}
      </p>
      <Hand tiles={question.hand} drawn={question.winTile} />
      <div className="choices">
        {question.choices.map((name) => (
          <button
            key={name}
            type="button"
            className={`choice-btn${selected.has(name) ? " choice-selected" : ""}`}
            onClick={() => toggle(name)}
            disabled={answered}
          >
            {name}
          </button>
        ))}
      </div>
      {!answered ? (
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={submit}
            disabled={selected.size === 0}
          >
            答え合わせ
          </button>
        </div>
      ) : (
        <div className="panel">
          <p className={`result ${correct ? "result-ok" : "result-ng"}`}>
            {correct ? "正解!" : "不正解…"}
          </p>
          <div>
            {question.result.yaku
              .filter((y) => y.name !== "門前清自摸和")
              .map((y) => (
                <div key={y.name} className="ukeire-row">
                  <span>{y.name}</span>
                  <span className="ukeire-count">
                    {y.yakuman ? "役満" : `${y.han} 翻`}
                  </span>
                </div>
              ))}
          </div>
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
