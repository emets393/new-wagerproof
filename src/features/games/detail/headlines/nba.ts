/**
 * Deterministic widget headlines for the NBA detail sections.
 *
 * These replace LLM-written headlines, which mis-attributed signed values (it
 * once wrote "model slightly favors Washington with a 3.3% edge" off a row whose
 * edge was -3.3, i.e. the edge belonged to the road team). Every function here is
 * a pure function of values the component has ALREADY derived — the picked side,
 * the already-flipped lines, the already-resolved row winner — so a headline
 * cannot disagree with the card it sits on top of.
 *
 * Rules held throughout:
 *  - Never re-derive "who is picked" / "who is favored" from raw columns.
 *  - Never print a number without saying which team it belongs to.
 *  - Return null rather than assert something the inputs don't support; the card
 *    then renders exactly as it did before.
 *  - Never emit "undefined" / "NaN" / "null" inside a sentence.
 */

/** Mirrors `fmtSigned1` in sections/nba/shared.tsx so headline and card agree. */
const signed1 = (value: number): string => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

/** Mirrors `formatPct` in sections/nba/NbaBettingTrendsSection.tsx (0-1 fraction). */
const pct1 = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;

const isNum = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

// ---------------------------------------------------------------------------
// Spread
// ---------------------------------------------------------------------------

export interface NbaSpreadHeadlineInput {
  /** Abbrev of the side the model's spread edge belongs to (edgeInfo.isHomeEdge). */
  pickAbbrev: string;
  /**
   * Model's fair spread FROM THE PICKED TEAM'S PERSPECTIVE, already flipped and
   * rounded by NbaPredictionsSection.tsx:53. Negative = model makes them the
   * favorite. Do NOT negate again.
   */
  modelLine: number | null;
  /** Vegas spread, same picked-team perspective (NbaPredictionsSection.tsx:55). */
  marketLine: number | null;
  /**
   * Non-negative magnitude of the model-vs-book gap, `marketLine - modelLine`
   * on the already-flipped lines (NbaPredictionsSection.tsx:58). It is provably
   * >= 0: the picked side is by construction the one the model rates higher.
   */
  edgePts: number;
}

/** "BOS -3.5", or "BOS at a pick'em" — a 0.0 line must not read as a number. */
const atLine = (abbrev: string, line: number): string =>
  line === 0 ? `${abbrev} at a pick'em` : `${abbrev} ${signed1(line)}`;

export function nbaSpreadHeadline(v: NbaSpreadHeadlineInput): string | null {
  if (!isNum(v.edgePts)) return null;
  const edge = v.edgePts.toFixed(1);

  // Defensive: home_spread_diff only exists when both lines do, so this is
  // unreachable in practice. Cite the gap only — never an em dash in a sentence.
  if (!isNum(v.modelLine) || !isNum(v.marketLine)) {
    return `Model's spread differs from the book by ${edge} points in ${v.pickAbbrev}'s favor.`;
  }

  // edgePts is computed from the rounded lines, so 0.0 means the two lines are
  // literally equal. Naming a side here would be an artifact of getEdgeInfo's
  // `diff > 0` tiebreak (it calls a 0 diff an AWAY edge), so name nobody.
  if (v.edgePts === 0) {
    return 'Model and the book land on the same spread — no edge either way.';
  }

  if (v.edgePts >= 7) {
    return `Big spread edge on ${v.pickAbbrev}: model lines them ${signed1(v.modelLine)} vs the book's ${signed1(v.marketLine)}, ${edge} points apart.`;
  }

  if (v.edgePts >= 3) {
    // Lay vs take keys off the sign of marketLine, which is already in the
    // picked team's perspective — negative means the model is laying points.
    const action =
      v.marketLine < 0
        ? `lays points with ${atLine(v.pickAbbrev, v.marketLine)}`
        : v.marketLine > 0
          ? `takes points with ${atLine(v.pickAbbrev, v.marketLine)}`
          : `backs ${atLine(v.pickAbbrev, v.marketLine)}`;
    return `Model ${action} — its own line is ${signed1(v.modelLine)}, a ${edge}-point edge.`;
  }

  return `Slight lean to ${atLine(v.pickAbbrev, v.marketLine)}: model's line is ${signed1(v.modelLine)}, just ${edge} points off the book.`;
}

// ---------------------------------------------------------------------------
// Total
// ---------------------------------------------------------------------------

export interface NbaTotalHeadlineInput {
  /** Model's fair total, already rounded (NbaPredictionsSection.tsx:121). */
  modelTotal: number | null;
  /** Posted Vegas total, already rounded (NbaPredictionsSection.tsx:122). */
  marketTotal: number | null;
  /**
   * The card's O/U pick, `over_line_diff > 0` (NbaPredictionsSection.tsx:128).
   * over_line_diff is model MINUS market (nbaGames.ts:283), so true = the model
   * projects MORE points. Reused verbatim; never re-derived from the totals.
   */
  isOver: boolean;
  /** |model - market| in points, the same number the card's chip shows. */
  magnitude: number;
}

export function nbaTotalHeadline(v: NbaTotalHeadlineInput): string | null {
  if (!isNum(v.magnitude)) return null;
  const mag = v.magnitude.toFixed(1);
  const dir = v.isOver ? 'OVER' : 'UNDER';

  if (!isNum(v.modelTotal) || !isNum(v.marketTotal)) {
    return `Model sits ${mag} points ${v.isOver ? 'above' : 'below'} the posted total — leans ${dir}.`;
  }

  // Sanity floor: an NBA total is never near zero. Bad book data shouldn't
  // produce "vs the posted 0.0 — a big 224.0-point lean OVER".
  if (v.marketTotal <= 100) return null;

  const model = v.modelTotal.toFixed(1);
  const market = v.marketTotal.toFixed(1);

  // Only an exactly-equal pair may be called "no edge" — the card still shows a
  // +0.4 chip and an OVER/UNDER row for a 0.1-0.4 gap, so denying the lean there
  // would contradict the body of the same widget.
  if (v.magnitude === 0) {
    return `Model's ${model} lands right on the posted ${market} — no total edge.`;
  }

  if (v.magnitude < 0.5) {
    return `Model's ${model} sits essentially on the posted ${market} — a hair toward ${dir}, effectively no edge.`;
  }

  if (v.magnitude >= 7) {
    return `Model projects ${model} vs the posted ${market} — a big ${mag}-point lean ${dir}.`;
  }

  if (v.magnitude >= 3) {
    return `Model projects ${model} vs the posted ${market} — a ${mag}-point lean ${dir}.`;
  }

  return `Model projects ${model} vs the posted ${market} — only a slight ${mag}-point lean ${dir}.`;
}

// ---------------------------------------------------------------------------
// Betting trends
// ---------------------------------------------------------------------------

/** -110 break-even, same constant the Cover Rate meter uses as its threshold. */
const BREAK_EVEN_PCT = 52.4;

export interface NbaBettingTrendsHeadlineInput {
  loading: boolean;
  /** False when no nba_input_values_view row matched this matchup. */
  trendsAvailable: boolean;
  awayAbbrev: string;
  homeAbbrev: string;
  /**
   * Signed straight-up streak: >= 0 consecutive WINS, negative consecutive
   * LOSSES (documented in 07_GAME_DATA_PAYLOADS.md and in formatStreak). The
   * `away_*` columns belong to awayTeam because the trends query filters on the
   * same away_team/home_team strings the TeamRefs are built from.
   */
  awayWinStreak: number | null;
  homeWinStreak: number | null;
  /** Season-to-date ATS cover rate as a 0-1 fraction. NOT opponent-conditioned. */
  awayAtsPct: number | null;
  homeAtsPct: number | null;
  /** Share of the team's games that went over the total, 0-1. Directionless. */
  awayOverPct: number | null;
  homeOverPct: number | null;
}

interface TrendSide {
  abbrev: string;
  winStreak: number | null;
  atsPct: number | null;
  overPct: number | null;
}

export function nbaBettingTrendsHeadline(v: NbaBettingTrendsHeadlineInput): string | null {
  // Skeletons are showing / the card already prints its own "not available"
  // line — a headline here would either lie or repeat it.
  if (v.loading || !v.trendsAvailable) return null;

  // Side objects keep each abbrev welded to its own numbers, so no branch can
  // pair one team's name with the other team's rate.
  const away: TrendSide = {
    abbrev: v.awayAbbrev,
    winStreak: v.awayWinStreak,
    atsPct: v.awayAtsPct,
    overPct: v.awayOverPct,
  };
  const home: TrendSide = {
    abbrev: v.homeAbbrev,
    winStreak: v.homeWinStreak,
    atsPct: v.homeAtsPct,
    overPct: v.homeOverPct,
  };

  // Longest active streak, preferring the positive one on an equal magnitude so
  // a 3-game win streak isn't buried under the opponent's 3-game skid.
  const streakSides = [away, home].filter((s): s is TrendSide & { winStreak: number } =>
    isNum(s.winStreak),
  );
  const streakLeader = [...streakSides].sort(
    (a, b) => Math.abs(b.winStreak) - Math.abs(a.winStreak) || b.winStreak - a.winStreak,
  )[0];

  if (streakLeader && Math.abs(streakLeader.winStreak) >= 3) {
    const other = streakLeader === away ? home : away;
    const verb = streakLeader.winStreak >= 0 ? 'won' : 'lost';
    const run = `${streakLeader.abbrev} has ${verb} ${Math.abs(streakLeader.winStreak)} straight`;
    // Both cover rates are season-to-date, so keep the two parallel and never
    // phrase them as a head-to-head split.
    if (isNum(streakLeader.atsPct) && isNum(other.atsPct)) {
      return `${run} — covering ${pct1(streakLeader.atsPct)} ATS on the season to ${other.abbrev}'s ${pct1(other.atsPct)}.`;
    }
    return `${run}.`;
  }

  if (isNum(away.atsPct) && isNum(home.atsPct)) {
    if (away.atsPct === home.atsPct) {
      return `Both sides are covering ${pct1(away.atsPct)} on the season.`;
    }
    const coverLeader = away.atsPct > home.atsPct ? away : home;
    const coverTrailer = coverLeader === away ? home : away;
    const leaderPct = coverLeader.atsPct as number;
    // Same comparison the Cover Rate meter makes (`pct >= threshold`), so the
    // sentence and the green/blue bar can't disagree. "Clears" covers equality.
    if (leaderPct * 100 >= BREAK_EVEN_PCT) {
      return `${coverLeader.abbrev} is covering ${pct1(leaderPct)}, clearing the ${BREAK_EVEN_PCT}% break-even; ${coverTrailer.abbrev} ${pct1(coverTrailer.atsPct as number)}.`;
    }
    // NOT "neither side is covering" — a 51% team is covering, it just isn't
    // clearing the juice.
    return `Neither side clears the ${BREAK_EVEN_PCT}% break-even: ${away.abbrev} ${pct1(away.atsPct)}, ${home.abbrev} ${pct1(home.atsPct)}.`;
  }

  // One-sided cover data still says something true about that one team.
  const loneCover = isNum(away.atsPct) ? away : isNum(home.atsPct) ? home : null;
  if (loneCover) {
    return `${loneCover.abbrev} is covering ${pct1(loneCover.atsPct as number)} on the season.`;
  }

  if (isNum(away.overPct) && isNum(home.overPct)) {
    // Over rate is directionless — report it, never call it good or bad.
    return `${away.abbrev} games go over ${pct1(away.overPct)} of the time, ${home.abbrev} ${pct1(home.overPct)}.`;
  }

  // Nothing worth leading with. Saying "no history for either team" would be a
  // data-availability claim the rows below can visibly contradict.
  return null;
}

// ---------------------------------------------------------------------------
// Team stats
// ---------------------------------------------------------------------------

export interface NbaTeamStatsHeadlineInput {
  loading: boolean;
  trendsAvailable: boolean;
  awayAbbrev: string;
  homeAbbrev: string;
  /**
   * Which side is the better season team, straight from the card's own
   * `rowWinner(netRatingRow)` — null on a tie or a missing value. Higher net
   * rating is better; that direction lives in rowWinner, not here.
   */
  netRatingWinner: 'away' | 'home' | null;
  /** The exact strings the Net Rating row prints, or null when absent. */
  netRatingAwayText: string | null;
  netRatingHomeText: string | null;
  /** |away - home| net rating, unsigned. */
  netRatingGap: number | null;
  /** Majority winner of the last-3 trend rows, from the shared tally helper. */
  trendLeader: 'away' | 'home' | null;
  /** How many trend rows actually produced a winner (Pace is neutral: never). */
  trendCounted: number;
}

export function nbaTeamStatsHeadline(v: NbaTeamStatsHeadlineInput): string | null {
  if (v.loading || !v.trendsAvailable) return null;

  const bothRatings = v.netRatingAwayText !== null && v.netRatingHomeText !== null;

  // The L3 columns are deltas against each team's OWN season baseline, so one
  // row is not enough to call anybody hot — and a "split" is only meaningful
  // when at least two rows were actually comparable.
  const formLeader = v.trendCounted >= 2 ? v.trendLeader : null;
  const formSplit = v.trendCounted >= 2 && v.trendLeader === null;

  const text = (side: 'away' | 'home') =>
    side === 'away' ? (v.netRatingAwayText as string) : (v.netRatingHomeText as string);
  const abbrev = (side: 'away' | 'home') => (side === 'away' ? v.awayAbbrev : v.homeAbbrev);

  /**
   * Leader-first, and every number carries its own abbrev. A bare "X vs Y" pair
   * in a sentence that names one team is exactly how a value ends up read
   * against the wrong side.
   */
  const ratingPair = (leader: 'away' | 'home') => {
    const other = leader === 'away' ? 'home' : 'away';
    return `${abbrev(leader)} ${text(leader)}, ${abbrev(other)} ${text(other)}`;
  };

  if (!bothRatings) {
    // No season verdict available. "Trending up more" is a claim about deltas,
    // never about who is the better team.
    if (formLeader) {
      return `No season ratings for this matchup, but ${abbrev(formLeader)} has been trending up more over its last three games.`;
    }
    return null;
  }

  if (v.netRatingWinner === null) {
    const evenPair = `${v.awayAbbrev} ${v.netRatingAwayText}, ${v.homeAbbrev} ${v.netRatingHomeText}`;
    if (formLeader) {
      return `Season net ratings are even (${evenPair}), but ${abbrev(formLeader)} has been trending up more lately.`;
    }
    return `Season net ratings are even (${evenPair}).`;
  }

  const winner = v.netRatingWinner;

  if (formLeader === winner) {
    return `${abbrev(winner)} is the better season team (${ratingPair(winner)}) and the one trending up.`;
  }

  if (formLeader) {
    return `${abbrev(winner)} rates better on the season (${ratingPair(winner)}), but ${abbrev(formLeader)} has been trending up more lately.`;
  }

  const formTail = formSplit ? '; recent form is split.' : '.';

  // Net rating is a small signed off-minus-def number (diffCap 6 on the row), so
  // a 4-point gap is near the top of the observed scale.
  if (isNum(v.netRatingGap) && v.netRatingGap >= 4) {
    return `${abbrev(winner)} is clearly the better season team (${ratingPair(winner)})${formTail}`;
  }

  return `${abbrev(winner)} edges it on season net rating (${ratingPair(winner)})${formTail}`;
}

// ---------------------------------------------------------------------------
// Injuries
// ---------------------------------------------------------------------------

export interface NbaInjuriesHeadlineInput {
  loading: boolean;
  /** Non-null when the injury fetch failed; the empty list is then meaningless. */
  error: string | null;
  awayAbbrev: string;
  homeAbbrev: string;
  awayCount: number;
  homeCount: number;
  /**
   * Sum of -PIE over that side's listed players (NbaInjuriesSection.tsx:29-33).
   * Normally <= 0, so MORE NEGATIVE = more production sidelined — but a
   * negative-PIE player can flip it positive, hence the sign check below.
   */
  awayImpact: number;
  homeImpact: number;
  /** True when at least one listed player on either side has a PIE value. */
  pieKnown: boolean;
}

/** Below this the two lists are the same list as far as a reader cares. */
const PIE_EVEN_EPSILON = 0.005;
/** ~a starter's worth of production, the component's own calibration. */
const PIE_STARTER_GAP = 0.2;

export function nbaInjuriesHeadline(v: NbaInjuriesHeadlineInput): string | null {
  if (v.loading || v.error) return null;
  if (!isNum(v.awayImpact) || !isNum(v.homeImpact)) return null;

  // An empty list is three states — queried-and-clean, fetch-failed, and
  // never-queried — and the card already prints "No injuries reported for either
  // team." So say nothing rather than assert an absence we can't verify.
  if (v.awayCount === 0 && v.homeCount === 0) return null;

  const plural = (n: number) => (n === 1 ? 'player' : 'players');

  if (v.awayCount === 0 || v.homeCount === 0) {
    // Select the banged-up side by LIST LENGTH, not by impact: an all-null-PIE
    // list sums to 0 exactly like an empty one, which would otherwise hand this
    // sentence to the healthy team.
    const onlyIsAway = v.homeCount === 0;
    const abbrev = onlyIsAway ? v.awayAbbrev : v.homeAbbrev;
    const count = onlyIsAway ? v.awayCount : v.homeCount;
    const impact = onlyIsAway ? v.awayImpact : v.homeImpact;
    // Only quote PIE when it exists AND points the expected way.
    const pieClause =
      v.pieKnown && impact < 0 ? `, ${Math.abs(impact).toFixed(2)} PIE on the report` : '';
    return `${abbrev} is the only side banged up — ${count} ${plural(count)} listed${pieClause}.`;
  }

  const counts = `${v.awayCount} ${v.awayAbbrev} vs ${v.homeCount} ${v.homeAbbrev} ${plural(Math.max(v.awayCount, v.homeCount))} listed`;

  // No PIE anywhere = production lost is UNKNOWN, not equal. Claiming parity
  // here would be a measurement we never made.
  if (!v.pieKnown) {
    return `Both sides have players listed — ${counts} — with no production estimates available.`;
  }

  const gap = Math.abs(v.awayImpact - v.homeImpact);

  // Float sums make strict equality unreliable (0.05 + 0.10 !== 0.15), so treat
  // anything under half a hundredth of a PIE as even.
  if (gap < PIE_EVEN_EPSILON) {
    return `Both sides are missing about the same production — ${counts}.`;
  }

  const awayWorse = v.awayImpact < v.homeImpact;
  const hurt = awayWorse ? v.awayAbbrev : v.homeAbbrev;
  const healthier = awayWorse ? v.homeAbbrev : v.awayAbbrev;
  const hurtCount = awayWorse ? v.awayCount : v.homeCount;

  if (gap >= PIE_STARTER_GAP) {
    return `${hurt} is far more depleted than ${healthier} — a ${gap.toFixed(2)} PIE gap, ${hurtCount} listed.`;
  }

  if (gap >= 0.05) {
    return `${hurt} is missing more production than ${healthier} — a ${gap.toFixed(2)} PIE gap.`;
  }

  return `Injury lists are close to even — ${hurt} is down just ${gap.toFixed(2)} PIE more than ${healthier}.`;
}
