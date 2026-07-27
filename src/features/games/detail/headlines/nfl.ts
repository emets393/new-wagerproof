/**
 * Deterministic headline sentences for the NFL detail widgets.
 *
 * These replace LLM-written verdicts, which got sign/attribution wrong (it once
 * said "model slightly favors Washington with a 3.3% edge" on a row where the
 * +3.3 belonged to the other side). Every function here is a pure function of
 * values the component has ALREADY DERIVED — never of raw DB columns — so the
 * headline cannot disagree with the widget it sits on top of.
 *
 * Returning null means "say nothing": WidgetCard hides the slot, which is always
 * preferable to a sentence we cannot stand behind.
 */

/** Signed line with at most one decimal ("-3.5", "+2", "-6.3"), em dash for null. */
export const formatLine = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const body = Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(1);
  return `${n < 0 ? '-' : '+'}${body}`;
};

/** Confidence at which the model is likely overreacting to one factor. */
export const FADE_ALERT_PCT = 80;

/** Confidence at or below which the card itself calls the pick a toss-up. */
const COIN_FLIP_PCT = 58;

/** A rounded 100 in prose reads as certainty; the meter can show it, a sentence can't. */
const clampConfidence = (pct: number): number => Math.max(50, Math.min(99, Math.round(pct)));

const oneDp = (value: number): number => Math.round(value * 10) / 10;

// ---------------------------------------------------------------------------
// Spread
// ---------------------------------------------------------------------------

export interface NflSpreadHeadlineInput {
  /** Abbrev of the side the model expects to cover (already chosen from cover prob). */
  teamAbbrev: string;
  /** Vegas spread FROM THE PICKED SIDE'S PERSPECTIVE. Negative = picked team favored. */
  vegasLine: number | null;
  /** Model probability the PICKED side covers, 0-100. Real model output, not a heuristic. */
  confidencePct: number;
  /**
   * Points of line value on the PICKED side. Already flipped for a road pick (see
   * NflPredictionsSection.tsx) — positive means value on the picked team whichever
   * side that is, so NEVER negate it again here.
   *
   * Permanently null for NFL: `nfl_predictions_epa` is a CLASSIFIER emitting cover /
   * OU probabilities only, with no model fair spread to compare against Vegas. The
   * edge branches below stay dormant here, and live for any other sport reusing this type.
   */
  pickEdge: number | null;
}

export function nflSpreadHeadline(v: NflSpreadHeadlineInput): string | null {
  const { teamAbbrev, vegasLine, pickEdge } = v;
  if (!teamAbbrev) return null;

  const pct = clampConfidence(v.confidencePct);
  // Drop the line token entirely when there is no posted number — formatLine's em
  // dash inside a sentence reads as punctuation, not as a missing value.
  const pick = vegasLine === null || vegasLine === undefined ? teamAbbrev : `${teamAbbrev} ${formatLine(vegasLine)}`;

  if (pickEdge === null) {
    // No model-vs-Vegas comparison available. Say only what we know — claiming the
    // model "has no line" would be a false statement about the model.
    return `Model expects ${pick} to cover at ${pct}%.`;
  }

  const edge = oneDp(pickEdge);
  const mag = Math.abs(edge).toFixed(1);
  // The model rates the TEAM stronger/weaker — keep the team as the subject, matching
  // the card's own footer (NflPredictionsSection.tsx:116-128). Saying the model's LINE
  // is "worse than Vegas" inverts it: a negative edge means the model's number is
  // numerically more generous, which is exactly why it is NO line value.
  const rating = edge >= 0 ? `${mag} pts stronger` : `${mag} pts weaker`;

  if (Math.abs(edge) < 0.05) {
    return `Model expects ${pick} to cover at ${pct}%, and its own line matches Vegas exactly.`;
  }
  if (pct >= FADE_ALERT_PCT) {
    return `Model is ${pct}% on ${pick} — unusually high; it rates ${teamAbbrev} ${rating} than Vegas.`;
  }
  if (pct <= COIN_FLIP_PCT) {
    return `Near coin flip: model leans ${pick} at just ${pct}%, rating ${teamAbbrev} ${rating} than Vegas.`;
  }
  if (edge >= 1) {
    return `Model backs ${pick} at ${pct}%, rating ${teamAbbrev} ${rating} than Vegas — line value.`;
  }
  if (edge > 0) {
    return `Model takes ${pick} at ${pct}%, rating ${teamAbbrev} a slim ${rating} than Vegas — line value.`;
  }
  return `Model takes ${pick} at ${pct}%, but rates ${teamAbbrev} ${rating} than Vegas — no line value.`;
}

// ---------------------------------------------------------------------------
// Total
// ---------------------------------------------------------------------------

export interface NflTotalHeadlineInput {
  /** true = the model's recommended side is the OVER (from ou_result_prob > 0.5). */
  isOver: boolean;
  /** Model probability the RECOMMENDED side hits, 0-100. */
  confidencePct: number;
  /** Vegas posted total. */
  vegasTotal: number | null;
  /**
   * over_line_diff re-signed to the recommended side (NflPredictionsSection.tsx).
   * Positive = the line gap backs the pick; negative = it argues against it.
   * Permanently null for NFL — the model emits an OU probability, not a fair total,
   * so there is nothing to difference. See NflSpreadHeadlineInput.pickEdge.
   */
  pickEdge: number | null;
  /** Model's absolute fair total (vegasTotal + UNFLIPPED diff) — valid for both sides. */
  modelTotal: number | null;
}

export function nflTotalHeadline(v: NflTotalHeadlineInput): string | null {
  const { isOver, vegasTotal, pickEdge, modelTotal } = v;
  const side = isOver ? 'OVER' : 'UNDER';
  const pct = clampConfidence(v.confidencePct);

  if (vegasTotal === null || vegasTotal === undefined || Number.isNaN(Number(vegasTotal))) {
    return `Model leans ${side} at ${pct}% confidence, with no posted total to compare against.`;
  }
  // Mirror the component's defensive Number() — over_line reaches us through `||`
  // fallbacks with no numeric coercion, so it can be a string from PostgREST.
  const vegas = Number(vegasTotal).toFixed(1);

  if (pickEdge === null || modelTotal === null || Number.isNaN(Number(modelTotal))) {
    return `Model leans ${side} on the ${vegas} total at ${pct}% confidence.`;
  }

  const model = Number(modelTotal).toFixed(1);
  const edge = oneDp(pickEdge);

  if (edge < -0.5) {
    // Contradictory row: the probability picks one side while the line gap points the
    // other way. State it rather than asserting an edge that does not exist.
    return `No ${isOver ? 'over' : 'under'} edge: model's ${model} sits ${isOver ? 'below' : 'above'} Vegas' ${vegas} despite a ${pct}% ${isOver ? 'over' : 'under'} lean.`;
  }
  if (pct <= COIN_FLIP_PCT) {
    return `Near coin flip: model projects ${model} vs Vegas' ${vegas}, only a ${pct}% lean to the ${side}.`;
  }
  if (Math.abs(edge) <= 0.5) {
    return `Model's ${model} is within half a point of Vegas' ${vegas} — no total edge, just a ${pct}% ${side} lean.`;
  }
  const strength = edge >= 3 ? 'strong' : 'slight';
  return `Model projects ${model} points vs Vegas' ${vegas} — a ${strength} ${edge.toFixed(1)}-point ${side} edge at ${pct}% confidence.`;
}

// ---------------------------------------------------------------------------
// Betting splits
// ---------------------------------------------------------------------------

export interface NflSplitRowInput {
  market: 'Moneyline' | 'Spread' | 'Total';
  /** Exactly the side string the row renders (team abbrev, raw parsed name, or OVER/UNDER). */
  side: string;
  /** True when the side came from total.direction, i.e. this is an OVER/UNDER row. */
  isDirection: boolean;
  /** matchTeam resolved the parsed name to a feed team. False on a team market ⇒ withhold. */
  resolvedTeam: boolean;
  isSharp: boolean;
  isPublic: boolean;
  /** The raw *_splits_label, used only to classify the lean and reject multi-side labels. */
  label: string;
}

export interface NflBettingSplitsHeadlineInput {
  rows: NflSplitRowInput[];
}

type LeanClass = 'sharp' | 'consensus' | 'public' | 'slight';

/**
 * `*_splits_label` is a small classifier vocabulary plus a side: "Consensus on X",
 * "Sharp Money on X", "Public on X", "Slight Lean on X", "Unclear". The three classes
 * mean materially different things (per the shipped legend in
 * wagerproof-ios-native/.../NFLPublicBettingBars.swift): Consensus = bets AND money on
 * that side; Sharp = public bets the other way but the money is here; Public = the money
 * is split and only casual BETS lean here. So a "Public" row must never be worded as a
 * money lean.
 */
const classify = (row: NflSplitRowInput): LeanClass | null => {
  const lower = row.label.toLowerCase();
  if (row.isSharp) return 'sharp';
  if (lower.includes('consensus')) return 'consensus';
  if (row.isPublic) return 'public';
  if (lower.includes('lean')) return 'slight';
  return null;
};

/**
 * The sharp/public flag is a whole-string scan while the side comes from one "on X"
 * clause, so a two-sided label ("Sharp on Green Bay, public on Chicago") attaches the
 * flag to the wrong team. Withhold rather than guess.
 */
const hasSingleSide = (label: string): boolean => (label.match(/\bon\s/gi) ?? []).length === 1;

const CLASS_RANK: Record<LeanClass, number> = { sharp: 0, consensus: 1, public: 2, slight: 3 };

export function nflBettingSplitsHeadline(v: NflBettingSplitsHeadlineInput): string | null {
  const usable = v.rows
    .map((row) => ({ row, lean: classify(row) }))
    .filter((entry): entry is { row: NflSplitRowInput; lean: LeanClass } => {
      if (entry.lean === null) return false;
      if (!entry.row.side) return false;
      if (!hasSingleSide(entry.row.label)) return false;
      // The parser tests for the substrings "over"/"under" before extracting a team, so
      // "cover" and "underdog" resolve a TEAM market to Over/Under. Only trust a team
      // market when matchTeam resolved it to a real feed team.
      if (!entry.row.isDirection && !entry.row.resolvedTeam) return false;
      return true;
    });

  if (usable.length === 0) return null;

  // Speak for the strongest signal, not for whichever market happens to be first.
  const lead = usable.reduce((best, entry) =>
    CLASS_RANK[entry.lean] < CLASS_RANK[best.lean] ? entry : best,
  );
  const market = lead.row.market.toLowerCase();
  const side = lead.row.side;

  switch (lead.lean) {
    case 'sharp':
      return `Sharp money is on ${side} in the ${market} — the public is betting the other way.`;
    case 'consensus':
      return `Bets and money both favor ${side} in the ${market}.`;
    case 'public':
      // Deliberately bets, not money: a "Public" label means the money is split.
      return `Casual bets lean ${side} in the ${market}, while the money stays split.`;
    case 'slight':
      return `Only a slight ${market} lean toward ${side}.`;
  }
}

// ---------------------------------------------------------------------------
// Head to head
// ---------------------------------------------------------------------------

export interface NflH2HHeadlineInput {
  loading: boolean;
  error: string | null;
  /** Number of meetings fetched — the "Last N" the card labels. */
  meetings: number;
  /**
   * Every fetched row is one of these two clubs. The section is mounted without a
   * per-game key and the hook never clears `games`, so a stale matchup can be in state
   * while home/away are the new teams — and the win buckets silently credit ALL of it
   * to the away side. Withhold unless this is true.
   */
  matchupVerified: boolean;
  homeName: string;
  awayName: string;
  /** Counts already bucketed onto TODAY's home/away team (site swaps resolved). */
  homeWins: number;
  awayWins: number;
  homeCovers: number;
  awayCovers: number;
  overs: number;
  unders: number;
}

export function nflH2HHeadline(v: NflH2HHeadlineInput): string | null {
  // `loading` starts false and only flips inside the effect, so an empty-and-idle state
  // is ambiguous: withhold on error/empty instead of asserting "no meetings".
  if (v.loading || v.error || v.meetings === 0 || !v.matchupVerified) return null;

  const plural = v.meetings === 1 ? '' : 's';
  const decided = v.homeWins + v.awayWins;
  if (decided === 0) {
    // Scores are compared with `?? 0`, so this means "no decisive result on file"
    // (a real 23-23 tie lands here too) — not necessarily missing data.
    return `The last ${v.meetings} ${v.awayName}–${v.homeName} meeting${plural} produced no decisive result on file.`;
  }

  const ouGraded = v.overs + v.unders;
  const ouClause =
    ouGraded > 0 && v.overs !== v.unders
      ? `, and the ${v.overs > v.unders ? 'Over' : 'Under'} has hit ${Math.max(v.overs, v.unders)} of ${ouGraded}`
      : '';

  if (v.homeWins === v.awayWins) {
    return `${v.awayName} and ${v.homeName} have split their last ${decided} decided meetings ${v.homeWins}-${v.awayWins}${ouClause}.`;
  }

  const homeLeads = v.homeWins > v.awayWins;
  const leaderName = homeLeads ? v.homeName : v.awayName;
  const leaderWins = Math.max(v.homeWins, v.awayWins);
  const trailWins = Math.min(v.homeWins, v.awayWins);
  const leaderCovers = homeLeads ? v.homeCovers : v.awayCovers;
  const coversGraded = v.homeCovers + v.awayCovers;
  // Only claim a sweep against the spread-graded subset — pushes are stored as -1 and
  // counted for neither side, so coversGraded is routinely smaller than `meetings`.
  const coverClause =
    coversGraded >= 3 && leaderCovers === coversGraded
      ? ` It also covered in all ${coversGraded} of the meetings with a graded spread.`
      : '';

  return `${leaderName} leads ${leaderWins}-${trailWins} over the last ${v.meetings} meeting${plural}${ouClause}.${coverClause}`;
}

// ---------------------------------------------------------------------------
// Line movement
// ---------------------------------------------------------------------------

/** The hook's empty-result sentinel; every other error string means the fetch failed. */
export const NO_LINE_MOVEMENT_ERROR = 'No line movement data available';

export interface NflLineMovementHeadlineInput {
  loading: boolean;
  error: string | null;
  /** False when raw.training_key is missing: the effect never ran, so state may be stale. */
  hasTrainingKey: boolean;
  /** Number of snapshots charted. */
  pointCount: number;
  /** active.label — the component's own attribution of the series ("PHI spread"/"Game total"). */
  seriesLabel: string;
  /** series === 'total'; totals print unsigned, spreads must print a sign. */
  isTotal: boolean;
  /** First non-null value of the SELECTED series (earliest recorded). */
  openValue: number | null;
  /** Last non-null value of the SELECTED series (current). */
  currentValue: number | null;
}

export function nflLineMovementHeadline(v: NflLineMovementHeadlineInput): string | null {
  if (v.loading || !v.hasTrainingKey) return null;
  if (v.error) {
    // A failed fetch is not evidence that no history exists, and the card already shows
    // the error — only the hook's empty-result sentinel is a real absence.
    return v.error === NO_LINE_MOVEMENT_ERROR
      ? 'No line history has been recorded for this game.'
      : null;
  }
  if (v.pointCount === 0) return null;
  if (v.openValue === null || v.currentValue === null) {
    return `No ${v.seriesLabel} recorded in this game's line history.`;
  }

  // toFixed drops the "+" on a dog line, and a bare "3.5" next to a team abbrev reads as
  // that team being a 3.5-point FAVORITE. Spreads get formatLine; totals stay unsigned.
  const show = (n: number) => (v.isTotal ? Number(n).toFixed(1) : formatLine(n));
  const open = show(v.openValue);
  const now = show(v.currentValue);
  const delta = oneDp(v.currentValue - v.openValue);

  if (Math.abs(delta) < 0.05) {
    return `${v.seriesLabel} has not moved off ${open} since the first recorded line.`;
  }
  if (v.isTotal) {
    return `Total has moved ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)} points, from ${open} at the first recorded line to ${now} now.`;
  }
  // Deliberately no "toward X"/"away from X": bettors read that phrase both ways
  // (a dog getting more points moved in its backers' favor). The two numbers carry it.
  return `${v.seriesLabel} has moved ${Math.abs(delta).toFixed(1)} points, from ${open} at the first recorded line to ${now} now.`;
}
