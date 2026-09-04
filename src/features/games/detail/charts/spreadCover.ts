/**
 * Everything a spread pick needs in order to explain itself, derived from two
 * numbers: the pick team's line and the model's projected margin for them.
 *
 * ## One unit, end to end: the final margin
 * Every number here is a MARGIN — the points between the two teams when the
 * game ends. The break-even, the model's projection, the push and the
 * cover/lose conditions all live in that single unit, so no label can
 * contradict another.
 *
 * An earlier cut plotted pick-side *lines* on the axis while the captions kept
 * speaking margin, and those two conventions carry opposite signs: the same
 * projection printed as "+0.3" on the bar and "losing by 0.3" in the sentence
 * above it. The axis direction inverted too — a bigger line means the market
 * rates the team WORSE — so the covering half of the bar landed under the
 * opponent's abbreviation.
 *
 * ## Half points can't happen, whole points can push
 * A final margin is always a whole number. So:
 * - **Half-point line** (+4.5): no margin lands on the threshold, so there is no
 *   push. The bet is a clean win/lose at a boundary between two integers.
 * - **Whole-point line** (+3): a margin CAN land exactly on the threshold, and
 *   that outcome is a push — the stake comes back.
 *
 * Getting this wrong is not cosmetic. On a +3 dog, "covers unless they lose by 4
 * or more" implies a 3-point loss wins; it actually pushes.
 *
 * Port of `WagerproofDesign/Components/SpreadCoverBar.swift`'s
 * `SpreadCoverOutcome` — keep the two in step.
 */

/** Integers bare, everything else to one decimal. Mirrors the Swift formatter. */
export function formatMargin(value: number): string {
  return Math.round(value) === value ? String(Math.round(value)) : value.toFixed(1);
}

export interface SpreadCoverOutcome {
  /**
   * The pick team's line from ITS OWN perspective: `+4.5` = receiving 4.5,
   * `-10` = laying 10.
   */
  line: number;
  /**
   * The pick team's projected final margin — positive means the model has them
   * winning. On a slate row this is `-model_line`, because `model_line` is the
   * team's fair *spread*.
   */
  modelMargin: number;

  /** The margin the game has to beat for the bet to cover. */
  threshold: number;
  /** Smallest whole margin that COVERS. */
  coverMin: number;
  /** Largest whole margin that LOSES. */
  loseMax: number;
  /** The one margin that pushes, or null on a half-point line. */
  pushMargin: number | null;
  hasPush: boolean;
  /**
   * How far the model's projection sits past the break-even — the points of
   * margin for error the bet has if the model is right. Negative means the model
   * does not think this pick covers at all.
   */
  cushion: number;
  covers: boolean;

  // Copy, all phrased as whole-number outcomes because that is what a final
  // score can actually be.
  coverCondition: string;
  loseCondition: string;
  pushCondition: string | null;
  modelCondition: string;
  /**
   * The line as a signed LINE (not a margin) — half values are legitimate here.
   * Printed on the market chip, never on the axis.
   */
  signedLine: string;
  /**
   * The model's fair LINE for the pick team — same units as `line`.
   * `−modelMargin`: a projected lose-by-7.4 becomes `+7.4`. Kept for the
   * market-versus-fair-number row; deliberately NOT plotted, because a line and
   * a margin cannot share an axis.
   */
  modelFairLine: number;
  /** Signed fair line for line-space copy (`+7.4`, `−3.5`, `PK`). */
  signedModelFairLine: string;
}

/**
 * Auto-fit window for the MARGIN axis: the break-even, the model's projection,
 * and a tie when one is close enough to be worth anchoring to.
 *
 * The window is deliberately narrow. A ±21-point college axis for a 2-point
 * lean spends all its width on scores nobody is arguing about and squeezes the
 * only two numbers that matter into a few pixels.
 */
export function spreadMarginAxisDomain(
  threshold: number,
  modelMargin: number,
  /** `EdgeScale.spreadWindow` — the sport's sense of how big a margin is. */
  spreadWindow: number,
): { min: number; max: number; ticks: number[] } {
  /** Runs are not points: MLB's floor has to be an order tighter than the NFL's. */
  const minPad = Math.max(spreadWindow * 0.15, 0.5);
  const low = Math.min(threshold, modelMargin);
  const high = Math.max(threshold, modelMargin);
  const gap = high - low;
  const pad = Math.max(gap * 0.55, minPad);
  let lo = low - pad;
  let hi = high + pad;

  // TIE is the cheapest orientation anchor on the chart, so reach for it when
  // it is already just off an edge — but never drag the window across a blowout
  // line to go get it.
  if (lo > 0 && lo <= pad) lo = -minPad * 0.2;
  if (hi < 0 && -hi <= pad) hi = minPad * 0.2;

  // Two markers a tenth of a point apart on a six-point window are one marker.
  // Tighten the window until the gap is a readable share of it.
  const minMarkerFraction = 0.2;
  const span = hi - lo;
  if (span > 0 && gap / span < minMarkerFraction) {
    const target = Math.max(gap / minMarkerFraction, minPad * 2);
    if (target < span) {
      const mid = (threshold + modelMargin) / 2;
      lo = mid - target / 2;
      hi = mid + target / 2;
    }
  }

  return { min: lo, max: hi, ticks: axisTicks(lo, hi) };
}

/**
 * Gradations on a round step, sized to the window rather than to the sport.
 * Fixed tick lists cannot work here: the window auto-fits, so a 3/7/10 set
 * leaves a zoomed-in chart with no labels at all and nothing to orient by.
 */
function axisTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  if (span <= 0) return [];
  const step = niceStep(span / 4);
  // Keep a tick a comfortable distance inside the window so its label is not
  // half off the end of the bar.
  const inset = step * 0.15;
  const first = Math.ceil((lo + inset) / step) * step;
  const ticks: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    const value = first + i * step;
    if (value > hi - inset) break;
    ticks.push(Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(4)));
  }
  return ticks;
}

/** 1, 2, 2.5, 5 or 10 times a power of ten — the smallest that clears `raw`. */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-6)));
  for (const multiple of [1, 2, 2.5, 5]) {
    if (magnitude * multiple >= raw) return magnitude * multiple;
  }
  return magnitude * 10;
}

export function spreadCoverOutcome(line: number, modelMargin: number): SpreadCoverOutcome {
  const threshold = -line;
  const coverMin = Math.floor(threshold) + 1;
  const loseMax = Math.ceil(threshold) - 1;
  // A whole-point threshold is a margin a game can actually land on, so it is a
  // push. `Object.is` guard: -0 is integral but must print as "Tie", not "-0".
  const rounded = Math.round(threshold);
  const pushMargin = Number.isInteger(threshold) ? (Object.is(rounded, -0) ? 0 : rounded) : null;
  const cushion = modelMargin - threshold;

  const coverCondition =
    coverMin > 0
      ? `Win by ${coverMin}+`
      : coverMin === 0
        ? 'Win or tie'
        : `Lose by ${-coverMin} or less, tie, or win`;

  const loseCondition =
    loseMax < 0
      ? `Lose by ${-loseMax}+`
      : loseMax === 0
        ? 'Tie or lose'
        : `Win by ${loseMax} or less, tie, or lose`;

  const pushCondition =
    pushMargin === null
      ? null
      : pushMargin > 0
        ? `Win by exactly ${pushMargin}`
        : pushMargin === 0
          ? 'Tie'
          : `Lose by exactly ${-pushMargin}`;

  const magnitude = formatMargin(Math.abs(modelMargin));
  const modelCondition =
    modelMargin > 0 ? `Win by ${magnitude}` : modelMargin < 0 ? `Lose by ${magnitude}` : 'Dead even';

  const lineMagnitude = formatMargin(Math.abs(line));
  const modelFairLine = -modelMargin;
  const modelFairMagnitude = formatMargin(Math.abs(modelFairLine));
  const signedModelFairLine =
    modelFairLine === 0
      ? 'PK'
      : modelFairLine > 0
        ? `+${modelFairMagnitude}`
        : `−${modelFairMagnitude}`;

  return {
    line,
    modelMargin,
    threshold,
    coverMin,
    loseMax,
    pushMargin,
    hasPush: pushMargin !== null,
    cushion,
    covers: cushion > 0,
    coverCondition,
    loseCondition,
    pushCondition,
    modelCondition,
    signedLine: line === 0 ? 'PK' : line > 0 ? `+${lineMagnitude}` : `−${lineMagnitude}`,
    modelFairLine,
    signedModelFairLine,
  };
}

/**
 * A margin spoken as a lead: whose, and by how much. Used by the break-even /
 * model captions (`LA by 3.5`), not the axis ticks.
 */
export function marginLabel(
  margin: number,
  pickAbbrev?: string | null,
  opponentAbbrev?: string | null,
  verbose = false,
): string {
  if (margin === 0) return verbose ? 'Tie' : 'TIE';
  const magnitude = formatMargin(Math.abs(margin));
  const team = margin > 0 ? pickAbbrev : opponentAbbrev;
  if (!team) return margin > 0 ? `+${magnitude}` : `−${magnitude}`;
  return verbose ? `${team} by ${magnitude}` : `${team} ${magnitude}`;
}

/**
 * Axis tick: the pick team's line at that score. Winning by 4 is `LA −4`;
 * losing by 4 is `LA +4`. Same team on every tick so the sign is the thing
 * that moves, matching how a betting line is written.
 */
export function spreadTickLabel(margin: number, pickAbbrev?: string | null): string {
  if (margin === 0) return 'TIE';
  const line = -margin;
  const magnitude = formatMargin(Math.abs(line));
  const signed = line > 0 ? `+${magnitude}` : `−${magnitude}`;
  return pickAbbrev ? `${pickAbbrev} ${signed}` : signed;
}

/**
 * Screen-reader summary: where the break-even sits, where the model lands, what
 * has to happen, what pushes, how much room that leaves. Same facts as the
 * graphic and in the same unit, in one sentence.
 */
export function spreadCoverSummary(
  outcome: SpreadCoverOutcome,
  pickAbbrev?: string | null,
  opponentAbbrev?: string | null,
): string {
  const parts = [
    `Break-even at ${marginLabel(outcome.threshold, pickAbbrev, opponentAbbrev, true)}.`,
    `Model projects ${marginLabel(outcome.modelMargin, pickAbbrev, opponentAbbrev, true)}.`,
    `Covers if ${outcome.coverCondition}. Loses if ${outcome.loseCondition}.`,
  ];
  if (outcome.pushCondition) parts.push(`${outcome.pushCondition} pushes.`);
  const room = formatMargin(Math.abs(outcome.cushion));
  parts.push(outcome.covers ? `${room} points of room.` : `${room} points short.`);
  return parts.join(' ');
}
