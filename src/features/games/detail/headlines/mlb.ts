/**
 * Deterministic widget headlines for the MLB detail stack.
 *
 * These replace LLM-written headlines, which repeatedly got sign/attribution
 * wrong (e.g. "model slightly favors Washington with a 3.3% edge" on a row whose
 * home_ml_edge_pct was -3.3 — the +3.3 belonged to the away team).
 *
 * THE RULE: every function here is a pure function of values the component has
 * ALREADY DERIVED — pick side, direction, leader, fav/dog. Nothing in this file
 * re-derives "who is favored", "which side has the edge", or "which way a signed
 * diff points" from a raw DB column. Where a needed value did not exist as a
 * view-model local, it was lifted into an exported `derive*` helper in
 * ../sections/mlb/shared.tsx so the panel and the headline read the same object.
 *
 * Every formatter returns `null` when there is nothing truthful to say; the card
 * then renders with no headline line at all.
 */

/** Break-even win rate at -110. Mirrors BREAK_EVEN_PCT in ../sections/mlb/shared.tsx. */
export const HEADLINE_BREAK_EVEN_PCT = 52.4;

/** Same sign rule as shared.formatMoneyline: '+' only on positive prices. */
function moneylineText(ml: number): string {
  return ml > 0 ? `+${ml}` : String(ml);
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Starting Pitchers
// ---------------------------------------------------------------------------

export interface MlbPitchersHeadlineInput {
  awayAbbrev: string;
  homeAbbrev: string;
  /** raw.away_sp_name as the card renders it (`spName || 'TBD'`). */
  awaySpName: string | null | undefined;
  homeSpName: string | null | undefined;
  /** raw.*_sp_confirmed — drives the 'SP ✓' vs 'SP TBD' chip. Announcement certainty, NOT quality. */
  awaySpConfirmed: boolean | null | undefined;
  homeSpConfirmed: boolean | null | undefined;
  /** Book moneylines exactly as the two columns render them. */
  awayMl: number | null | undefined;
  homeMl: number | null | undefined;
}

/**
 * Starters + the one comparative number this card actually has: the market price.
 *
 * There is NO pitcher-quality field on this row (no ERA/FIP/xFIP/SP rating), so
 * the headline never answers "which starter is better". The only comparison it
 * makes is the market's, and it says "the market favors", never "the model".
 */
export function mlbPitchersHeadline(v: MlbPitchersHeadlineInput): string | null {
  const awayName = (v.awaySpName ?? '').trim() || null;
  const homeName = (v.homeSpName ?? '').trim() || null;

  if (!awayName && !homeName) {
    return `Neither starter is listed yet for ${v.awayAbbrev} at ${v.homeAbbrev}.`;
  }
  if (!awayName || !homeName) {
    const listed = (awayName ?? homeName) as string;
    const listedAbbrev = awayName ? v.awayAbbrev : v.homeAbbrev;
    const missingAbbrev = awayName ? v.homeAbbrev : v.awayAbbrev;
    // Deliberately "listed", not "announced": name presence and the *_sp_confirmed
    // flag are separate fields, and a named-but-unconfirmed starter still shows
    // the amber 'SP TBD' chip.
    return `Only ${listed} (${listedAbbrev}) is listed so far; ${missingAbbrev} starter still TBD.`;
  }

  // 'Confirmed' means BOTH chips are green; undefined must read 'Probable'.
  const lead = v.awaySpConfirmed && v.homeSpConfirmed ? 'Confirmed' : 'Probable';
  const matchup = `${awayName} (${v.awayAbbrev}) vs ${homeName} (${v.homeAbbrev})`;

  // Coerce before comparing: these come off a raw select('*') row behind an
  // index signature, so a Postgres numeric can arrive as a STRING — and
  // '-105' < '-115' is a lexicographic compare that inverts the favorite.
  const away = num(v.awayMl);
  const home = num(v.homeMl);
  // 0 is not a real American price; treat it as no market rather than "at 0".
  if (away === null || home === null || away === 0 || home === 0) {
    return `${lead} starters ${matchup} — no moneyline posted yet.`;
  }
  if (away === home) {
    return `${lead} starters ${matchup}; the market prices it even at ${moneylineText(home)}.`;
  }
  // Negative American odds = favorite, so the numerically smaller price is the
  // market favorite in every sign combination (both -, both +, mixed).
  const homeIsFavorite = home < away;
  const favAbbrev = homeIsFavorite ? v.homeAbbrev : v.awayAbbrev;
  const favMl = homeIsFavorite ? home : away;
  return `${lead} starters ${matchup}; the market favors ${favAbbrev} at ${moneylineText(favMl)}.`;
}

// ---------------------------------------------------------------------------
// Projected Score
// ---------------------------------------------------------------------------

export interface MlbProjectedScoreHeadlineInput {
  /** The component's `active` (never `view`): forced to 'full' when the toggle is hidden. */
  active: 'full' | 'f5';
  /** The component's `activeRuns` — the exact two numbers on screen. Away is LEFT, home is RIGHT. */
  activeRuns: { home: number; away: number } | null;
  awayTeamName: string;
  homeTeamName: string;
}

/** Runs within this many of each other are called even rather than crowning a leader. */
const NEAR_EVEN_RUNS = 0.25;

/**
 * The projected score, captioned for whichever segment is on screen.
 *
 * ATTRIBUTION: the FULL-GAME split is not a model output — getFullGameRuns()
 * back-solves a Pythagorean split (exponent 1.83) from ml_home_win_prob and
 * ou_fair_total, so the wording says the model's total and win probability
 * "imply" the two scores. The 1st-5 numbers come straight from f5_fair_total +
 * f5_pred_margin, so those may be attributed to the model directly.
 *
 * The leader is whichever of the two DISPLAYED numbers is larger — never
 * re-derived from ml_home_win_prob, home_ml or an edge column.
 */
export function mlbProjectedScoreHeadline(v: MlbProjectedScoreHeadlineInput): string | null {
  if (!v.activeRuns) return null;
  const away = num(v.activeRuns.away);
  const home = num(v.activeRuns.home);
  if (away === null || home === null || away < 0 || home < 0) return null;

  // Round first, then compare and sum, so the sentence can never disagree with
  // the one-decimal figures the card prints.
  const awayR = Math.round(away * 10) / 10;
  const homeR = Math.round(home * 10) / 10;
  const awayStr = awayR.toFixed(1);
  const homeStr = homeR.toFixed(1);
  const totalStr = (awayR + homeR).toFixed(1);
  const nearEven = Math.abs(homeR - awayR) < NEAR_EVEN_RUNS;

  const homeLeads = homeR > awayR;
  const leaderName = homeLeads ? v.homeTeamName : v.awayTeamName;
  const trailerName = homeLeads ? v.awayTeamName : v.homeTeamName;
  const leaderStr = homeLeads ? homeStr : awayStr;
  const trailerStr = homeLeads ? awayStr : homeStr;

  if (v.active === 'f5') {
    if (nearEven) {
      return `Through five the model projects a near-even ${totalStr} runs: ${v.awayTeamName} ${awayStr}, ${v.homeTeamName} ${homeStr}.`;
    }
    return `Through five the model projects ${leaderName} ${leaderStr}, ${trailerName} ${trailerStr} — ${totalStr} runs.`;
  }

  if (nearEven) {
    return `The model's ${totalStr}-run total and win probability imply a near-even game: ${v.awayTeamName} ${awayStr}, ${v.homeTeamName} ${homeStr}.`;
  }
  return `The model's ${totalStr}-run total and win probability imply ${leaderName} ${leaderStr}, ${trailerName} ${trailerStr}.`;
}

// ---------------------------------------------------------------------------
// Moneyline (full game)
// ---------------------------------------------------------------------------

export interface MlbMoneylineHeadlineInput {
  /** Abbrev of the side the model has VALUE on (higher signed edge) — deriveFullMl().pickTeam. */
  pickTeam: string;
  /** Signed edge in percentage POINTS, already selected for pickTeam. */
  pickEdge: number | null;
  /** The other side's signed edge, so "no value anywhere" can be said side-free. */
  otherEdge: number | null;
  /** Model win probability for the PICKED side, 0-100. */
  pickProbPct: number | null;
  /** Vegas implied % for the picked side, derived as model − edge (see WIDGET_DESIGN.md §10). */
  vegasPct: number | null;
  /** Book price for the picked side. */
  line: number | null;
  /** Market status of the picked side, from the price sign — NOT from the probability. */
  favDog: 'favorite' | 'underdog' | undefined;
  /** Historical hit rate of the model in this edge bucket / side / fav-dog cell. */
  acc: { win_pct: number; record: string } | null;
}

/** Edge magnitude at which the edge stops being marginal (ML_BUCKETS boundary). */
const ML_SIZABLE_EDGE = 4;
/** ML_BUCKETS boundary between a modest and a thin edge. */
const ML_MODEST_EDGE = 2;

/**
 * The moneyline verdict, scoped to the full game.
 *
 * Prefixed "Full game:" on purpose — WidgetCard renders the headline ABOVE the
 * Full Game / 1st 5 SegmentedControl, and the 1st-5 pick comes from independent
 * columns that can name the other team with the opposite sign.
 *
 * FAVORED != HAS EDGE. `pickTeam` is the higher-edge side and is routinely NOT
 * the model's outright favorite, so no branch says the model thinks it wins
 * unless pickProbPct >= 50, and the words favorite/underdog come only from
 * `favDog` (the price sign), never from the probability.
 */
export function mlbMoneylineHeadline(v: MlbMoneylineHeadlineInput): string | null {
  const edge = num(v.pickEdge);
  if (edge === null) return null;

  const prob = num(v.pickProbPct);
  const vegas = num(v.vegasPct);
  const other = num(v.otherEdge);

  if (edge <= 0) {
    if (other !== null && other <= 0) {
      return `Full game: no moneyline value on either side — the model doesn't beat the Vegas price.`;
    }
    if (prob === null || vegas === null) {
      return `Full game: the model sees no moneyline value on ${v.pickTeam}.`;
    }
    return `Full game: no moneyline value on ${v.pickTeam} — Vegas prices it at ${vegas.toFixed(1)}% against the model's ${prob.toFixed(1)}%.`;
  }

  const edgeText = `+${edge.toFixed(1)}%`;

  // A big edge the model historically loses with is a warning, not a bet — so the
  // hit rate outranks edge size. "sizable", not "strong": Strong/Weak is the
  // ConfidenceChip's vocabulary and it can disagree with the edge.
  if (v.acc && v.acc.win_pct < HEADLINE_BREAK_EVEN_PCT) {
    return `Full game: ${v.pickTeam} carries a ${edgeText} edge, but the model hits only ${v.acc.win_pct}% on picks like this (${v.acc.record}).`;
  }

  if (prob === null || vegas === null) {
    return `Full game: the model's moneyline edge is on ${v.pickTeam}, ${edgeText} over the Vegas price.`;
  }

  if (prob < 50) {
    const dogClause = v.favDog === 'underdog' ? ' — underdog value' : '';
    return `Full game: the model doesn't favor ${v.pickTeam} outright, but its ${prob.toFixed(1)}% beats Vegas's ${vegas.toFixed(1)}%, a ${edgeText} edge${dogClause}.`;
  }

  const priceClause = v.line !== null ? ` (${moneylineText(v.line)})` : '';
  if (edge >= ML_SIZABLE_EDGE) {
    return `Full game: the model backs ${v.pickTeam}${priceClause} at ${prob.toFixed(1)}% — a sizable ${edgeText} edge over the Vegas price.`;
  }
  if (edge >= ML_MODEST_EDGE) {
    return `Full game: the model backs ${v.pickTeam} at ${prob.toFixed(1)}%, a modest ${edgeText} edge on the Vegas price.`;
  }
  return `Full game: the model leans ${v.pickTeam} at ${prob.toFixed(1)}%, but its ${edgeText} edge is thin.`;
}

// ---------------------------------------------------------------------------
// Total (full game)
// ---------------------------------------------------------------------------

export interface MlbTotalHeadlineInput {
  /** raw.ou_direction, accepted only as 'OVER'/'UNDER'. THE authority on the lean. */
  direction: 'OVER' | 'UNDER' | null;
  /** Signed ou_edge (= ou_fair_total − total_line), or null when the column is absent. */
  edge: number | null;
  /** Model fair total (2dp on the card). */
  fairTotal: number | null;
  /** Vegas total (1dp on the card). */
  marketTotal: number | null;
  acc: { win_pct: number; record: string } | null;
  /** ou_strong_signal / ou_moderate_signal, or null when neither column is present. */
  strength: 'Strong' | 'Moderate' | 'Weak' | null;
}

/** Gap below which the model's total is effectively sitting on the Vegas number. */
const TOTAL_FLAT_RUNS = 0.05;

/**
 * The total verdict, scoped to the full game (see the moneyline note on why the
 * segment is spelled out).
 *
 * DIRECTION comes only from `direction` (raw.ou_direction). It is never inferred
 * from sign(fairTotal − marketTotal): ou_edge IS that subtraction, but total_line
 * can move after the model snapshot is written, so the two can disagree. When
 * they do, the sentence states both totals and drops the "runs more/fewer"
 * phrasing rather than contradicting itself.
 */
export function mlbTotalHeadline(v: MlbTotalHeadlineInput): string | null {
  if (v.direction !== 'OVER' && v.direction !== 'UNDER') return null;
  const dir = v.direction;
  const leansOver = dir === 'OVER';

  const fair = num(v.fairTotal);
  const market = num(v.marketTotal);
  const edge = num(v.edge);

  if (fair === null || market === null) {
    // Never print "a 0.00-run edge": ou_edge is null exactly when one of the two
    // totals is missing, and the panel's `|| 0` fallback would fabricate a zero.
    if (edge !== null) {
      return `Full game: the model leans ${dir} on the total by ${Math.abs(edge).toFixed(2)} runs; the full projection isn't posted yet.`;
    }
    return `Full game: the model leans ${dir} on the total; the full projection isn't posted yet.`;
  }

  const gap = fair - market;
  const absGap = Math.abs(gap);

  if (absGap < TOTAL_FLAT_RUNS) {
    return `Full game: the model's ${fair.toFixed(2)} runs sits on the Vegas ${market.toFixed(1)} — a ${dir} lean with effectively no edge.`;
  }
  if (gap > 0 !== leansOver) {
    return `Full game: the model leans ${dir}, projecting ${fair.toFixed(2)} runs against the Vegas ${market.toFixed(1)} total.`;
  }

  if (v.acc) {
    if (v.acc.win_pct >= HEADLINE_BREAK_EVEN_PCT) {
      return `Full game: ${dir} — the model projects ${fair.toFixed(2)} runs vs the Vegas ${market.toFixed(1)}, and hits ${v.acc.win_pct}% on picks like this (${v.acc.record}).`;
    }
    return `Full game: ${dir} lean, ${absGap.toFixed(2)} runs ${leansOver ? 'above' : 'below'} the Vegas ${market.toFixed(1)} — but the model hits only ${v.acc.win_pct}% on picks like this (${v.acc.record}).`;
  }

  // Only qualify the lean when a signal flag actually exists on the row —
  // defaulting an absent column to "Weak" would label every game weak.
  const qualifier = v.strength ? `${v.strength.toLowerCase()} ` : '';
  return `Full game: a ${qualifier}${dir} lean — the model projects ${fair.toFixed(2)} runs vs the Vegas ${market.toFixed(1)}.`;
}

// ---------------------------------------------------------------------------
// Game Signals
// ---------------------------------------------------------------------------

export interface MlbSignalsHeadlineInput {
  /** The component's `allSignals` (game → home → away, flattened). NOT the visible page. */
  allSignals: Array<{ category: string; severity: string }>;
}

/**
 * How much extra situational context is flagged, and which way the OVER/UNDER
 * tagged ones point.
 *
 * NO TEAM ATTRIBUTION IS POSSIBLE: combineSignalsOrdered() concatenates
 * game_signals + home_signals + away_signals and discards the bucket, so
 * severity 'positive'/'negative' (which mean back/fade THE SUBJECT) are
 * unrecoverable and are never aggregated. Only 'over'/'under' are game-relative
 * and safe to count.
 *
 * Returns null on an empty list: [] is indistinguishable from a failed or
 * mis-joined signals fetch, so absence must not be asserted.
 */
export function mlbSignalsHeadline(v: MlbSignalsHeadlineInput): string | null {
  const signals = v.allSignals ?? [];
  if (signals.length === 0) return null;

  let overCount = 0;
  let underCount = 0;
  const counts = new Map<string, number>();
  const order: string[] = [];

  for (const s of signals) {
    const severity = (s.severity ?? '').trim().toLowerCase();
    if (severity === 'over') overCount += 1;
    else if (severity === 'under') underCount += 1;

    // Any non-empty category counts — the icon switch is a rendering detail and
    // omits 'series', which is the single most common category in the view.
    const category = (s.category ?? '').trim().toLowerCase().replace(/_/g, ' ');
    if (!category) continue;
    if (!counts.has(category)) order.push(category);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const topCats = order
    .slice()
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, 2);

  const catPhrase =
    topCats.length === 0 ? '' : ` — ${topCats.join(' and ')} context`;

  // Mixed directions cancel: never claim a totals lean when the signals disagree.
  const dirPhrase =
    overCount > 0 && underCount === 0
      ? `, ${overCount} tagged OVER`
      : underCount > 0 && overCount === 0
        ? `, ${underCount} tagged UNDER`
        : '';

  const count = plural(signals.length, 'situational signal');
  if (!catPhrase && !dirPhrase) {
    return `${count} flagged beyond the model's projections.`;
  }
  return `${count} flagged${catPhrase}${dirPhrase}.`;
}

// ---------------------------------------------------------------------------
// Regression Picks
// ---------------------------------------------------------------------------

export interface MlbRegressionHeadlineInput {
  /** How many report picks apply to this game (same filter the card renders). */
  pickCount: number;
  /** picksForGame[0].pick, verbatim from the ETL. Never re-worded or re-signed. */
  primaryPickText: string;
  /** Human bet-type label, e.g. 'full-game total'. */
  primaryBetLabel: string;
  /** computeAlignment() output — 'unknown' whenever the model has no position on that bet type. */
  primaryAlignment: 'aligns' | 'contradicts' | 'unknown';
  /** edge_bucket verbatim ('+2-3.9%', 'Perfect Storm', ...). A SIGNED EDGE tier, not a conviction tier. */
  primaryTierLabel: string | null;
  /** bucket_win_pct (or the perfect-storm aggregate), already sample-gated by the caller. */
  primaryTierWinPct: number | null;
}

/**
 * Leads with the row the eye lands on first (picksForGame[0]) and, when a real
 * sample backs it, that pick's tier hit rate.
 *
 * Two attributions matter here. (1) The picks are the REGRESSION REPORT's, not
 * the model's — "opposite the model" is a disagreement note, never a verdict on
 * the pick. (2) `primaryTierLabel` is edge_bucket, a SIGNED EDGE-MAGNITUDE
 * bucket, and `primaryTierWinPct` is that bucket's hit rate; neither is the
 * hammer/ps/lean/watch conviction ladder (that lives in perfect_storm_tier with
 * its own record), so the two must never be crossed.
 */
export function mlbRegressionHeadline(v: MlbRegressionHeadlineInput): string | null {
  if (v.pickCount <= 0) return null;
  const pick = (v.primaryPickText ?? '').trim();
  if (!pick) return null;

  const lead =
    v.pickCount === 1
      ? `Regression report flags ${pick} on the ${v.primaryBetLabel}`
      : `${v.pickCount} regression picks here, led by ${pick} on the ${v.primaryBetLabel}`;

  // Only the SIDE/DIRECTION is compared, so don't imply the model endorses the
  // price baked into the ETL's pick string.
  const alignClause =
    v.primaryAlignment === 'aligns'
      ? ', the same side the model is on'
      : v.primaryAlignment === 'contradicts'
        ? ', opposite the model'
        : '';

  const tier = (v.primaryTierLabel ?? '').trim();
  const pct = num(v.primaryTierWinPct);
  if (tier && pct !== null) {
    const noun = tier.toLowerCase() === 'perfect storm' ? 'tier' : 'edge tier';
    return `${lead}${alignClause} — the ${tier} ${noun} wins ${pct.toFixed(0)}%.`;
  }
  if (tier) {
    const noun = tier.toLowerCase() === 'perfect storm' ? 'tier' : 'edge tier';
    return `${lead}${alignClause} (${tier} ${noun}).`;
  }
  return `${lead}${alignClause}.`;
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

export interface MlbWeatherHeadlineInput {
  /** toNum(temperature_f) as the card renders it. */
  temp: number | null;
  /** toNum(wind_speed_mph) — magnitude only, carries no direction. */
  wind: number | null;
  /** rec.wind_direction verbatim ('Out To CF', 'In From LF', 'Varies'...). */
  windDirection: string | null;
  sky: string | null;
  /** raw.weather_confirmed — false means these numbers are not final. */
  weatherConfirmed: boolean | null | undefined;
}

/**
 * Purely descriptive: the first-pitch conditions, in the card's own units.
 *
 * NO RUN-SCORING LEAN. This component derives no help/suppress conclusion, and
 * a headline that invented one would (a) call a 20 mph crosswind or a domed game
 * scoring-friendly — nothing here knows about roofs — and (b) contradict the
 * Game Signals card directly above it, which already renders the server-derived
 * weather OVER/UNDER signals.
 */
export function mlbWeatherHeadline(v: MlbWeatherHeadlineInput): string | null {
  const parts: string[] = [];
  const temp = num(v.temp);
  const wind = num(v.wind);
  const direction = (v.windDirection ?? '').trim();
  const sky = (v.sky ?? '').trim();

  if (temp !== null) parts.push(`${temp.toFixed(0)}F`);
  if (wind !== null) {
    parts.push(`${wind.toFixed(0)} mph wind${direction ? ` ${direction}` : ''}`);
  } else if (direction) {
    parts.push(`wind ${direction}`);
  }
  if (sky) parts.push(sky);

  if (parts.length === 0) return null;
  const lead = v.weatherConfirmed ? 'First pitch' : 'Estimated first pitch';
  return `${lead}: ${parts.join(', ')}.`;
}

// ---------------------------------------------------------------------------
// Today's Betting Trends
// ---------------------------------------------------------------------------

export interface MlbTrendsAngle {
  /** Per-angle side lean from sideLeanFor(awayWinPct, homeWinPct). */
  sideLean: 'away' | 'home' | null;
  /** Per-angle totals lean from mlbOuLean(awayOverPct, homeOverPct). */
  ouLean: 'over' | 'under' | null;
}

export interface MlbTrendsHeadlineInput {
  angles: MlbTrendsAngle[];
  awayAbbrev: string;
  homeAbbrev: string;
}

/**
 * The game-level trend read as a COUNT OF AGREEING SITUATIONS, matching
 * buildVerdict() and the /todays-trends tool the card links to.
 *
 * Not an average of the 14 bars: the seven angles are overlapping filters over
 * the same game history and MLB rows carry no sample sizes, so one 70% angle out
 * of seven is a coin flip dressed up — and an average-based lean can name the
 * opposite team from the linked tool. The per-angle leans are computed by the
 * shared sideLeanFor / mlbOuLean helpers, not re-derived here.
 */
export function mlbBettingTrendsHeadline(v: MlbTrendsHeadlineInput): string | null {
  const angles = v.angles ?? [];
  if (angles.length === 0) return null;

  const awayVotes = angles.filter((a) => a.sideLean === 'away').length;
  const homeVotes = angles.filter((a) => a.sideLean === 'home').length;
  const sideTotal = awayVotes + homeVotes;
  const side = awayVotes > homeVotes ? 'away' : homeVotes > awayVotes ? 'home' : null;
  const sideAgree = side === 'away' ? awayVotes : side === 'home' ? homeVotes : 0;

  const overVotes = angles.filter((a) => a.ouLean === 'over').length;
  const underVotes = angles.filter((a) => a.ouLean === 'under').length;
  const totalTotal = overVotes + underVotes;
  const total = overVotes > underVotes ? 'OVER' : underVotes > overVotes ? 'UNDER' : null;
  const totalAgree = total === 'OVER' ? overVotes : total === 'UNDER' ? underVotes : 0;

  if (sideTotal === 0 && totalTotal === 0) return null;

  const sideAbbrev = side === 'away' ? v.awayAbbrev : v.homeAbbrev;
  if (side && total) {
    return `${sideAgree} of ${sideTotal} situations favor ${sideAbbrev} historically, and ${totalAgree} of ${totalTotal} lean ${total}.`;
  }
  if (side) {
    return `${sideAgree} of ${sideTotal} situations favor ${sideAbbrev} historically; no Over/Under consensus.`;
  }
  if (total) {
    return `${totalAgree} of ${totalTotal} situations lean ${total} historically; the two sides split evenly.`;
  }
  return `Today's situations split evenly — no side or Over/Under consensus.`;
}

// ---------------------------------------------------------------------------
// Props Cheats
// ---------------------------------------------------------------------------

export interface MlbPropsCheatsHeadlineInput {
  /** The component's `relevantLegs` (sorted, deduped, capped at 3). */
  legs: Array<{
    subject: string;
    /** propBetText() output — the side is already resolved ('2+ Hits', 'Under 2.5 Total Bases'). */
    betText: string;
    streakN: number;
    /** PARLAY_CATEGORY_TITLE[leg.category], e.g. '100% Day/Night'. */
    categoryTitle: string;
  }>;
}

/**
 * Leads with the top rendered prop cheat.
 *
 * Two things this must NOT do. (1) Count: legs are capped at 3, deduped on
 * subject|betText, and silently dropped when priced worse than -350, so the
 * length is a count of QUALIFYING selections — never "the lone perfect streak"
 * or an exact total. (2) Call streakN a streak depth: for Day/Night and vs Arm
 * Type it is the size of a filtered subset, not consecutive games, so the
 * fraction is always qualified by its category and never ranked as "deepest".
 * The Over/Under side is already baked into betText — interpolate it verbatim.
 */
export function mlbPropsCheatsHeadline(v: MlbPropsCheatsHeadlineInput): string | null {
  const legs = v.legs ?? [];
  if (legs.length === 0) return null;

  const top = legs[0];
  const subject = (top.subject ?? '').trim();
  const betText = (top.betText ?? '').trim();
  const streak = num(top.streakN);
  if (!subject || !betText || streak === null || streak <= 0) return null;

  // '100% Recent Form' → 'Recent Form'; the "100%" is already in "perfect".
  const category = (top.categoryTitle ?? '').replace(/^100%\s*/, '').trim();
  const fraction = `${streak}/${streak}`;
  const categoryClause = category ? ` in ${category}` : '';

  if (legs.length === 1) {
    return `${subject} ${betText} is a perfect ${fraction}${categoryClause}.`;
  }
  return `${subject} ${betText} is a perfect ${fraction}${categoryClause}, one of several prop cheats that qualified here.`;
}
