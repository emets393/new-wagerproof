// Web port of the iOS OutliersTrendsService
// (wagerproof-ios-native/WagerproofKit/Sources/WagerproofServices/OutliersTrendsService.swift).
// NFL/NCAAF read server-pre-rendered cards; MLB fetches raw splits + odds and
// builds cards client-side via mlbTrendsEngine. All tables live on the CFB
// (sports-data) Supabase project.
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { MLB_FALLBACK_BY_NAME, normalizeTeamNameKey } from '@/utils/mlbTeamLogos';
import {
  isDivisionGame,
  isDayGame,
  remapTeamRecord,
  trendsAbbr,
} from './mlbTrendsEngine';
import type {
  MLBTeamTrendRecord,
  MLBTrendsSlateBundle,
  OutliersTrendsBettingLine,
  OutliersTrendsCard,
  OutliersTrendsCardRow,
  OutliersTrendsGame,
  OutliersTrendsSport,
  OutliersTrendsSubjectKind,
  TrendH2HCell,
  TrendMatchupRecord,
  TrendSplitCell,
  TrendSplits,
} from './types';

// Queries stay scoped to the current slate with slim columns only — the iOS
// port learned full-table coach/ref pulls were ~4MB and timed out.
const NFL_GAME_COLUMNS =
  'game_id,season,week,home_ab,away_ab,home_team,away_team,fg_spread_close,fg_total_close,kickoff,slot,assigned_referee';

const CFB_GAME_COLUMNS =
  'game_id,season,week,home_team,away_team,fg_spread_close,fg_total_close,kickoff';

const TREND_CARD_COLUMNS =
  'card_id,game_id,matchup_label,subject_kind,subject_name,subject_detail,team_abbr,player_id,market_key,bet_type_label,trend_value,trend_sample_n,headshot_url,rows,betting_lines,is_player_overflow';

const MLB_GAME_COLUMNS =
  'game_pk,official_date,game_time_et,away_team_name,home_team_name,away_team_id,home_team_id,away_ml,home_ml,away_spread,home_spread,total_line,f5_away_ml,f5_home_ml,f5_away_spread,f5_home_spread,f5_total_line,is_postponed';

const MLB_ODDS_COLUMNS =
  'game_pk,home_spread_odds,away_spread_odds,total_over_odds,total_under_odds,f5_home_spread_odds,f5_away_spread_odds,f5_total_over_odds,f5_total_under_odds';

const MLB_TEAM_TREND_COLUMNS = 'team_abbr,team_name,season,through_date,splits,matchups';

// MARK: - Coercion helpers (PostgREST numeric columns may arrive as strings)

function toNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toInt(value: unknown): number | null {
  const n = toNum(value);
  return n === null ? null : Math.trunc(n);
}

function toStr(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

// MARK: - NFL / NCAAF slates

interface SlateAnchor {
  season: number;
  week: number;
}

async function fetchSlateAnchor(table: string): Promise<SlateAnchor | null> {
  const { data, error } = await collegeFootballSupabase
    .from(table)
    .select('season,week')
    .order('season', { ascending: false })
    .order('week', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  const season = toInt(row.season);
  const week = toInt(row.week);
  if (season === null || week === null) return null;
  return { season, week };
}

async function fetchNFLSlateGames(): Promise<OutliersTrendsGame[]> {
  const anchor = await fetchSlateAnchor('nfl_dryrun_games');
  if (!anchor) return [];
  const { data, error } = await collegeFootballSupabase
    .from('nfl_dryrun_games')
    .select(NFL_GAME_COLUMNS)
    .eq('season', anchor.season)
    .eq('week', anchor.week)
    .order('kickoff', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>): OutliersTrendsGame => ({
    id: toStr(row.game_id) ?? '',
    season: toInt(row.season) ?? anchor.season,
    week: toInt(row.week) ?? anchor.week,
    awayAb: toStr(row.away_ab) ?? '???',
    homeAb: toStr(row.home_ab) ?? '???',
    awayTeam: toStr(row.away_team) ?? toStr(row.away_ab) ?? 'Away',
    homeTeam: toStr(row.home_team) ?? toStr(row.home_ab) ?? 'Home',
    fgSpreadClose: toNum(row.fg_spread_close),
    fgTotalClose: toNum(row.fg_total_close),
    kickoff: toStr(row.kickoff),
    slot: toStr(row.slot),
    assignedReferee: toStr(row.assigned_referee),
  }));
}

async function fetchCFBSlateGames(): Promise<OutliersTrendsGame[]> {
  const anchor = await fetchSlateAnchor('cfb_dryrun_games');
  if (!anchor) return [];
  const { data, error } = await collegeFootballSupabase
    .from('cfb_dryrun_games')
    .select(CFB_GAME_COLUMNS)
    .eq('season', anchor.season)
    .eq('week', anchor.week)
    .order('kickoff', { ascending: true });
  if (error) throw error;
  // cfb_dryrun_games intentionally contains only slate/model data. Team art
  // lives in cfb_teams, the same reference table used by the CFB games page
  // and iOS CFBTeamAssets cache.
  const { data: teamRows } = await collegeFootballSupabase
    .from('cfb_teams')
    .select('team_name,abbr,logo,logo_dark,color,alt_color');
  const normalizeTeam = (value: unknown) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\s+/g, ' ');
  const teamsByName = new Map(
    (teamRows ?? []).map((team: Record<string, unknown>) => [normalizeTeam(team.team_name), team]),
  );
  return (data ?? []).map((row: Record<string, unknown>): OutliersTrendsGame => {
    const home = toStr(row.home_team) ?? 'Home';
    const away = toStr(row.away_team) ?? 'Away';
    const homeRef = teamsByName.get(normalizeTeam(home));
    const awayRef = teamsByName.get(normalizeTeam(away));
    return {
      id: toStr(row.game_id) ?? '',
      season: toInt(row.season) ?? anchor.season,
      week: toInt(row.week) ?? anchor.week,
      awayAb: toStr(awayRef?.abbr) ?? away,
      homeAb: toStr(homeRef?.abbr) ?? home,
      awayTeam: away,
      homeTeam: home,
      awayLogoUrl: toStr(awayRef?.logo) ?? toStr(awayRef?.logo_dark),
      homeLogoUrl: toStr(homeRef?.logo) ?? toStr(homeRef?.logo_dark),
      awayColors: {
        primary: toStr(awayRef?.color) ?? '#6B7280',
        secondary: toStr(awayRef?.alt_color) ?? '#9CA3AF',
      },
      homeColors: {
        primary: toStr(homeRef?.color) ?? '#6B7280',
        secondary: toStr(homeRef?.alt_color) ?? '#9CA3AF',
      },
      fgSpreadClose: toNum(row.fg_spread_close),
      fgTotalClose: toNum(row.fg_total_close),
      kickoff: toStr(row.kickoff),
      slot: null,
      assignedReferee: null,
    };
  });
}

export async function fetchSlateGames(sport: OutliersTrendsSport): Promise<OutliersTrendsGame[]> {
  switch (sport) {
    case 'nfl':
      return fetchNFLSlateGames();
    case 'ncaaf':
      return fetchCFBSlateGames();
    default:
      return [];
  }
}

// MARK: - Pre-rendered trend cards (NFL / NCAAF)

const SUBJECT_KINDS = new Set<OutliersTrendsSubjectKind>(['team', 'coach', 'referee', 'player']);

function parseCardRow(raw: unknown): OutliersTrendsCardRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const text = toStr(r.text);
  if (!text) return null;
  return {
    id: toStr(r.id) ?? text,
    text,
    coverageNote: toStr(r.coverage_note),
    dominantPct: toNum(r.dominant_pct) ?? 0,
    sampleN: toInt(r.sample_n) ?? 0,
  };
}

function parseBettingLine(raw: unknown): OutliersTrendsBettingLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const lineText = toStr(r.line_text);
  if (lineText === null) return null;
  return {
    id: toStr(r.id) ?? lineText,
    label: toStr(r.label) ?? '',
    lineText,
    oddsText: toStr(r.odds_text),
    bookName: toStr(r.book_name),
    bookLogoUrl: toStr(r.book_logo_url),
    teamAbbr: toStr(r.team_abbr),
  };
}

export async function fetchPrecomputedCards(
  sport: OutliersTrendsSport,
  season: number,
  week: number,
): Promise<OutliersTrendsCard[]> {
  const table = sport === 'ncaaf' ? 'cfb_outliers_trend_cards' : 'nfl_outliers_trend_cards';
  const { data, error } = await collegeFootballSupabase
    .from(table)
    .select(TREND_CARD_COLUMNS)
    .eq('season', season)
    .eq('week', week)
    .order('sort_rank', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>): OutliersTrendsCard => {
    const kindRaw = toStr(row.subject_kind) ?? 'team';
    const rows = Array.isArray(row.rows)
      ? (row.rows.map(parseCardRow).filter(Boolean) as OutliersTrendsCardRow[])
      : [];
    const bettingLines = Array.isArray(row.betting_lines)
      ? (row.betting_lines.map(parseBettingLine).filter(Boolean) as OutliersTrendsBettingLine[])
      : [];
    return {
      id: toStr(row.card_id) ?? '',
      gameId: toStr(row.game_id) ?? '',
      matchupLabel: toStr(row.matchup_label) ?? '',
      subjectKind: SUBJECT_KINDS.has(kindRaw as OutliersTrendsSubjectKind)
        ? (kindRaw as OutliersTrendsSubjectKind)
        : 'team',
      subjectName: toStr(row.subject_name) ?? '',
      subjectDetail: toStr(row.subject_detail),
      teamAbbr: toStr(row.team_abbr),
      playerId: toStr(row.player_id),
      marketKey: toStr(row.market_key) ?? 'unknown',
      betTypeLabel: toStr(row.bet_type_label) ?? '',
      trendValue: toNum(row.trend_value) ?? 0,
      trendSampleN: toInt(row.trend_sample_n) ?? 0,
      headshotUrl: toStr(row.headshot_url),
      bettingLines,
      rows,
      isPlayerOverflow: row.is_player_overflow === true,
    };
  });
}

// MARK: - MLB slate bundle

function todayET(): string {
  // en-CA gives ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

function currentMLBSeason(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? new Date().getFullYear());
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  return month >= 3 ? year : year - 1;
}

interface MLBOddsSnapshot {
  homeSpreadOdds: number | null;
  awaySpreadOdds: number | null;
  totalOverOdds: number | null;
  totalUnderOdds: number | null;
  f5HomeSpreadOdds: number | null;
  f5AwaySpreadOdds: number | null;
  f5TotalOverOdds: number | null;
  f5TotalUnderOdds: number | null;
}

/** Series game number lives on `mlb_signal_features_pregame` — best-effort only. */
async function fetchMLBScheduleMeta(gamePks: number[]): Promise<Map<number, number | null>> {
  const byPk = new Map<number, number | null>();
  if (gamePks.length === 0) return byPk;
  try {
    const { data } = await collegeFootballSupabase
      .from('mlb_signal_features_pregame')
      .select('game_pk,series_game_number')
      .in('game_pk', gamePks)
      .eq('home_away', 'home');
    for (const row of data ?? []) {
      const pk = toInt(row.game_pk);
      if (pk !== null) byPk.set(pk, toInt(row.series_game_number));
    }
    if (byPk.size < gamePks.length) {
      const { data: fallback } = await collegeFootballSupabase
        .from('mlb_signal_features_pregame')
        .select('game_pk,series_game_number')
        .in('game_pk', gamePks);
      for (const row of fallback ?? []) {
        const pk = toInt(row.game_pk);
        if (pk !== null && !byPk.has(pk)) byPk.set(pk, toInt(row.series_game_number));
      }
    }
  } catch {
    // Cards still build without series context.
  }
  return byPk;
}

async function fetchMLBOddsSnapshots(gamePks: number[]): Promise<Map<number, MLBOddsSnapshot>> {
  const byPk = new Map<number, MLBOddsSnapshot>();
  if (gamePks.length === 0) return byPk;
  try {
    const { data } = await collegeFootballSupabase
      .from('mlb_odds_snapshots')
      .select(MLB_ODDS_COLUMNS)
      .in('game_pk', gamePks)
      .order('fetched_at', { ascending: false });
    for (const row of data ?? []) {
      const pk = toInt(row.game_pk);
      if (pk === null || byPk.has(pk)) continue; // latest snapshot per game wins
      byPk.set(pk, {
        homeSpreadOdds: toNum(row.home_spread_odds),
        awaySpreadOdds: toNum(row.away_spread_odds),
        totalOverOdds: toNum(row.total_over_odds),
        totalUnderOdds: toNum(row.total_under_odds),
        f5HomeSpreadOdds: toNum(row.f5_home_spread_odds),
        f5AwaySpreadOdds: toNum(row.f5_away_spread_odds),
        f5TotalOverOdds: toNum(row.f5_total_over_odds),
        f5TotalUnderOdds: toNum(row.f5_total_under_odds),
      });
    }
  } catch {
    // Betting-line chips degrade gracefully without juice.
  }
  return byPk;
}

async function fetchMLBTeamAbbrMaps(): Promise<{
  byName: Map<string, string>;
  byId: Map<number, string>;
}> {
  const byName = new Map<string, string>();
  const byId = new Map<number, string>();
  try {
    const { data } = await collegeFootballSupabase
      .from('mlb_team_mapping')
      .select('mlb_api_id,team_name,team');
    for (const row of data ?? []) {
      const team = toStr(row.team)?.trim();
      if (!team) continue;
      const name = toStr(row.team_name);
      if (name) byName.set(normalizeTeamNameKey(name), team);
      const id = toInt(row.mlb_api_id);
      if (id !== null) byId.set(id, team);
    }
  } catch {
    // Fall through to static name fallbacks.
  }
  return { byName, byId };
}

function resolveMLBAbbr(
  teamId: number | null,
  teamName: string,
  byName: Map<string, string>,
  byId: Map<number, string>,
): string {
  if (teamId !== null) {
    const hit = byId.get(teamId);
    if (hit) return hit;
  }
  const key = normalizeTeamNameKey(teamName);
  return (
    byName.get(key) ??
    MLB_FALLBACK_BY_NAME[key]?.team ??
    teamName.slice(0, 3).toUpperCase()
  );
}

/**
 * Today's MLB slate only (`official_date` in ET). The nightly render job
 * repopulates `mlb_games_today` each morning; we keep showing this slate all day.
 */
async function fetchMLBSlateGames(): Promise<OutliersTrendsGame[]> {
  const { data, error } = await collegeFootballSupabase
    .from('mlb_games_today')
    .select(MLB_GAME_COLUMNS)
    .eq('official_date', todayET())
    .order('game_time_et', { ascending: true });
  if (error) throw error;

  const active = (data ?? []).filter((row: Record<string, unknown>) => row.is_postponed !== true);
  if (active.length === 0) return [];

  const pks = active
    .map((row: Record<string, unknown>) => toInt(row.game_pk))
    .filter((pk): pk is number => pk !== null);
  const [scheduleMeta, oddsMeta, teamMaps] = await Promise.all([
    fetchMLBScheduleMeta(pks),
    fetchMLBOddsSnapshots(pks),
    fetchMLBTeamAbbrMaps(),
  ]);
  const season = currentMLBSeason();

  const games: OutliersTrendsGame[] = [];
  for (const row of active as Record<string, unknown>[]) {
    const pk = toInt(row.game_pk);
    if (pk === null) continue;
    const awayName = toStr(row.away_team_name) ?? 'Away';
    const homeName = toStr(row.home_team_name) ?? 'Home';
    const awayAb = resolveMLBAbbr(toInt(row.away_team_id), awayName, teamMaps.byName, teamMaps.byId);
    const homeAb = resolveMLBAbbr(toInt(row.home_team_id), homeName, teamMaps.byName, teamMaps.byId);
    const kickoff = toStr(row.game_time_et) ?? toStr(row.official_date);
    const odds = oddsMeta.get(pk);
    games.push({
      id: String(pk),
      season,
      week: 0,
      awayAb,
      homeAb,
      awayTeam: awayName,
      homeTeam: homeName,
      fgSpreadClose: toNum(row.home_spread),
      fgTotalClose: toNum(row.total_line),
      kickoff,
      slot: null,
      assignedReferee: null,
      mlbContext: {
        homeMl: toNum(row.home_ml),
        awayMl: toNum(row.away_ml),
        homeSpread: toNum(row.home_spread),
        awaySpread: toNum(row.away_spread),
        totalLine: toNum(row.total_line),
        f5HomeMl: toNum(row.f5_home_ml),
        f5AwayMl: toNum(row.f5_away_ml),
        f5HomeSpread: toNum(row.f5_home_spread),
        f5AwaySpread: toNum(row.f5_away_spread),
        f5TotalLine: toNum(row.f5_total_line),
        homeSpreadOdds: odds?.homeSpreadOdds ?? null,
        awaySpreadOdds: odds?.awaySpreadOdds ?? null,
        totalOverOdds: odds?.totalOverOdds ?? null,
        totalUnderOdds: odds?.totalUnderOdds ?? null,
        f5HomeSpreadOdds: odds?.f5HomeSpreadOdds ?? null,
        f5AwaySpreadOdds: odds?.f5AwaySpreadOdds ?? null,
        f5TotalOverOdds: odds?.f5TotalOverOdds ?? null,
        f5TotalUnderOdds: odds?.f5TotalUnderOdds ?? null,
        isDivisional: isDivisionGame(homeAb, awayAb),
        isDayGame: isDayGame(kickoff),
        seriesGameNumber: scheduleMeta.get(pk) ?? null,
      },
    });
  }
  return games;
}

async function fetchMLBTeamTrends(season: number, teamAbbrs: string[]): Promise<MLBTeamTrendRecord[]> {
  if (teamAbbrs.length === 0) return [];
  const { data, error } = await collegeFootballSupabase
    .from('mlb_team_trends')
    .select(MLB_TEAM_TREND_COLUMNS)
    .eq('season', season)
    .in('team_abbr', teamAbbrs);
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>): MLBTeamTrendRecord => ({
    teamAbbr: toStr(row.team_abbr) ?? toStr(row.team) ?? '',
    teamName: toStr(row.team_name),
    season: toInt(row.season) ?? season,
    throughDate: toStr(row.through_date),
    splits: decodeSplits(row.splits),
    matchups: decodeMatchups(row.matchups),
  }));
}

export async function fetchMLBBundle(): Promise<MLBTrendsSlateBundle> {
  const games = await fetchMLBSlateGames();
  const first = games[0];
  if (!first) {
    return { games: [], season: currentMLBSeason(), throughDate: null, teams: [] };
  }
  const teamAbbrs = Array.from(new Set(games.flatMap((g) => [g.homeAb, g.awayAb]))).sort();
  const trendsAbbrs = Array.from(new Set(teamAbbrs.map((ab) => trendsAbbr(ab)))).sort();
  const teamsRaw = await fetchMLBTeamTrends(first.season, trendsAbbrs);
  const appAbbrByTrends = new Map(teamAbbrs.map((ab) => [trendsAbbr(ab), ab]));
  const teams = teamsRaw.map((record) =>
    remapTeamRecord(record, appAbbrByTrends.get(record.teamAbbr.toUpperCase()) ?? null),
  );
  const throughDate =
    teams
      .map((t) => t.throughDate)
      .filter((d): d is string => !!d)
      .sort()
      .pop() ?? null;
  return { games, season: first.season, throughDate, teams };
}

// MARK: - Splits / matchups JSONB decoding

function decodeSplitCell(raw: unknown): TrendSplitCell | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const h = toNum(obj.h);
  const l = toNum(obj.l);
  const n = toNum(obj.n);
  if (h === null || l === null || n === null) return null;
  const pct = toNum(obj.pct) ?? (n > 0 ? h / n : 0);
  return { h: Math.trunc(h), l: Math.trunc(l), p: toInt(obj.p), n: Math.trunc(n), pct };
}

export function decodeSplits(raw: unknown): TrendSplits {
  const value = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!value || typeof value !== 'object') return {};
  const out: TrendSplits = {};
  for (const [market, marketVal] of Object.entries(value as Record<string, unknown>)) {
    if (!marketVal || typeof marketVal !== 'object') continue;
    const dimMap: Record<string, Record<string, TrendSplitCell>> = {};
    for (const [dim, dimVal] of Object.entries(marketVal as Record<string, unknown>)) {
      if (!dimVal || typeof dimVal !== 'object') continue;
      const winMap: Record<string, TrendSplitCell> = {};
      for (const [window, winVal] of Object.entries(dimVal as Record<string, unknown>)) {
        const cell = decodeSplitCell(winVal);
        if (cell) winMap[window] = cell;
      }
      if (Object.keys(winMap).length > 0) dimMap[dim] = winMap;
    }
    if (Object.keys(dimMap).length > 0) out[market] = dimMap;
  }
  return out;
}

function decodeH2HCell(raw: unknown): TrendH2HCell | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const h = toNum(obj.h);
  const n = toNum(obj.n);
  if (h === null || n === null) return null;
  const pct = toNum(obj.pct) ?? (n > 0 ? h / n : null);
  return { h: Math.trunc(h), n: Math.trunc(n), pct };
}

export function decodeMatchups(raw: unknown): Record<string, TrendMatchupRecord> {
  const value = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, TrendMatchupRecord> = {};
  for (const [opp, oppVal] of Object.entries(value as Record<string, unknown>)) {
    if (!oppVal || typeof oppVal !== 'object') continue;
    const obj = oppVal as Record<string, unknown>;
    const markets: Record<string, TrendH2HCell> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'meetings') continue;
      const cell = decodeH2HCell(val);
      if (cell) markets[key] = cell;
    }
    out[opp] = { meetings: toInt(obj.meetings), markets };
  }
  return out;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
