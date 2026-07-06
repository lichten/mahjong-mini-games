import type { TileId } from "../core";
import { tileName } from "../core";

// 牌 SVG を一括インポート。絵柄は透過背景なので front.svg を下に重ねる
const tileUrls = import.meta.glob("../assets/tiles/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function urlOf(name: string): string {
  const url = tileUrls[`../assets/tiles/${name}.svg`];
  if (!url) throw new Error(`牌画像が見つかりません: ${name}`);
  return url;
}

export interface TileProps {
  id: TileId;
  onClick?: () => void;
  /** 選択中の強調表示 */
  selected?: boolean;
  /** タップ不可（表示のみ） */
  disabled?: boolean;
  /** 裏向きで表示 */
  faceDown?: boolean;
  /** 小さめ表示（解説内の牌など） */
  small?: boolean;
}

/** 牌 1 枚。onClick があればボタンとして描画する */
export function Tile({
  id,
  onClick,
  selected,
  disabled,
  faceDown,
  small,
}: TileProps) {
  const layers = faceDown
    ? `url(${urlOf("back")})`
    : `url(${urlOf(id)}), url(${urlOf("front")})`;
  const className = `tile${selected ? " tile-selected" : ""}${small ? " tile-small" : ""}`;
  const label = faceDown ? "裏向きの牌" : tileName(id);

  if (!onClick) {
    return (
      <span
        className={className}
        style={{ backgroundImage: layers }}
        role="img"
        aria-label={label}
      />
    );
  }
  return (
    <button
      type="button"
      className={className}
      style={{ backgroundImage: layers }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    />
  );
}
