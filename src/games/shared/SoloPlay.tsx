import { type ReactNode, useMemo, useState } from "react";
import { Hand } from "../../components/Hand";
import { Tile } from "../../components/Tile";
import {
  doraKindFromIndicator,
  isRedFive,
  scoreHand,
  sortTiles,
  type TileId,
  tileKind,
} from "../../core";

export interface SoloDeal {
  /** 配牌 13 枚（理牌済み） */
  hand: TileId[];
  /** 残りの山（先頭からツモる。最後の 1 枚はドラ表示牌） */
  wall: TileId[];
}

export interface SoloPlayProps {
  deal: () => SoloDeal;
  /** ツモできる回数 */
  maxDraws: number;
  /** この 14 枚で和了できるか（ゲームごとの制限を含む） */
  canWin: (hand14: TileId[]) => boolean;
  /** 手牌の下に出す進捗表示 */
  statusLine: (hand13: TileId[]) => string;
  /** 流局時のメッセージ */
  loseMessage?: string;
}

interface SoloState {
  hand: TileId[];
  wall: TileId[];
  pos: number;
  turn: number;
  river: TileId[];
}

function initialState(deal: () => SoloDeal): SoloState {
  const { hand, wall } = deal();
  return { hand, wall, pos: 0, turn: 1, river: [] };
}

/** ドラ枚数（表示牌 1 枚 + 赤 5） */
function countDora(hand14: readonly TileId[], indicator: TileId): number {
  const doraKind = doraKindFromIndicator(indicator);
  let count = 0;
  for (const tile of hand14) {
    if (tileKind(tile) === doraKind) count++;
    if (isRedFive(tile)) count++;
  }
  return count;
}

/**
 * 一人打ちの共通エンジン。
 * ツモ → 打牌を繰り返し、canWin を満たしたら自動でツモ和了になる。
 */
export function SoloPlay({
  deal,
  maxDraws,
  canWin,
  statusLine,
  loseMessage,
}: SoloPlayProps) {
  const [state, setState] = useState<SoloState>(() => initialState(deal));

  const indicator = state.wall[state.wall.length - 1];
  const drawn = state.wall[state.pos];
  const hand14 = useMemo(() => [...state.hand, drawn], [state, drawn]);
  const finished = state.turn > maxDraws;
  const won = !finished && canWin(hand14);

  const discard = (index: number) => {
    if (won || finished) return;
    const rest = [...hand14];
    const [thrown] = rest.splice(index, 1);
    setState((s) => ({
      ...s,
      hand: sortTiles(rest),
      river: [...s.river, thrown],
      pos: s.pos + 1,
      turn: s.turn + 1,
    }));
  };

  const restart = () => setState(initialState(deal));

  let content: ReactNode;
  if (won) {
    const result = scoreHand(hand14, {
      winTile: drawn,
      tsumo: true,
      dealer: false,
      doraCount: countDora(hand14, indicator),
    });
    content = (
      <div className="panel">
        <p className="result result-ok">ツモ和了! （{state.turn} 巡目）</p>
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
        <p>
          <strong>
            {result.yakuman > 0
              ? `${result.score.rank} ${result.score.payments} 点`
              : `${result.fu} 符 ${result.han} 翻 ${result.score.payments} 点`}
          </strong>
          {result.yakuman === 0 &&
            result.score.rank &&
            `（${result.score.rank}）`}
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={restart}>
            もう一度
          </button>
        </div>
      </div>
    );
  } else if (finished) {
    content = (
      <div className="panel">
        <p className="result result-ng">{loseMessage ?? "流局…"}</p>
        <p>{statusLine(state.hand)}</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={restart}>
            もう一度
          </button>
        </div>
      </div>
    );
  }

  return (
    <main>
      <div className="scorebar">
        <span>
          {Math.min(state.turn, maxDraws)} / {maxDraws} 巡目
        </span>
        <span className="tile-row">
          ドラ表示: <Tile id={indicator} small />
        </span>
      </div>
      {state.river.length > 0 && (
        <div className="tile-row river">
          {state.river.map((tile, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 河は追記のみで並びが変わらない
            <Tile key={`${tile}-${i}`} id={tile} small />
          ))}
        </div>
      )}
      <p className="situation">
        {won || finished ? "" : statusLine(state.hand)}
      </p>
      <Hand
        tiles={state.hand}
        drawn={finished ? undefined : drawn}
        onTileClick={won || finished ? undefined : discard}
        disabled={won || finished}
      />
      {content}
    </main>
  );
}
