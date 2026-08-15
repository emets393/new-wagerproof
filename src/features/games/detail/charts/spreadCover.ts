/**
 * Everything a spread pick needs in order to explain itself, derived from two
 * numbers: the pick team's line and the model's projected margin for them.
 *
 * ## Why this exists
 * A spread card used to show "+4.5" beside "-2.1" and leave the reader to
 * reconcile them. They look like they straddle zero and therefore contradict
 * each other; they don't, because one is a *line* and the other is a *margin*
 * and the sign convention flips between the two. Everything here works in
 * MARGIN — "the pick team's final points minus their opponent's" — so nothing
 * is ever the negative of a negative.
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
   * winning. On a dryrun row this is `-model_line`, because `model_line` is the
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
   * The line as a signed LINE (not a margin) — half values are legitimate here,
   * which is why nothing else in this object prints it.
   */
  signedLine: string;
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
    signedLine: line >= 0 ? `+${lineMagnitude}` : `−${lineMagnitude}`,
  };
}

/**
 * The push outcome for the tick's own caption, which already carries the word
 * PUSH above it — so "exactly" is redundant there and only costs the width that
 * makes "Lose by exactly 3" ellipsize inside an 84px label.
 * `pushCondition` keeps the long form for prose and the accessibility summary.
 */
export function pushMarginLabel(outcome: SpreadCoverOutcome): string | null {
  const push = outcome.pushMargin;
  if (push === null) return null;
  if (push > 0) return `Win by ${push}`;
  if (push < 0) return `Lose by ${-push}`;
  return 'Tie';
}

/**
 * Screen-reader summary: what has to happen, what pushes, where the model lands,
 * how much room that leaves. Same facts as the graphic, in one sentence.
 */
export function spreadCoverSummary(outcome: SpreadCoverOutcome): string {
  const parts = [`Covers if ${outcome.coverCondition}. Loses if ${outcome.loseCondition}.`];
  if (outcome.pushCondition) parts.push(`${outcome.pushCondition} pushes.`);
  parts.push(`Model projects ${outcome.modelCondition.toLowerCase()},`);
  const room = formatMargin(Math.abs(outcome.cushion));
  parts.push(outcome.covers ? `${room} points of room.` : `${room} points short.`);
  return parts.join(' ');
}
