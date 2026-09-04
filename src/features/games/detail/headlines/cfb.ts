/**
 * Deterministic headline sentences for the CFB detail widgets.
 *
 * These replace LLM-written headlines, which repeatedly attributed an edge to
 * the wrong side. Every function here is a pure function of values the calling
 * component has ALREADY derived (its view-model locals) — no formatter re-reads
 * a raw database column, and none of them re-derives "who is favoured" or
 * "which way does a positive diff point".
 *
 * Return `null` when there is nothing honest to say; WidgetCard then renders
 * without a headline.
 */

// --- weather thresholds -----------------------------------------------------
// Editorial cutoffs, not model output — nothing upstream defines "windy" for
// CFB. Kept as named constants so the copy and the tests move together.
const WIND_STRONG_MPH = 15;
const WIND_NOTABLE_MPH = 10;
const PRECIP_LIKELY_PCT = 50;
const PRECIP_NOTABLE_PCT = 30;

/** Sentence-case the icon phrase ("rain" → "Rain") without touching the rest. */
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Mirrors CfbSlateSections' formatNumber: integers bare, otherwise 1 decimal. */
const formatPoints = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const pointWord = (value: number): string => (Math.abs(value) === 1 ? 'point' : 'points');

/** Round to the precision the copy prints, so a branch can't disagree with its own number. */
const round1 = (value: number): number => Math.round(value * 10) / 10;

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

export type CfbWeatherHeadlineInput = {
  /** CfbWeatherSection's own body gate (iconCode || temperature || windSpeed non-null). */
  hasWeather: boolean;
  /** Degrees Fahrenheit (weather_temp_f ?? temperature), already null-normalized. */
  temperature: number | null;
  /** mph MAGNITUDE — CFB carries no wind direction, so never claim which way it blows. */
  windSpeed: number | null;
  /** Already scaled to 0-100 and rounded by the card; never re-scale prediction.precipitation. */
  precipPct: number | null;
  /** The exact phrase the card renders (iconCode with dashes → spaces), or null. */
  conditionText: string | null;
};

/**
 * Conditions at kickoff, stated as conditions only.
 *
 * Deliberately makes NO claim about the total: CFB exposes no roof/dome field
 * (grep for dome/indoor across the cfb section tree and cfbGames.ts: zero hits),
 * so "argues for a lower total" would be flatly wrong for indoor and neutral-site
 * dome games. The card's subtitle already carries that editorial line.
 *
 * `precipitation` is a PROBABILITY, not a state of the field — the same field
 * name is populated from `precipitation_pct` in the NFL adapter
 * (src/features/games/api/nflGames.ts:454) — so the copy says "precip chance"
 * and never "a wet ball".
 */
export function cfbWeatherHeadline(v: CfbWeatherHeadlineInput): string | null {
  // Body renders the EmptyNote in this case; a headline would contradict it.
  if (!v.hasWeather) return null;

  // >100 can only come from the card's legacy scaling quirk (a raw value of 1 is
  // treated as a fraction → 100%). Anything above 100 is unusable, so we neither
  // cite it nor let it drive severity.
  const precipPct = v.precipPct !== null && v.precipPct >= 0 && v.precipPct <= 100 ? v.precipPct : null;
  const { temperature, windSpeed } = v;

  // null means "no wind figure posted"; 0 means "calm". Different facts — the
  // card collapses them only because its render gate is `> 0`.
  const windStrong = windSpeed !== null && windSpeed >= WIND_STRONG_MPH;
  const windNotable = windSpeed !== null && windSpeed >= WIND_NOTABLE_MPH;
  const precipLikely = precipPct !== null && precipPct >= PRECIP_LIKELY_PCT;
  const precipNotable = precipPct !== null && precipPct >= PRECIP_NOTABLE_PCT;

  const parts: string[] = [];
  if (temperature !== null) parts.push(`${Math.round(temperature)}°F`);
  if (windSpeed !== null) parts.push(windSpeed > 0 ? `${Math.round(windSpeed)} mph wind` : 'calm wind');
  if (precipPct !== null) parts.push(`${precipPct}% precip chance`);

  if (parts.length === 0) {
    // hasWeather was true on iconCode alone.
    return v.conditionText
      ? `${capitalize(v.conditionText)} at kickoff — no temperature, wind or precip figures posted.`
      : null;
  }

  let lead: string;
  if (windStrong && precipLikely) lead = 'Rough kickoff conditions:';
  else if (windStrong) lead = 'Windy at kickoff:';
  else if (precipLikely) lead = 'Rain more likely than not at kickoff:';
  else if (windNotable || precipNotable) lead = 'Unsettled at kickoff:';
  // "Quiet" is only sayable when a wind figure actually exists; unknown wind is
  // not calm wind.
  else if (windSpeed !== null) lead = 'Quiet at kickoff:';
  else lead = 'Kickoff forecast:';

  const tail =
    windSpeed === null && precipPct === null ? ', with no wind or precip figures posted' : '';

  return `${lead} ${parts.join(', ')}${tail}.`;
}

// ---------------------------------------------------------------------------
// Slate slate summary
// ---------------------------------------------------------------------------

export type CfbSlateSummaryHeadlineInput = {
  /** Both pred_away_score and pred_home_score parsed (CfbSlateSections.tsx:195). */
  hasScore: boolean;
  /** Model projected points. Null unless hasScore. */
  predAway: number | null;
  predHome: number | null;
  awayAbbrev: string;
  homeAbbrev: string;
  /**
   * The card's own projected-winner boolean (predHome >= predAway) — the same
   * value that drives the check mark. Do NOT re-compare the scores here.
   */
  homeWins: boolean;
  /**
   * modelHomeSpread - vegasHomeSpread, derived in the component exactly as the
   * projected score's spread value is. NEGATIVE = the model has HOME favoured by
   * more than the book, i.e. spread value on HOME. POSITIVE = value on AWAY.
   * Independently cross-checked against the generator: fg_spread_edge =
   * pred_margin + spread_close = -spreadGap, and the model picks HOME when that
   * edge is positive.
   */
  spreadGap: number | null;
  /** modelTotal - vegasTotal. POSITIVE = model projects MORE points (over lean). */
  totalGap: number | null;
  /**
   * fg_spread_capped: |fg_spread_edge| > 14, the model's own "off-market, no
   * play" flag. Must suppress any directional spread claim.
   */
  spreadCapped: boolean;
  isMammothCard: boolean;
  /** Market names carrying the mammoth tier, e.g. ['spread', 'h1 total']. */
  mammothMarkets: string[];
  /**
   * conviction_summary.length — the number of markets FLAGGED WITH A PLAY, not
   * the number the model priced (it prices ~8 per game).
   */
  playMarketCount: number;
};

export function cfbSlateSummaryHeadline(v: CfbSlateSummaryHeadlineInput): string | null {
  const markets = v.mammothMarkets.length > 0 ? v.mammothMarkets.join(', ') : null;

  if (!v.hasScore || v.predAway === null || v.predHome === null) {
    if (v.isMammothCard) {
      return `Mammoth play flagged${markets ? ` on ${markets}` : ''}, but no projected score posted yet.`;
    }
    if (v.playMarketCount > 0) {
      return `Model flagged ${v.playMarketCount} market${v.playMarketCount === 1 ? '' : 's'} with a play here, but posts no projected score.`;
    }
    return null;
  }

  // Reuse homeWins rather than re-comparing, so the sentence can never disagree
  // with the check mark the card draws.
  const tied = v.predHome === v.predAway;
  const winnerAbbrev = v.homeWins ? v.homeAbbrev : v.awayAbbrev;
  const winnerScore = v.homeWins ? v.predHome : v.predAway;
  const loserScore = v.homeWins ? v.predAway : v.predHome;
  const scoreText = tied
    ? `${v.awayAbbrev}/${v.homeAbbrev} dead even at ${v.predHome.toFixed(1)}`
    : `${winnerAbbrev} ${winnerScore.toFixed(1)}-${loserScore.toFixed(1)}`;

  let spreadClause: string | null = null;
  if (v.spreadCapped) {
    spreadClause = 'its spread too far off-market to play';
  } else if (v.spreadGap !== null) {
    const gap = round1(v.spreadGap);
    if (Math.abs(gap) < 0.5) {
      spreadClause = "its spread within half a point of the book's";
    } else {
      // gap < 0 => model has HOME favoured by more than the book => value HOME.
      const side = gap < 0 ? v.homeAbbrev : v.awayAbbrev;
      const size = Math.abs(gap);
      spreadClause = `${formatPoints(size)} ${pointWord(size)} of spread value toward ${side}`;
    }
  }

  let totalClause: string | null = null;
  if (v.totalGap !== null) {
    const gap = round1(v.totalGap);
    if (Math.abs(gap) < 0.5) {
      totalClause = "its total sitting on the book's";
    } else {
      const size = Math.abs(gap);
      totalClause = `${formatPoints(size)} ${pointWord(size)} ${gap > 0 ? 'over' : 'under'} the book's total`;
    }
  }

  // Mammoth is attributed to the market that actually carries it — never to the
  // spread by implication.
  const prefix = v.isMammothCard ? `Mammoth play${markets ? ` on ${markets}` : ''}: model` : 'Model';
  const clauses = [spreadClause, totalClause].filter((clause): clause is string => clause !== null);

  if (clauses.length === 0) {
    return `${prefix} projects ${scoreText}; no posted lines to compare against.`;
  }
  return `${prefix} projects ${scoreText}, with ${clauses.join(' and ')}.`;
}

// ---------------------------------------------------------------------------
// Slate prediction cards (one per market group)
// ---------------------------------------------------------------------------

export type CfbSlatePickHeadlineInput = {
  /** CARD_LABELS[group] — e.g. 'Spread', '1H Total'. Never a side. */
  marketLabel: string;
  /** rows.length for this market group. */
  rowCount: number;
  /** rows.filter(has_play).length — the same count the card's chip shows. */
  playCount: number;
  /** rows.every(display_only) — the whole card is projection-only. */
  allDisplayOnly: boolean;
  /** Every row is a bare MARKET line (no model number) — early-week 1H cards. */
  marketLineOnly?: boolean;
  /**
   * The lead row's pick_label, VERBATIM. This is the only source of side /
   * direction in the sentence: it already names the team or OVER/UNDER, so no
   * sign can be read backwards. Null when the row carries no label.
   */
  leadPickLabel: string | null;
  /** CONVICTION_LABEL output for the lead row; null for 'none'/absent conviction. */
  leadConvictionLabel: string | null;
  /**
   * The lead row's model-vs-market-close gap, as the card's Edge column resolves
   * it. ONLY its magnitude is used: for spread picks it is -|edge| by
   * construction, so its sign identifies nothing.
   */
  leadGap: number | null;
  /**
   * What `leadGap` is measured in. Moneyline cards compare a PRICE to a
   * PROBABILITY, so their gap is percentage points of win rate — calling that
   * "points clear of the market close" would read as points of line.
   */
  leadGapKind?: 'line' | 'winRate';
  /** Weeks 1-3: the display model is a preseason blend — its gaps are NOT bettable. */
  earlyWeek?: boolean;
};

/**
 * One sentence per market card.
 *
 * Never quotes `model_line`: for spread and h1_spread rows that column is written
 * from the MODEL'S PICK PERSPECTIVE (negated when the pick is the away team), so
 * printing it without a team name reads as a home-perspective line and inverts
 * the favourite. `pick_label` is the only value that carries the side.
 *
 * Never puts pick_label's number and a gap measured against the close in the
 * same subtraction either: the label's number is the BEST-SHOPPED book line
 * while the gap is model vs the CONSENSUS close, so the copy attaches the gap to
 * "its fair line" explicitly.
 */
export function cfbSlatePickHeadline(v: CfbSlatePickHeadlineInput): string | null {
  if (v.rowCount === 0) return null;

  const label = v.leadPickLabel?.trim() ? v.leadPickLabel.trim() : null;

  if (v.allDisplayOnly) {
    // Early-week 1H cards carry a posted line but NO model number — calling those
    // "projection only" was backwards (owner 2026-08-24). Say what they are.
    if (v.marketLineOnly) {
      return label
        ? `${v.marketLabel}: market line ${label} — the model prices this market from week 4.`
        : `${v.marketLabel}: market line posted — the model prices this market from week 4.`;
    }
    return label
      ? `${v.marketLabel}: projection only — ${label} on the board, with no play priced here.`
      : `${v.marketLabel}: the model priced this market for reference only — no play here.`;
  }

  if (v.playCount === 0) {
    // Early weeks: say WHY we decline. The display model is a preseason blend and
    // oversized rating-vs-line gaps historically LOSE (the moderate-gap law), so a
    // big edge with no play is the system working, not the system missing it.
    if (v.earlyWeek) {
      return label
        ? `${v.marketLabel}: no play — ${label} is informational; early-season model gaps aren't bettable (oversized preseason gaps historically lose), so plays here come from the validated week 1-3 signals.`
        : `${v.marketLabel}: no play — early-season model gaps aren't bettable; plays come from the validated week 1-3 signals.`;
    }
    return label
      ? `${v.marketLabel}: no play surfaced — ${label} is informational only.`
      : `${v.marketLabel}: the model priced this market but surfaced no play.`;
  }

  if (label === null) {
    return `${v.marketLabel}: ${v.playCount} play${v.playCount === 1 ? '' : 's'} surfaced, but the lead row carries no pick label.`;
  }

  const conviction = v.leadConvictionLabel ? ` at ${v.leadConvictionLabel.toLowerCase()} conviction` : '';
  const head =
    v.playCount >= 2
      ? `${v.marketLabel}: ${v.playCount} picks, led by ${label}${conviction}`
      : `${v.marketLabel}: model backs ${label}${conviction}`;

  if (v.leadGap === null) {
    return `${head}; no market close posted to price it against.`;
  }
  const gap = Math.abs(round1(v.leadGap));
  if (v.leadGapKind === 'winRate') {
    // The bar under this sentence draws model% against the price's break-even
    // rate, so the sentence has to be in the same units.
    if (gap === 0) {
      return `${head}, with its win rate exactly on the price's break-even.`;
    }
    return `${head}, with its win rate ${formatPoints(gap)} ${pointWord(gap)} clear of the price's break-even.`;
  }
  if (gap === 0) {
    return `${head}, with its fair line right on the market close.`;
  }
  return `${head}, with its fair line ${formatPoints(gap)} ${pointWord(gap)} clear of the market close.`;
}
