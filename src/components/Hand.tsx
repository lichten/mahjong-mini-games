import type { TileId } from "../core";
import { Tile } from "./Tile";

export interface HandProps {
  tiles: readonly TileId[];
  /** ツモ牌。指定すると右端に間隔を空けて表示する */
  drawn?: TileId;
  /** 牌タップ時。index は tiles 内の位置、ツモ牌は tiles.length */
  onTileClick?: (index: number) => void;
  selectedIndex?: number;
  disabled?: boolean;
}

/** 手牌の並び表示。13 枚 + ツモ牌のレイアウトに対応する */
export function Hand({
  tiles,
  drawn,
  onTileClick,
  selectedIndex,
  disabled,
}: HandProps) {
  return (
    <div className="hand">
      {tiles.map((tile, i) => (
        <Tile
          // biome-ignore lint/suspicious/noArrayIndexKey: 同一牌が複数あり牌自体は key にできない。理牌済みで並びは安定している
          key={`${tile}-${i}`}
          id={tile}
          onClick={onTileClick ? () => onTileClick(i) : undefined}
          selected={selectedIndex === i}
          disabled={disabled}
        />
      ))}
      {drawn && (
        <>
          <span className="hand-gap" />
          <Tile
            id={drawn}
            onClick={onTileClick ? () => onTileClick(tiles.length) : undefined}
            selected={selectedIndex === tiles.length}
            disabled={disabled}
          />
        </>
      )}
    </div>
  );
}
