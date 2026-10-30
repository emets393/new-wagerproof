import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { FootballTeamTrend } from '../cfb/FootballTeamTrends';
import type { MetricDirection, TrendRowDef } from '../nba/TrendsTable';

/**
 * College game detail, joined on the CBBD game id.
 *
 * `ncaab_model_preds` is one row per game × market (spread, total, h1_spread, h1_total).
 * On a first-half row the model_* / market_* columns are first-half numbers.
 * A play is `tier === 'bet'` only. `bet_side` is written on passes too.
 *
 * Flags join `ncaab_slate_flags.game_id` to that same id. A def whose tier is
 * `candidate`, or a flag whose tier is `tracking`, is a read and not a play.
 */

export const THRILL_EMPTY = 'The watchability score posts the morning of the game.';

export const EARLY_SEASON_NOTE =
  'Season records start after opening night. Last five and head-to-head still use prior seasons. In-season rating fields stay blank until games are played.';

const PROVIDER_NAME = /\bkenpom(?:'s|’s)?\b/gi;

export type H2HCount = { h: number; n: number; pct: number | null };

/** One prior meeting, from the current home team's side. Letters are that team's. */
export type NcaabH2HGame = {
  date: string | null;
  season: number | null;
  is_home: boolean;
  neutral: boolean;
  tournament: string | null;
  game_type: string | null;
  team_pts: number | null;
  opp_pts: number | null;
  h1_team_pts: number | null;
  h1_opp_pts: number | null;
  spread: number | null;
  total: number | null;
  ml: number | null;
  tt_line: number | null;
  h1_spread: number | null;
  h1_total: number | null;
  h1_ml: number | null;
  su: string | null;
  ats: string | null;
  ou: string | null;
  tt: string | null;
  h1_su: string | null;
  h1_ats: string | null;
  h1_ou: string | null;
  cover_margin: number | null;
  ou_margin: number | null;
  cbbd_id: number | null;
};

/**
 * `ncaab_team_trends.matchups[awayTeamId]` on the home team's row.
 * Counts are the home team's. `games` is newest first.
 */
export type NcaabHeadToHead = {
  opp: string | null;
  opp_id: number | null;
  meetings: number;
  spread: H2HCount;
  total: H2HCount;
  moneyline: H2HCount;
  h1_spread: H2HCount;
  h1_total: H2HCount;
  h1_moneyline: H2HCount;
  team_total: H2HCount;
  games: NcaabH2HGame[];
};

export type ModelLine = {
  market: string;
  label: string;
  model: string;
  posted: string;
  disagreement: string;
  play: boolean;
  betSide: string | null;
  /** Home margin (home points minus away). Null on a total row. */
  modelMargin: number | null;
  modelTotal: number | null;
  /** Posted home spread. Null on a total row. */
  marketSpread: number | null;
  marketTotal: number | null;
  disagreementPts: number | null;
};

export type FiredSignal = {
  key: string;
  name: string;
  market: string;
  side: string;
  trigger: string;
  record: string;
  seasonRecord: string;
  play: boolean;
};

export type NcaabGameDetail = {
  fullGame: ModelLine[];
  firstHalf: ModelLine[];
  signals: FiredSignal[];
  trendsByKey: Record<string, FootballTeamTrend>;
  headToHead: NcaabHeadToHead;
  ratingRows: TrendRowDef[];
  awayRecord: string | null;
  homeRecord: string | null;
  thrill: {
    score: number;
    projected: string | null;
    tempo: string | null;
    winChance: string | null;
  } | null;
  earlySeason: boolean;
};

/** College seasons are END-year: October 2026 is the 2027 season. June flips. */
export function ncaabSeasonEnd(isoDate: string | null | undefined, now = new Date()): number {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate || '');
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) : now.getMonth() + 1;
  return month >= 6 ? year + 1 : year;
}

export function hideRatingsProvider(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(PROVIDER_NAME, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function cleanText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const joined = value
      .map((part) => cleanText(part))
      .filter((part): part is string => Boolean(part))
      .join(', ');
    return joined || null;
  }
  if (typeof value !== 'string') return null;
  const text = hideRatingsProvider(value);
  return text || null;
}

export function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 't' || value === 1 || value === '1';
}

/** Feed codes that are not a tournament name. STD is a standard game. */
const GAME_TYPE_LABELS: Record<string, string | null> = {
  STD: null,
  STANDARD: null,
  REG: null,
  TRNMNT: 'Tournament',
  TOURNAMENT: 'Tournament',
};

export function tournamentPill(tournament: unknown, gameType: unknown): string | null {
  const named = cleanText(tournament);
  if (named) return named;
  const kind = cleanText(gameType);
  if (!kind || /regular/i.test(kind)) return null;
  const mapped = GAME_TYPE_LABELS[kind.toUpperCase()];
  if (mapped !== undefined) return mapped;
  return kind;
}

export type NcaabPredictedScore = { away: number; home: number };

/** Per-team finals when the row has them, otherwise the model's total and margin. */
export function ncaabPredictedScore(raw: {
  home_score_pred?: unknown;
  away_score_pred?: unknown;
  pred_over_line?: unknown;
  pred_home_margin?: unknown;
  pred_spread?: unknown;
} | null | undefined): NcaabPredictedScore | null {
  const home = num(raw?.home_score_pred);
  const away = num(raw?.away_score_pred);
  if (home !== null && away !== null) return { away, home };
  const total = num(raw?.pred_over_line);
  const homeMargin = num(raw?.pred_home_margin);
  const fairSpread = num(raw?.pred_spread);
  const margin = homeMargin ?? (fairSpread === null ? null : -fairSpread);
  if (total === null || margin === null) return null;
  return { home: (total + margin) / 2, away: (total - margin) / 2 };
}

export function headerContextPills(input: {
  neutralSite: unknown;
  tournament: unknown;
  broadcasts: unknown;
  gameType: unknown;
}): string[] {
  const pills: string[] = [];
  if (asBool(input.neutralSite)) pills.push('Neutral');
  const tournament = tournamentPill(input.tournament, input.gameType);
  if (tournament) pills.push(tournament);
  const tv = cleanText(input.broadcasts);
  if (tv) pills.push(tv);
  return pills;
}

export function pointsLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function spreadLabel(value: number): string {
  const text = pointsLabel(value);
  return value > 0 ? `+${text}` : text;
}

export function modelIsPlay(tier: unknown): boolean {
  return String(tier || '').toLowerCase() === 'bet';
}

/** Active defs badge a play. Tracking flags, and candidate defs, stay a read. */
export function signalIsPlay(defTier: unknown, flagTier: unknown): boolean {
  return String(defTier || '').toLowerCase() === 'active' && String(flagTier || '').toLowerCase() !== 'tracking';
}

export function disagreementSentence(
  market: string,
  disagreement: number | null,
  home: string,
  away: string,
): string {
  if (disagreement === null) return '';
  const magnitude = Math.abs(disagreement);
  if (magnitude < 0.05) return 'In line with the posted number.';
  const points = pointsLabel(magnitude);
  const unit = points === '1' ? 'point' : 'points';
  if (market.includes('total')) {
    return `${points} ${unit} toward ${disagreement > 0 ? 'the over' : 'the under'}.`;
  }
  return `${points} ${unit} toward ${disagreement > 0 ? home : away}.`;
}

export function letters(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  const raw = value.trim();
  if (raw.startsWith('[')) {
    try {
      return letters(JSON.parse(raw));
    } catch {
      /* fall through to a comma split */
    }
  }
  return raw
    .replace(/[{}]/g, '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

const EMPTY_COUNT: H2HCount = { h: 0, n: 0, pct: null };

function countOf(value: unknown): H2HCount {
  const record = asRecord(value);
  if (!record) return { ...EMPTY_COUNT };
  return {
    h: num(record.h) ?? 0,
    n: num(record.n) ?? 0,
    pct: num(record.pct),
  };
}

function resultLetter(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  return text.slice(0, 1).toUpperCase();
}

function parseMeeting(value: unknown): NcaabH2HGame | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    date: cleanText(row.date),
    season: num(row.season),
    is_home: asBool(row.is_home),
    neutral: asBool(row.neutral),
    tournament: cleanText(row.tournament),
    game_type: cleanText(row.game_type),
    team_pts: num(row.team_pts),
    opp_pts: num(row.opp_pts),
    h1_team_pts: num(row.h1_team_pts),
    h1_opp_pts: num(row.h1_opp_pts),
    spread: num(row.spread),
    total: num(row.total),
    ml: num(row.ml),
    tt_line: num(row.tt_line),
    h1_spread: num(row.h1_spread),
    h1_total: num(row.h1_total),
    h1_ml: num(row.h1_ml),
    su: resultLetter(row.su),
    ats: resultLetter(row.ats),
    ou: resultLetter(row.ou),
    tt: resultLetter(row.tt),
    h1_su: resultLetter(row.h1_su),
    h1_ats: resultLetter(row.h1_ats),
    h1_ou: resultLetter(row.h1_ou),
    cover_margin: num(row.cover_margin),
    ou_margin: num(row.ou_margin),
    cbbd_id: num(row.cbbd_id),
  };
}

export function emptyHeadToHead(): NcaabHeadToHead {
  return {
    opp: null,
    opp_id: null,
    meetings: 0,
    spread: { ...EMPTY_COUNT },
    total: { ...EMPTY_COUNT },
    moneyline: { ...EMPTY_COUNT },
    h1_spread: { ...EMPTY_COUNT },
    h1_total: { ...EMPTY_COUNT },
    h1_moneyline: { ...EMPTY_COUNT },
    team_total: { ...EMPTY_COUNT },
    games: [],
  };
}

/** Home-team matchup entry. Missing entry is a series with no meetings. */
export function parseHeadToHead(value: unknown): NcaabHeadToHead {
  const entry = asRecord(value);
  if (!entry) return emptyHeadToHead();
  const games = (Array.isArray(entry.games) ? entry.games : [])
    .map(parseMeeting)
    .filter((game): game is NcaabH2HGame => game !== null)
    .sort((a, b) => {
      const byDate = (b.date || '').localeCompare(a.date || '');
      if (byDate !== 0) return byDate;
      return (b.cbbd_id ?? 0) - (a.cbbd_id ?? 0);
    });
  const meetings = num(entry.meetings) ?? games.length;
  return {
    opp: cleanText(entry.opp),
    opp_id: num(entry.opp_id),
    meetings,
    spread: countOf(entry.spread),
    total: countOf(entry.total),
    moneyline: countOf(entry.moneyline),
    h1_spread: countOf(entry.h1_spread),
    h1_total: countOf(entry.h1_total),
    h1_moneyline: countOf(entry.h1_moneyline),
    team_total: countOf(entry.team_total),
    games,
  };
}

/**
 * Stored letters belong to the home team. Win/loss flips for the away team.
 * Over/under/push is the same result for both.
 */
export function awayResultLetter(letter: string | null, shared: boolean): string | null {
  if (!letter) return null;
  if (shared) return letter;
  if (letter === 'W') return 'L';
  if (letter === 'L') return 'W';
  return letter;
}

/** "Arizona 6-4 ATS · UCLA 4-6 ATS", or "4 over, 6 under" on a total. */
export function headToHeadSummary(
  record: H2HCount,
  kind: 'ats' | 'wins' | 'total',
  homeName: string,
  awayName: string,
): string {
  if (record.n <= 0) return '—';
  const losses = record.n - record.h;
  if (kind === 'total') return `${record.h} over, ${losses} under`;
  const tag = kind === 'ats' ? ' ATS' : '';
  return `${homeName} ${record.h}-${losses}${tag} · ${awayName} ${losses}-${record.h}${tag}`;
}

const MODEL_LABEL: Record<string, string> = {
  spread: 'Spread',
  total: 'Total',
  h1_spread: '1st half spread',
  h1_total: '1st half total',
};

function buildModelLine(
  market: string,
  row: Record<string, unknown> | undefined,
  home: string,
  away: string,
): ModelLine {
  const label = MODEL_LABEL[market] || market;
  if (!row) {
    return {
      market,
      label,
      model: '—',
      posted: '—',
      disagreement: 'No line posted.',
      play: false,
      betSide: null,
      modelMargin: null,
      modelTotal: null,
      marketSpread: null,
      marketTotal: null,
      disagreementPts: null,
    };
  }
  const play = modelIsPlay(row.tier);
  const isTotal = market.includes('total');
  const margin = num(row.model_home_margin);
  const modelTotal = num(row.model_total);
  const postedSpread = num(row.market_home_spread);
  const postedTotal = num(row.market_total);
  const model =
    isTotal
      ? modelTotal === null
        ? '—'
        : pointsLabel(modelTotal)
      : margin === null
        ? '—'
        : `${home} ${spreadLabel(-margin)}`;
  const posted =
    isTotal
      ? postedTotal === null
        ? '—'
        : pointsLabel(postedTotal)
      : postedSpread === null
        ? '—'
        : `${home} ${spreadLabel(postedSpread)}`;
  return {
    market,
    label,
    model,
    posted,
    disagreement: disagreementSentence(market, num(row.disagreement), home, away),
    play,
    betSide: play ? cleanText(row.bet_side) : null,
    modelMargin: margin,
    modelTotal,
    marketSpread: postedSpread,
    marketTotal: postedTotal,
    disagreementPts: num(row.disagreement),
  };
}

function toFootballTrend(row: Record<string, unknown>): FootballTeamTrend {
  const name = cleanText(row.team_name) || '';
  const log = Array.isArray(row.game_log) ? row.game_log : [];
  return {
    key: name,
    teamName: name,
    games: num(row.games),
    suW: num(row.su_w),
    suL: num(row.su_l),
    suRecord: cleanText(row.su_record),
    atsW: num(row.ats_w),
    atsL: num(row.ats_l),
    atsP: num(row.ats_p),
    atsPct: num(row.ats_pct),
    ouO: num(row.ou_o),
    ouU: num(row.ou_u),
    ouP: num(row.ou_p),
    overPct: num(row.over_pct),
    ttO: num(row.tt_o),
    ttU: num(row.tt_u),
    ttOverPct: num(row.tt_over_pct),
    h1AtsW: num(row.h1_ats_w),
    h1AtsL: num(row.h1_ats_l),
    h1AtsP: num(row.h1_ats_p),
    h1AtsPct: num(row.h1_ats_pct),
    h1OuO: num(row.h1_ou_o),
    h1OuU: num(row.h1_ou_u),
    h1OverPct: num(row.h1_over_pct),
    last5Su: letters(row.last5_su),
    last5Ats: letters(row.last5_ats),
    last5Ou: letters(row.last5_ou),
    last5Tt: letters(row.last5_tt),
    last5H1Ats: letters(row.last5_h1_ats),
    last5H1Ou: letters(row.last5_h1_ou),
    gameLog: log,
  };
}

function recordLine(wins: unknown, losses: unknown): string | null {
  const w = num(wins);
  const l = num(losses);
  if (w === null && l === null) return null;
  return `${w ?? 0}-${l ?? 0}`;
}

function ratingValue(row: Record<string, unknown> | undefined, key: string): number | null {
  return row ? num(row[key]) : null;
}

function formatRank(value: number): string {
  return `#${Math.round(value)}`;
}

function formatOne(value: number): string {
  return pointsLabel(value);
}

export function ratingTableRows(
  away: Record<string, unknown> | null,
  home: Record<string, unknown> | null,
): TrendRowDef[] {
  const row = (
    label: string,
    key: string,
    direction: MetricDirection,
    format: (value: number) => string,
    diffCap: number,
  ): TrendRowDef => ({
    label,
    away: ratingValue(away ?? undefined, key),
    home: ratingValue(home ?? undefined, key),
    direction,
    format,
    diffCap,
  });
  return [
    row('Rating', 'rating', 'higher', formatOne, 15),
    row('Rating rank', 'rating_rank', 'lower', formatRank, 40),
    row('Adj. offense', 'adj_offense', 'higher', formatOne, 20),
    row('Offense rank', 'adj_offense_rank', 'lower', formatRank, 40),
    row('Adj. defense', 'adj_defense', 'lower', formatOne, 12),
    row('Defense rank', 'adj_defense_rank', 'lower', formatRank, 40),
    row('Tempo', 'tempo', 'neutral', formatOne, 8),
    row('Tempo rank', 'tempo_rank', 'neutral', formatRank, 40),
    row('Luck', 'luck', 'neutral', (value) => value.toFixed(3), 0.1),
    row('Strength of schedule', 'sos', 'neutral', (value) => value.toFixed(2), 5),
  ];
}

export function showEarlySeasonNote(awayGames: number | null, homeGames: number | null, loaded: boolean): boolean {
  if (!loaded) return false;
  return (awayGames ?? 0) === 0 || (homeGames ?? 0) === 0;
}

function thrillView(row: Record<string, unknown> | null, home: string): NcaabGameDetail['thrill'] {
  if (!row) return null;
  const score = num(row.thrill_score);
  if (score === null) return null;
  const homePred = num(row.home_pred);
  const awayPred = num(row.away_pred);
  const tempo = num(row.pred_tempo);
  const win = num(row.home_win_prob);
  const winPct = win === null ? null : Math.round((win <= 1 ? win * 100 : win));
  return {
    score,
    projected: homePred !== null && awayPred !== null ? `${pointsLabel(awayPred)}–${pointsLabel(homePred)}` : null,
    tempo: tempo === null ? null : pointsLabel(tempo),
    winChance: winPct === null ? null : `${home} ${winPct}%`,
  };
}

const TREND_COLUMNS =
  'team_id,team_name,games,su_w,su_l,su_record,ats_w,ats_l,ats_p,ats_pct,ou_o,ou_u,ou_p,over_pct,tt_o,tt_u,tt_over_pct,h1_ats_w,h1_ats_l,h1_ats_p,h1_ats_pct,h1_ou_o,h1_ou_u,h1_over_pct,last5_su,last5_ats,last5_ou,last5_tt,last5_h1_ats,last5_h1_ou,game_log,matchups';

const RATING_COLUMNS =
  'team_id,team_name,wins,losses,rating,rating_rank,adj_offense,adj_offense_rank,adj_defense,adj_defense_rank,tempo,tempo_rank,luck,sos';

async function rows(table: string, select: string, filter: (query: any) => any): Promise<Record<string, unknown>[] | null> {
  const query = filter(collegeFootballSupabase.from(table).select(select));
  const { data, error } = await query;
  if (error || !data) return null;
  return data as Record<string, unknown>[];
}

export async function fetchNcaabGameDetail(input: {
  gameId: number;
  gameDate: string;
  homeName: string;
  awayName: string;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
}): Promise<NcaabGameDetail> {
  const season = ncaabSeasonEnd(input.gameDate);
  const homeId = num(input.homeTeamId);
  const awayId = num(input.awayTeamId);
  const teamIds = [homeId, awayId].filter((id): id is number => id !== null);

  const [modelRows, flagRows, defs, trendRows, ratingRows, fanmatchRows] = await Promise.all([
    rows(
      'ncaab_model_preds',
      'game_id,market,model_home_margin,model_total,market_home_spread,market_total,disagreement,tier,bet_side',
      (query) => query.eq('game_id', input.gameId),
    ),
    rows(
      'ncaab_slate_flags',
      'game_id,signal_key,market,side,tier,trigger_text,record_text',
      (query) => query.eq('game_id', input.gameId),
    ),
    rows(
      'ncaab_signal_defs',
      'signal_key,display_name,one_liner,market,tier,record_text,season_record_text',
      (query) => query,
    ),
    teamIds.length
      ? rows('ncaab_team_trends', TREND_COLUMNS, (query) => query.in('team_id', teamIds).eq('season', season))
      : Promise.resolve([]),
    teamIds.length
      ? rows('ncaab_team_ratings', RATING_COLUMNS, (query) => query.in('team_id', teamIds).eq('season', season))
      : Promise.resolve([]),
    rows(
      'ncaab_fanmatch_daily',
      'cbbd_game_id,home_pred,away_pred,home_win_prob,pred_tempo,thrill_score',
      (query) => query.eq('cbbd_game_id', input.gameId).limit(1),
    ),
  ]);

  const byMarket = new Map((modelRows || []).map((row) => [String(row.market), row]));
  const line = (market: string) => buildModelLine(market, byMarket.get(market), input.homeName, input.awayName);

  const defByKey = new Map((defs || []).map((def) => [String(def.signal_key), def]));
  const signals: FiredSignal[] = (flagRows || [])
    .map((flag) => {
      const key = String(flag.signal_key || '');
      const def = defByKey.get(key);
      return {
        key,
        name: cleanText(def?.display_name) || key,
        market: cleanText(flag.market) || cleanText(def?.market) || '',
        side: cleanText(flag.side) || '',
        trigger: cleanText(flag.trigger_text) || '',
        record: cleanText(def?.record_text) || cleanText(flag.record_text) || '',
        seasonRecord: cleanText(def?.season_record_text) || '',
        play: signalIsPlay(def?.tier, flag.tier),
      };
    })
    .sort((a, b) => Number(b.play) - Number(a.play) || a.name.localeCompare(b.name));

  const trends = trendRows || [];
  const homeTrend = trends.find((row) => num(row.team_id) === homeId) || null;
  const awayTrend = trends.find((row) => num(row.team_id) === awayId) || null;
  const trendsByKey: Record<string, FootballTeamTrend> = {};
  if (awayTrend) {
    const mapped = toFootballTrend(awayTrend);
    if (mapped.key) trendsByKey[mapped.key] = mapped;
    trendsByKey[input.awayName] = mapped;
  }
  if (homeTrend) {
    const mapped = toFootballTrend(homeTrend);
    if (mapped.key) trendsByKey[mapped.key] = mapped;
    trendsByKey[input.homeName] = mapped;
  }

  const homeMatchups = asRecord(homeTrend?.matchups);
  const headToHead = parseHeadToHead(
    awayId !== null && homeMatchups ? homeMatchups[String(awayId)] : null,
  );

  const ratings = ratingRows || [];
  const homeRating = ratings.find((row) => num(row.team_id) === homeId) || null;
  const awayRating = ratings.find((row) => num(row.team_id) === awayId) || null;

  return {
    fullGame: [line('spread'), line('total')],
    firstHalf: [line('h1_spread'), line('h1_total')],
    signals,
    trendsByKey,
    headToHead,
    ratingRows: ratingTableRows(awayRating, homeRating),
    awayRecord: recordLine(awayRating?.wins, awayRating?.losses),
    homeRecord: recordLine(homeRating?.wins, homeRating?.losses),
    thrill: thrillView(fanmatchRows?.[0] ?? null, input.homeName),
    earlySeason: showEarlySeasonNote(num(awayTrend?.games), num(homeTrend?.games), trendRows !== null),
  };
}
