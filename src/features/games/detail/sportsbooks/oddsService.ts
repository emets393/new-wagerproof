/**
 * Per-book boards from the research capture. Same tables as iOS
 * `SportsbookOddsService` / `SportsbookPropOddsService`.
 */
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import {
  cfbAliasMatches,
  nflCityName,
  type SportsbookBookRow,
  type SportsbookGameOdds,
  type SportsbookMarketQuotes,
  type SportsbookQuote,
  sportsbookName,
} from './quotes';

const cache = new Map<string, SportsbookGameOdds>();
const propCache = new Map<string, SportsbookPropMarketOdds>();

export interface SportsbookPropMarketOdds {
  over: SportsbookMarketQuotes;
  under: SportsbookMarketQuotes;
}

function asNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function newestStamp(rows: Array<Record<string, unknown>>, key: string): string | null {
  const stamps = rows.map((row) => row[key]).filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (stamps.length === 0) return null;
  return stamps.reduce((a, b) => (a > b ? a : b));
}

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export async function fetchNflSportsbookOdds(input: {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  kickoff?: string | null;
}): Promise<SportsbookGameOdds | null> {
  const cacheKey = `nfl:${input.gameId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const away = nflCityName(input.awayTeam);
  const home = nflCityName(input.homeTeam);
  const { data, error } = await collegeFootballSupabase
    .from('nfl_historical_odds')
    .select(
      'snap_ts,commence_time,book,spread_home,spread_home_price,spread_away,spread_away_price,total_point,total_over_price,total_under_price,ml_home,ml_away,h1_spread_home,h1_spread_home_price,h1_spread_away,h1_spread_away_price,h1_total_point,h1_total_over_price,h1_total_under_price',
    )
    .eq('away_team', away)
    .eq('home_team', home)
    .order('snap_ts', { ascending: false })
    .limit(400);

  if (error || !data?.length) return null;

  const kickoffMs = parseMs(input.kickoff ?? null);
  let candidates = data as Array<Record<string, unknown>>;
  if (kickoffMs != null) {
    const grouped = new Map<string, Array<Record<string, unknown>>>();
    for (const row of candidates) {
      const key = String(row.commence_time ?? '');
      const list = grouped.get(key) ?? [];
      list.push(row);
      grouped.set(key, list);
    }
    let nearest: Array<Record<string, unknown>> | null = null;
    let nearestDelta = Number.POSITIVE_INFINITY;
    for (const [stamp, rows] of grouped) {
      const ms = parseMs(stamp);
      const delta = ms == null ? Number.POSITIVE_INFINITY : Math.abs(ms - kickoffMs);
      if (delta < nearestDelta) {
        nearestDelta = delta;
        nearest = rows;
      }
    }
    if (nearest) candidates = nearest;
  }

  const newest = newestStamp(candidates, 'snap_ts');
  if (!newest) return null;
  const latest = candidates.filter((row) => row.snap_ts === newest);
  const result: SportsbookGameOdds = {
    capturedAt: newest,
    rows: latest.map((row) => ({
      bookKey: String(row.book ?? ''),
      spreadHome: asNum(row.spread_home),
      spreadHomePrice: asNum(row.spread_home_price),
      spreadAway: asNum(row.spread_away),
      spreadAwayPrice: asNum(row.spread_away_price),
      totalPoint: asNum(row.total_point),
      totalOverPrice: asNum(row.total_over_price),
      totalUnderPrice: asNum(row.total_under_price),
      mlHome: asNum(row.ml_home),
      mlAway: asNum(row.ml_away),
      h1SpreadHome: asNum(row.h1_spread_home),
      h1SpreadHomePrice: asNum(row.h1_spread_home_price),
      h1SpreadAway: asNum(row.h1_spread_away),
      h1SpreadAwayPrice: asNum(row.h1_spread_away_price),
      h1TotalPoint: asNum(row.h1_total_point),
      h1TotalOverPrice: asNum(row.h1_total_over_price),
      h1TotalUnderPrice: asNum(row.h1_total_under_price),
    })),
  };
  cache.set(cacheKey, result);
  return result;
}

export async function fetchCfbSportsbookOdds(input: {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  kickoff?: string | null;
}): Promise<SportsbookGameOdds | null> {
  const cacheKey = `cfb:${input.gameId}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const kickoffMs = parseMs(input.kickoff ?? null);
  if (kickoffMs == null) return null;

  const lower = new Date(kickoffMs - 4 * 60 * 60 * 1000).toISOString();
  const upper = new Date(kickoffMs + 4 * 60 * 60 * 1000).toISOString();
  const { data, error } = await collegeFootballSupabase
    .from('ncaaf_odds_history')
    .select(
      'snapshot,commence_time,game_id,home_team,away_team,book,home_ml,away_ml,spread_home,spread_home_price,spread_away_price,total,over_price,under_price',
    )
    .gte('commence_time', lower)
    .lte('commence_time', upper)
    .order('snapshot', { ascending: false })
    .limit(1000);

  if (error || !data?.length) return null;

  const matched = (data as Array<Record<string, unknown>>).filter(
    (row) =>
      cfbAliasMatches(String(row.away_team ?? ''), input.awayTeam) &&
      cfbAliasMatches(String(row.home_team ?? ''), input.homeTeam),
  );
  if (matched.length === 0) return null;

  const eventGroups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of matched) {
    const key = String(row.game_id ?? '');
    const list = eventGroups.get(key) ?? [];
    list.push(row);
    eventGroups.set(key, list);
  }
  let nearest: Array<Record<string, unknown>> | null = null;
  let nearestDelta = Number.POSITIVE_INFINITY;
  for (const rows of eventGroups.values()) {
    const ms = parseMs(String(rows[0]?.commence_time ?? ''));
    const delta = ms == null ? Number.POSITIVE_INFINITY : Math.abs(ms - kickoffMs);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearest = rows;
    }
  }
  if (!nearest) return null;
  const newest = newestStamp(nearest, 'snapshot');
  if (!newest) return null;
  const latest = nearest.filter((row) => row.snapshot === newest);
  const result: SportsbookGameOdds = {
    capturedAt: newest,
    rows: latest.map((row) => {
      const spreadHome = asNum(row.spread_home);
      return {
        bookKey: String(row.book ?? ''),
        spreadHome,
        spreadHomePrice: asNum(row.spread_home_price),
        spreadAway: spreadHome == null ? null : -spreadHome,
        spreadAwayPrice: asNum(row.spread_away_price),
        totalPoint: asNum(row.total),
        totalOverPrice: asNum(row.over_price),
        totalUnderPrice: asNum(row.under_price),
        mlHome: asNum(row.home_ml),
        mlAway: asNum(row.away_ml),
      } satisfies SportsbookBookRow;
    }),
  };
  cache.set(cacheKey, result);
  return result;
}

export async function fetchMlbSportsbookOdds(gamePk: number): Promise<SportsbookGameOdds | null> {
  const cacheKey = `mlb:${gamePk}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data, error } = await collegeFootballSupabase
    .from('mlb_odds_snapshots')
    .select(
      'fetched_at,bookmaker,home_ml,away_ml,home_spread,away_spread,home_spread_odds,away_spread_odds,total_line,total_over_odds,total_under_odds,f5_home_ml,f5_away_ml,f5_home_spread,f5_away_spread,f5_home_spread_odds,f5_away_spread_odds,f5_total_line,f5_total_over_odds,f5_total_under_odds',
    )
    .eq('game_pk', gamePk)
    .order('fetched_at', { ascending: false })
    .limit(100);

  if (error || !data?.length) return null;
  const newest = newestStamp(data as Array<Record<string, unknown>>, 'fetched_at');
  if (!newest) return null;
  const latest = (data as Array<Record<string, unknown>>).filter((row) => row.fetched_at === newest);
  const result: SportsbookGameOdds = {
    capturedAt: newest,
    rows: latest.map((row) => ({
      bookKey: String(row.bookmaker ?? '').toLowerCase(),
      spreadHome: asNum(row.home_spread),
      spreadHomePrice: asNum(row.home_spread_odds),
      spreadAway: asNum(row.away_spread),
      spreadAwayPrice: asNum(row.away_spread_odds),
      totalPoint: asNum(row.total_line),
      totalOverPrice: asNum(row.total_over_odds),
      totalUnderPrice: asNum(row.total_under_odds),
      mlHome: asNum(row.home_ml),
      mlAway: asNum(row.away_ml),
      f5SpreadHome: asNum(row.f5_home_spread),
      f5SpreadHomePrice: asNum(row.f5_home_spread_odds),
      f5SpreadAway: asNum(row.f5_away_spread),
      f5SpreadAwayPrice: asNum(row.f5_away_spread_odds),
      f5TotalPoint: asNum(row.f5_total_line),
      f5TotalOverPrice: asNum(row.f5_total_over_odds),
      f5TotalUnderPrice: asNum(row.f5_total_under_odds),
      f5MlHome: asNum(row.f5_home_ml),
      f5MlAway: asNum(row.f5_away_ml),
    })),
  };
  cache.set(cacheKey, result);
  return result;
}

function sortPropQuotes(quotes: SportsbookQuote[], isOver: boolean): SportsbookQuote[] {
  return [...quotes].sort((lhs, rhs) => {
    if (lhs.line != null && rhs.line != null && lhs.line !== rhs.line) {
      return isOver ? lhs.line - rhs.line : rhs.line - lhs.line;
    }
    return (rhs.price ?? Number.MIN_SAFE_INTEGER) - (lhs.price ?? Number.MIN_SAFE_INTEGER);
  });
}

export async function fetchNflPropSportsbookOdds(
  playerId: string,
  market: string,
): Promise<SportsbookPropMarketOdds | null> {
  const cacheKey = `${playerId}|${market}`;
  const cached = propCache.get(cacheKey);
  if (cached) return cached;

  const { data, error } = await collegeFootballSupabase
    .from('nfl_player_props')
    .select('bookmaker,line,over_odds,under_odds,snapshot_time')
    .eq('player_id', playerId)
    .eq('market', market)
    .order('snapshot_time', { ascending: false })
    .limit(250);

  if (error || !data?.length) return null;
  const newest = newestStamp(data as Array<Record<string, unknown>>, 'snapshot_time');
  if (!newest) return null;
  const latest = (data as Array<Record<string, unknown>>).filter((row) => row.snapshot_time === newest);
  const byBook = new Map<string, Record<string, unknown>>();
  for (const row of latest) {
    const key = String(row.bookmaker ?? '').toLowerCase();
    if (key && !byBook.has(key)) byBook.set(key, row);
  }

  const overQuotes: SportsbookQuote[] = [];
  const underQuotes: SportsbookQuote[] = [];
  for (const [key, row] of byBook) {
    const line = asNum(row.line);
    const over = asNum(row.over_odds);
    const under = asNum(row.under_odds);
    if (line == null && over == null && under == null) continue;
    const name = sportsbookName(key);
    if (line != null || over != null) {
      overQuotes.push({ bookKey: key, bookName: name, line, price: over == null ? null : Math.round(over) });
    }
    if (line != null || under != null) {
      underQuotes.push({ bookKey: key, bookName: name, line, price: under == null ? null : Math.round(under) });
    }
  }
  const result: SportsbookPropMarketOdds = {
    over: { quotes: sortPropQuotes(overQuotes, true), capturedAt: newest },
    under: { quotes: sortPropQuotes(underQuotes, false), capturedAt: newest },
  };
  propCache.set(cacheKey, result);
  return result;
}
