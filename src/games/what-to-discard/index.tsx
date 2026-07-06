import { useMemo, useState } from "react";
import { Hand } from "../../components/Hand";
import { Tile } from "../../components/Tile";
import {
  discardOptions,
  parseHand,
  sortTiles,
  type TileId,
  tileKind,
  tileName,
} from "../../core";
import { problems } from "./problems";

export default function WhatToDiscard() {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<TileId | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const problem = problems[index];
  const hand = useMemo(() => sortTiles(parseHand(problem.hand)), [problem]);
  const options = useMemo(
    () => discardOptions([...hand, problem.draw]),
    [hand, problem],
  );
  const bestKinds = useMemo(
    () => new Set(options.filter((o) => o.best).map((o) => tileKind(o.tile))),
    [options],
  );

  const pick = (i: number) => {
    if (picked !== null) return;
    const tile = i < hand.length ? hand[i] : problem.draw;
    setPicked(tile);
    if (bestKinds.has(tileKind(tile))) {
      setCorrectCount((n) => n + 1);
    }
  };

  const next = () => {
    if (index + 1 >= problems.length) {
      setFinished(true);
    } else {
      setIndex(index + 1);
      setPicked(null);
    }
  };

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <main className="finished">
        <p>全 {problems.length} 問の結果</p>
        <p className="big">
          {correctCount} / {problems.length}
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={restart}>
            もう一度
          </button>
        </div>
      </main>
    );
  }

  const isCorrect = picked !== null && bestKinds.has(tileKind(picked));
  const bestTiles = [
    ...new Set(options.filter((o) => o.best).map((o) => o.tile)),
  ];

  return (
    <main>
      <div className="scorebar">
        <span>
          第 {index + 1} 問 / {problems.length}
        </span>
        <span>正解: {correctCount}</span>
      </div>
      <p className="situation">{problem.situation} さて、何を切る?</p>
      <Hand
        tiles={hand}
        drawn={problem.draw}
        onTileClick={picked === null ? pick : undefined}
        disabled={picked !== null}
      />
      {picked !== null && (
        <div className="panel">
          <p className={`result ${isCorrect ? "result-ok" : "result-ng"}`}>
            {isCorrect ? "正解!" : "不正解…"}
          </p>
          <p>
            あなたの選択: {tileName(picked)} ／ 最善:{" "}
            <span className="tile-row">
              {bestTiles.map((tile) => (
                <Tile key={tile} id={tile} small />
              ))}
            </span>
          </p>
          <div>
            {options.slice(0, 4).map((option) => (
              <div key={option.tile} className="ukeire-row">
                <Tile id={option.tile} small />
                <span>切り</span>
                <span className="ukeire-count">
                  {option.shanten === 0
                    ? "テンパイ"
                    : `${option.shanten} シャンテン`}
                  ・受け入れ {option.total} 枚
                </span>
              </div>
            ))}
          </div>
          <p>{problem.commentary}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={next}>
              {index + 1 >= problems.length ? "結果を見る" : "次の問題"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
