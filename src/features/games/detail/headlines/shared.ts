/**
 * Deterministic headline formatters for the widgets that CFB/NCAAB/NBA share
 * (Market Odds, Match Simulator) plus the two college model cards.
 *
 * These replace the LLM-written `headlines[...]` strings, which repeatedly got
 * side attribution backwards (e.g. calling a −3.3 home edge "+3.3 for the home
 * team"). Every function here is a pure function of values the component has
 * ALREADY derived — never of a raw DB column — so a headline cannot disagree
 * with the numbers rendered underneath it.
 *
 * Rule for anyone extending this file: if the sign/side has not already been
 * resolved by the component, do NOT resolve it here. Return null instead.
 */

import { roundToHalf } from '../edgeExplanations';

/** Guard so no template can ever interpolate NaN/Infinity. */
function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function pts(n: number): string {
  return `${n} ${n === 1 ? 'point' : 'points'}`;
}

// ---------------------------------------------------------------------------
// Market Odds (Polymarket) — MarketOddsChart / MarketOddsSection
// ---------------------------------------------------------------------------

export interface MarketOddsHeadlineInput {
  /** The market actually being plotted (MarketOddsChart's `activeKey`). */
  marketKey: 'moneyline' | 'spread' | 'total' | undefined;
  /** Implied probability of the LEADING tile — `aLeads ? a : b` (MarketOddsChart.tsx:104). */
  leaderPct: number | null;
  /** Implied probability of the other tile. */
  trailPct: number | null;
  /** Oldest plotted value for the SAME side as leaderPct, or null when unknown. */
  leaderOpenPct: number | null;
}

/**
 * Polymarket verdict for the Market Odds card.
 *
 * Deliberately NAMES NO SIDE. `currentAwayOdds` / `awayTeamOdds` are misnomers:
 * they hold the YES / clobTokenIds[0] price (polymarketService.ts always calls
 * transformPriceHistory with isAwayTeam=true), and findMatchingEvent accepts a
 * home-first event title without flipping the series — so which real team the
 * "away" series belongs to is unresolved in the client. Prose that named a team
 * would invert exactly as often as the data does. The card's own tiles carry the
 * labels; the headline only characterises how decisive the market is.
 *
 * Spread and total return null: those markets are picked by first question/slug
 * text match, so neither the side nor the line is known (an alt line is
 * possible), and Over/Under orientation is assumed rather than parsed.
 */
export function marketOddsHeadline(v: MarketOddsHeadlineInput): string | null {
  if (v.marketKey !== 'moneyline') return null;
  if (!isNum(v.leaderPct) || !isNum(v.trailPct)) return null;

  const leader = Math.round(v.leaderPct);
  const trail = Math.round(v.trailPct);
  if (leader < 0 || leader > 100 || trail < 0 || trail > 100) return null;

  // The two sides are integer complements by construction (Math.round + 100−p),
  // so the "no clear favorite" band can realistically only be 50/50 or 51/49.
  if (Math.abs(v.leaderPct - v.trailPct) < 4) {
    return `Polymarket has no clear moneyline favorite — the two sides are priced ${leader}% and ${trail}%.`;
  }

  // Movement is measured within one side's own series (leader vs that side's
  // first plotted point), so it can't mix a percent from one side with a point
  // from the other. "Tracked history" rather than "since the market opened":
  // points[0] is just the oldest sample the API/cron happened to return.
  let move = '';
  if (isNum(v.leaderOpenPct)) {
    const delta = Math.round(v.leaderPct - v.leaderOpenPct);
    if (delta >= 5) move = `, up ${delta} pts over the tracked history`;
    else if (delta <= -5) move = `, down ${Math.abs(delta)} pts over the tracked history`;
  }

  return `Polymarket prices this moneyline ${leader}% / ${trail}% — the favored side is highlighted below${move}.`;
}

// ---------------------------------------------------------------------------
// Match Simulator — MatchSimulatorSection (NBA + NCAAB)
// ---------------------------------------------------------------------------

/** Minimum unrounded separation before a projected winner is asserted. */
const SIM_MIN_SEPARATION = 1;

export interface MatchSimulatorHeadlineInput {
  /** Local UI state: the score is hidden until the user taps Simulate. */
  revealed: boolean;
  loading: boolean;
  awayName: string;
  homeName: string;
  /** UNROUNDED projected scores from the component's own `simScore(side)`. */
  awayScore: number | null;
  homeScore: number | null;
}

/**
 * Projected-score verdict for the Match Simulator.
 *
 * Two safety properties: (1) scores are attached to teams only via the
 * component's 'away'/'home' keyed lookup, so they can't be swapped; (2) no
 * signed edge/diff column is consulted, so the favored-vs-has-edge confusion
 * class doesn't apply. It also stays adjective-free — the card has no interval
 * and no win probability, and "comfortably" would read as bet strength next to
 * the spread card's value pick, which is routinely the other team.
 */
export function matchSimulatorHeadline(v: MatchSimulatorHeadlineInput): string | null {
  // Nothing to project → no headline in any state (the card renders "-").
  if (!isNum(v.awayScore) || !isNum(v.homeScore)) return null;

  // Pre-reveal branches must never leak the score — hiding it behind the button
  // is the whole point of the widget.
  if (!v.revealed) {
    return v.loading
      ? `Simulating ${v.awayName} at ${v.homeName}…`
      : `Run the simulation to see the model's projected final score for ${v.awayName} at ${v.homeName}.`;
  }

  // Displayed values: the card rounds each side independently, so the headline
  // must too or the arithmetic won't match the numbers below it.
  const away = Math.round(v.awayScore);
  const home = Math.round(v.homeScore);
  const separation = Math.abs(v.homeScore - v.awayScore);
  const margin = Math.abs(home - away);

  // A 0.02-point model difference can still print as a 1-point gap, which is not
  // enough to claim a winner. Gate on the UNROUNDED separation.
  if (separation < SIM_MIN_SEPARATION || margin === 0) {
    return `Model projects ${v.awayName} ${away}, ${v.homeName} ${home} — too close to separate them.`;
  }

  const homeWins = v.homeScore > v.awayScore;
  const winner = homeWins ? v.homeName : v.awayName;
  const loser = homeWins ? v.awayName : v.homeName;
  const winScore = homeWins ? home : away;
  const loseScore = homeWins ? away : home;

  return `Model projects ${winner} ${winScore}, ${loser} ${loseScore} — a ${pts(margin)} margin.`;
}

// ---------------------------------------------------------------------------
// College Spread — CollegeSpreadSection (CFB + NCAAB)
// ---------------------------------------------------------------------------

/** Same gaps `edgeStrengthLabel` / `getEdgeExplanation` treat as moderate / large. */
const EDGE_MODERATE = 3;
const EDGE_LARGE = 7;

export interface CollegeSpreadHeadlineInput {
  awayName: string;
  homeName: string;
  /**
   * `homeSpreadDiff > 0`, already resolved by the component
   * (CollegeModelCards.tsx:100) — do NOT re-derive from a raw column.
   */
  pickIsHome: boolean;
  /** `Math.abs(homeSpreadDiff)` (CollegeModelCards.tsx:113); null = no Vegas comparison. */
  absEdge: number | null;
}

/**
 * Spread verdict for the college model card.
 *
 * Says "would take" / "lean", never "favors": the model's pick is the VALUE side
 * against the Vegas number and is routinely not the favorite (see PickSideRow's
 * doc comment in cfb/shared.tsx).
 *
 * No number other than the edge is printed. `vegasDisplay` on the card is a
 * reconciled display value (`modelHome + homeSpreadDiff`), not necessarily the
 * book's posted price, so quoting it in prose would assert a bettable line we
 * can't guarantee. And when there is no edge at all we return null rather than
 * printing `predSpread`, which on the NCAAB path can fall back to
 * `pred_home_margin` — a sign-inverted margin, i.e. the favorite backwards.
 */
export function collegeSpreadHeadline(v: CollegeSpreadHeadlineInput): string | null {
  if (!isNum(v.absEdge)) return null;

  const edge = roundToHalf(Math.abs(v.absEdge));
  if (edge === 0) {
    return 'The model lands on the Vegas spread — no meaningful edge either way.';
  }

  // Mirrors CollegeModelCards.tsx:101 exactly; pickIsHome is the caller's.
  const team = v.pickIsHome ? v.homeName : v.awayName;

  if (edge >= EDGE_LARGE) {
    return `Big edge: the model would take ${team} against the spread, ${pts(edge)} stronger than the market price.`;
  }
  if (edge >= EDGE_MODERATE) {
    return `The model would take ${team} against the spread — a moderate ${edge}-point gap with Vegas.`;
  }
  return `Slight lean to ${team} against the spread — the model is only ${pts(edge)} off Vegas.`;
}

// ---------------------------------------------------------------------------
// College Total — CollegeTotalSection (CFB + NCAAB)
// ---------------------------------------------------------------------------

export interface CollegeTotalHeadlineInput {
  /** `overLineDiff > 0`, already resolved by the component (CollegeModelCards.tsx:202). */
  isOver: boolean;
  /** `Math.abs(overLineDiff)` (CollegeModelCards.tsx:203); null = no comparison to make. */
  absEdge: number | null;
}

/**
 * Over/Under verdict for the college model card. Totals have no side, so the
 * team-attribution failure mode doesn't apply; the only sign that matters is
 * `isOver`, which the component derived from `overLineDiff` (model total minus
 * Vegas total, > 0 = model projects MORE points).
 *
 * Endpoints are intentionally not printed: model and Vegas are each rounded to
 * the nearest half independently, so "50.5 to 47, a 3-point gap" can fail to add
 * up. Only the gap and the direction go in the sentence.
 */
export function collegeTotalHeadline(v: CollegeTotalHeadlineInput): string | null {
  if (!isNum(v.absEdge)) return null;

  const edge = roundToHalf(Math.abs(v.absEdge));
  if (edge === 0) {
    return 'The model lands on the Vegas total — no Over/Under edge.';
  }

  const direction = v.isOver ? 'OVER' : 'UNDER';
  const side = v.isOver ? 'above' : 'below';

  if (edge >= EDGE_LARGE) {
    return `Strong ${direction} lean: the model's total is ${pts(edge)} ${side} the Vegas number.`;
  }
  if (edge >= EDGE_MODERATE) {
    return `The model leans ${direction} — its total is ${pts(edge)} ${side} the Vegas number.`;
  }
  return `Slight ${direction} lean — the model's total is only ${pts(edge)} ${side} the Vegas number.`;
}
