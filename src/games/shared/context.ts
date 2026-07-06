/** 出題時の場況表示の共通ヘルパー */

export const WIND_LABELS = ["東", "南", "西", "北"];

export interface QuestionContext {
  tsumo: boolean;
  dealer: boolean;
  seatWind: 1 | 2 | 3 | 4;
  roundWind: 1 | 2;
  doraCount: number;
}

export function contextLabel(ctx: QuestionContext): string {
  const seat = `${WIND_LABELS[ctx.seatWind - 1]}家${ctx.dealer ? "(親)" : "(子)"}`;
  const round = `${WIND_LABELS[ctx.roundWind - 1]}場`;
  const win = ctx.tsumo ? "ツモ" : "ロン";
  return `${round}・${seat}・${win}・ドラ ${ctx.doraCount}`;
}
