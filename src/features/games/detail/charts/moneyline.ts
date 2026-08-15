import type { EdgeScale } from './edgeScale';

/**
 * What a moneyline price needs to be true, versus what the model thinks is true.
 *
 * ## The framing
 * A price IS a required win rate. `+180` needs the bet to land 35.7% of the time
 * to break even; `-198` needs 66.4%. So a moneyline card asks the same question
 * as a spread card — "what has to happen, and where does the model land" — just
 * measured in win probability instead of points.
 *
 * ## No de-vigging, deliberately
 * The break-even rate at a price is exactly that price's RAW implied
 * probability. De-vigging would produce a number that answers a different
 * question ("what does the market think") and would no longer be the bar this
 * bet has to clear. It would also reintroduce the reconciliation problem
 * `WIDGET_DESIGN.md` rule 10 warns about, where a marginally more "correct"
 * figure visibly contradicts the headline above it.
 *
 * Port of `WagerproofDesign/Components/MoneylineEdgeBar.swift`'s
 * `MoneylineOutcome` — keep the two in step.
 */

/**
 * The win rate a price has to clear to be profitable, as a percentage.
 *
 * Negative odds: risk `|price|` to win 100. Positive: risk 100 to win `price`.
 * Both reduce to stake / (stake + profit).
 */
export function breakEvenPercent(price: number): number {
  return price < 0 ? (-price / (-price + 100)) * 100 : (100 / (price + 100)) * 100;
}

export interface MoneylineOutcome {
  /** American odds for the side being bet. */
  price: number;
  /** The model's win probability for that side, 0-1. */
  modelProbability: number;
  breakEvenPercent: number;
  modelPercent: number;
  /** Percentage points of edge. Positive = the model says this price is worth taking. */
  edge: number;
  isPositiveValue: boolean;
  /** 0 = strongly negative … 2 = no edge … 4 = strong value. */
  zoneIndex: number;
  zoneTitle: string;
}

const ZONE_TITLES = ['Strong Fade', 'Slight Overlay', 'No Edge', 'Value', 'Strong Value'];

export function moneylineOutcome(
  price: number,
  modelProbability: number,
  scale: EdgeScale,
): MoneylineOutcome {
  const breakEven = breakEvenPercent(price);
  const modelPercent = modelProbability * 100;
  const edge = modelPercent - breakEven;

  const magnitude = Math.abs(edge);
  let zoneIndex: number;
  if (magnitude < scale.moneylineLean) {
    zoneIndex = 2;
  } else {
    const strong = magnitude >= scale.moneylineStrong;
    zoneIndex = edge < 0 ? (strong ? 0 : 1) : strong ? 4 : 3;
  }

  return {
    price,
    modelProbability,
    breakEvenPercent: breakEven,
    modelPercent,
    edge,
    isPositiveValue: edge > 0,
    zoneIndex,
    zoneTitle: ZONE_TITLES[zoneIndex],
  };
}

/** American price with an explicit sign, the way every book prints it. */
export function formatAmericanOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}
