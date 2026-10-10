import type { NflPropPlayerPage } from '@/features/propBreakdown/types';

/**
 * Port of `.claude/design/nfl-props/prop_lean.reference.py`.
 * Agreement does not predict. This only picks the pill market and the lean tag.
 * The baseline reading uses the top-level snapshot keys (`pass_td`, `pass_att`),
 * not `fp_cards.baseline` (`pass_tds`, `pass_attempts`).
 */
export const MIN_POP = 3;
export const LEAN_MIN_POP = 4;
export const LEAN_SHARE = 1;

const DEAD = { pct: 0.03, line: 0.04 };

const MARKET_STAT: Record<string, string> = {
  player_reception_yds: 'rec_yds',
  player_receptions: 'receptions',
  player_rush_yds: 'rush_yds',
  player_rush_attempts: 'rush_att',
  player_pass_yds: 'pass_yds',
  player_pass_tds: 'pass_td',
  player_pass_attempts: 'pass_att',
  player_pass_completions: 'completions',
};

const SCOPE = {
  routes: new Set(['player_reception_yds', 'player_receptions']),
  alignment: new Set(['player_reception_yds', 'player_receptions']),
  coverage: new Set(['player_reception_yds', 'player_receptions']),
  throw_depth: new Set(['player_pass_yds', 'player_pass_completions', 'player_pass_attempts']),
  run_concept: new Set(['player_rush_yds', 'player_rush_attempts']),
};

export interface LeanReading {
  name: string;
  vote: -1 | 0 | 1;
}

export interface MarketScore {
  market: string;
  readings: LeanReading[];
  populated: number;
  nFor: number;
  nAgainst: number;
  direction: 'over' | 'under' | 'split';
  netShare: number;
  lean: boolean;
}

function sign(value: number | null | undefined, dead: number): -1 | 0 | 1 {
  if (value == null || Math.abs(value) < dead) return 0;
  return value > 0 ? 1 : -1;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function projectionValue(page: NflPropPlayerPage, market: string): number | null {
  const row = page.projection?.[market] as { value?: number | null } | null | undefined;
  return num(row?.value);
}

export function readings(page: NflPropPlayerPage, market: string): LeanReading[] {
  const out: LeanReading[] = [];
  const stat = MARKET_STAT[market];
  const line = page.markets?.find((row) => row.key === market)?.line ?? null;
  const cards = page.fp_cards;
  const matchup = cards?.matchup;

  const projected = projectionValue(page, market);
  if (projected != null && line) out.push({ name: 'projection', vote: sign(projected / line - 1, DEAD.line) });

  const base = stat ? num(page.baseline?.[stat]) : null;
  if (base != null && line) out.push({ name: 'baseline', vote: sign(base / line - 1, DEAD.line) });

  const position = matchup?.vs_position;
  const actual = stat ? num(position?.[`${stat}_actual`]) : null;
  const league = stat ? num(position?.[`${stat}_league`]) : null;
  if (actual != null && league) out.push({ name: 'allowance', vote: sign(actual / league - 1, DEAD.pct) });

  if (SCOPE.alignment.has(market)) {
    const alignment = matchup?.vs_alignment ?? {};
    const role = cards?.role ?? {};
    let defenseWeight = 0;
    let leagueWeight = 0;
    for (const spot of ['wide', 'slot', 'inline', 'backfield']) {
      const share = num(role[`align_${spot}_share`]) ?? 0;
      const cell = alignment[spot];
      const spotActual = num(cell?.yds_actual);
      const spotLeague = num(cell?.yds_league);
      if (share && spotActual != null && spotLeague) {
        defenseWeight += share * spotActual;
        leagueWeight += share * spotLeague;
      }
    }
    if (leagueWeight) out.push({ name: 'alignment', vote: sign(defenseWeight / leagueWeight - 1, DEAD.pct) });
  }

  if (SCOPE.routes.has(market)) {
    let numerator = 0;
    let denominator = 0;
    for (const leaf of cards?.routes ?? []) {
      const volume = num(leaf.routes);
      const given = num(leaf.def_yards_per_route_actual);
      const typical = num(leaf.def_yards_per_route_league);
      if (volume && given != null && typical) {
        numerator += volume * (given - typical);
        denominator += volume * typical;
      }
    }
    if (denominator) out.push({ name: 'routes', vote: sign(numerator / denominator, DEAD.pct) });
  }

  const scheme = page.scheme;
  const splits = scheme?.player_splits ?? {};
  const overall = scheme?.player_overall as unknown as { ypt?: number | null } | null | undefined;
  const defense = scheme?.defense;
  const overallYpt = num(overall?.ypt);
  if (SCOPE.coverage.has(market) && overallYpt) {
    let numerator = 0;
    let denominator = 0;
    for (const [family, cell] of Object.entries(splits)) {
      const dim = defense?.[family];
      const rate = dim && typeof dim === 'object' ? num(dim.rate) : null;
      const ypt = num((cell as unknown as { ypt?: number | null } | null)?.ypt);
      if (rate && ypt != null) {
        numerator += rate * ypt;
        denominator += rate;
      }
    }
    if (denominator) out.push({ name: 'coverage', vote: sign(numerator / denominator / overallYpt - 1, DEAD.pct) });
  }

  for (const [blob, name] of [['throw_depth', 'depth'], ['run_concept', 'concept']] as const) {
    if (!SCOPE[blob].has(market)) continue;
    const by = cards?.[blob]?.by ?? {};
    let numerator = 0;
    let denominator = 0;
    for (const cell of Object.values(by)) {
      const volume = num(cell?.attempts);
      const given = num(cell?.def_yards_per_attempt);
      const typical = num(cell?.def_yards_per_attempt_league);
      if (volume && given != null && typical) {
        numerator += volume * (given - typical);
        denominator += volume * typical;
      }
    }
    if (denominator) out.push({ name, vote: sign(numerator / denominator, DEAD.pct) });
  }

  return out;
}

export function scoreMarket(page: NflPropPlayerPage, market: string): MarketScore {
  const rows = readings(page, market);
  const votes = rows.map((row) => row.vote).filter((vote) => vote !== 0);
  const nFor = votes.filter((vote) => vote > 0).length;
  const nAgainst = votes.filter((vote) => vote < 0).length;
  const populated = votes.length;
  const netShare = populated ? Math.abs(nFor - nAgainst) / populated : 0;
  return {
    market,
    readings: rows,
    populated,
    nFor,
    nAgainst,
    direction: nFor > nAgainst ? 'over' : nAgainst > nFor ? 'under' : 'split',
    netShare,
    lean: populated >= LEAN_MIN_POP && nFor !== nAgainst && Math.max(nFor, nAgainst) / populated >= LEAN_SHARE,
  };
}

/** The market the pill shows and the page opens on. Null when nothing has 3 readings. */
export function bestMarket(page: NflPropPlayerPage): MarketScore | null {
  const candidates = (page.markets ?? [])
    .filter((market) => market.status === 'posted' && MARKET_STAT[market.key])
    .map((market) => scoreMarket(page, market.key))
    .filter((row) => row.populated >= MIN_POP);
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.netShare - a.netShare || b.populated - a.populated)[0];
}

export function playerHasLean(page: NflPropPlayerPage): boolean {
  return (page.markets ?? []).some((market) => market.status === 'posted' && scoreMarket(page, market.key).lean);
}
