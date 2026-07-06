import { useMemo, useState } from "react";
import { Hand } from "../../components/Hand";
import { Tile } from "../../components/Tile";
import {
  NUMBER_SUITS,
  type TenpaiHand,
  type TileId,
  tileKind,
  tileSuit,
} from "../../core";

export interface MachiQuizGameProps {
  /** テンパイ形の生成関数 */
  generate: () => TenpaiHand;
  /** 連続正解記録の localStorage キー */
  storageKey: string;
  /** 問題文 */
  prompt: string;
}

/** 手牌に含まれるスート・字牌から回答キーボードの牌一覧を作る */
function keyboardTiles(hand: readonly TileId[]): TileId[][] {
  const suits = new Set(hand.map((t) => tileSuit(t)));
  const rows: TileId[][] = [];
  for (const suit of NUMBER_SUITS) {
    if (!suits.has(suit)) continue;
    rows.push(Array.from({ length: 9 }, (_, i) => `${suit}${i + 1}` as TileId));
  }
  const honors = [...new Set(hand.filter((t) => tileSuit(t) === "z"))].sort();
  if (honors.length > 0) rows.push(honors);
  return rows;
}

/** 待ち当てクイズの共通実装（通常版・清一色版で共用） */
export function MachiQuizGame({
  generate,
  storageKey,
  prompt,
}: MachiQuizGameProps) {
  const [quiz, setQuiz] = useState<TenpaiHand>(generate);
  const [selected, setSelected] = useState<Set<TileId>>(new Set());
  const [answered, setAnswered] = useState(false);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(
    () => Number(localStorage.getItem(storageKey)) || 0,
  );

  const rows = useMemo(() => keyboardTiles(quiz.tiles), [quiz]);
  const waitSet = useMemo(() => new Set(quiz.waits), [quiz]);
  const correct =
    selected.size === waitSet.size &&
    [...selected].every((t) => waitSet.has(t));

  const toggle = (tile: TileId) => {
    if (answered) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tile)) next.delete(tile);
      else next.add(tile);
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
        localStorage.setItem(storageKey, String(next));
      }
    } else {
      setStreak(0);
    }
  };

  const next = () => {
    setQuiz(generate());
    setSelected(new Set());
    setAnswered(false);
  };

  return (
    <main>
      <div className="scorebar">
        <span>連続正解: {streak}</span>
        <span>自己ベスト: {best}</span>
      </div>
      <p className="situation">{prompt}</p>
      <Hand tiles={quiz.tiles} />
      <p className="situation">待ち牌をすべて選んで「答え合わせ」</p>
      {rows.map((row) => (
        <div key={row[0]} className="tile-row keyboard-row">
          {row.map((tile) => (
            <Tile
              key={tile}
              id={tile}
              small
              selected={selected.has(tile)}
              onClick={() => toggle(tile)}
              disabled={answered}
            />
          ))}
        </div>
      ))}
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
          <p>
            待ち:{" "}
            <span className="tile-row">
              {quiz.waits.map((tile) => (
                <Tile key={tile} id={tile} small />
              ))}
            </span>{" "}
            の {quiz.waits.length} 種
          </p>
          {!correct && (
            <p>
              あなたの解答:{" "}
              <span className="tile-row">
                {[...selected]
                  .sort((a, b) => tileKind(a) - tileKind(b))
                  .map((tile) => (
                    <Tile key={tile} id={tile} small />
                  ))}
              </span>
            </p>
          )}
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
