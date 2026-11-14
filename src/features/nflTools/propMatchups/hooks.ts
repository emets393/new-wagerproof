import { useQuery } from '@tanstack/react-query';
import { parseCheatRows, type CheatRow } from './cheatsheet';
import type { LedgerRow } from './recordSheet';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { resolveNflPropPagesWeek } from '@/features/games/api/footballSlate';
import type { NflPropPlayerPage, NflPropPlayerTrends, NflPropSpotlight, PropSlateAnchor } from '@/features/propBreakdown/types';
import { normalizePlayerPage, normalizeSpotlight, parseFpCards } from './fpCards';

const PAGE_COLUMNS = [
  'player_id', 'season', 'week', 'player_name', 'position', 'team', 'opponent', 'is_home',
  'game_label', 'kickoff', 'headshot_url', 'markets', 'baseline', 'ngs', 'scheme', 'highlights',
  'projection', 'research', 'fp_cards', 'scheme_game_splits', 'rookie',
].join(',');

const STALE = 5 * 60 * 1000;

// Soonest upcoming kickoff, not max week: the Monday preview build publishes next week's
// player pages while the current week's Monday-night game is still pending, and its props
// stay bettable until kickoff. Shared with the games feed — see footballSlate.ts.
const resolveLatestSlate = (): Promise<PropSlateAnchor> => resolveNflPropPagesWeek();

export function useNflPropMatchupsSlate() {
  return useQuery({
    queryKey: ['nflPropMatchups', 'slate'],
    queryFn: resolveLatestSlate,
    staleTime: STALE,
  });
}

/** Published weeks for a season. One small column, grouped in the client. */
export function useNflPropSeasonWeeks(season?: number) {
  return useQuery({
    queryKey: ['nflPropMatchups', 'weeks', season],
    enabled: season != null,
    staleTime: STALE,
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_prop_player_pages')
        .select('week')
        .eq('season', season!);
      if (error) throw error;
      return [...new Set((data ?? []).map((row) => row.week as number))].sort((a, b) => a - b);
    },
  });
}

/** Full week of player pages — grouped into games client-side. */
export function useNflPropMatchupsPages(override?: { season: number; week: number }) {
  const slate = useNflPropMatchupsSlate();
  const season = override?.season ?? slate.data?.season;
  const week = override?.week ?? slate.data?.week;
  return useQuery({
    queryKey: ['nflPropMatchups', 'pages', season, week],
    enabled: season != null && week != null,
    staleTime: STALE,
    queryFn: async (): Promise<NflPropPlayerPage[]> => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_prop_player_pages')
        .select(PAGE_COLUMNS)
        .eq('season', season!)
        .eq('week', week!);
      if (error) throw error;
      return ((data ?? []) as unknown as NflPropPlayerPage[]).map((row) => normalizePlayerPage(row));
    },
  });
}

/** One player's granular card. The week query already includes fp_cards; this is the single-row read. */
export function useNflPropFpCards(season?: number, week?: number, playerId?: string | null) {
  return useQuery({
    queryKey: ['nflPropMatchups', 'fpCards', season, week, playerId],
    enabled: season != null && week != null && Boolean(playerId),
    staleTime: STALE,
    queryFn: async (): Promise<NflPropPlayerPage['fp_cards']> => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_prop_player_pages')
        .select('fp_cards')
        .eq('season', season!)
        .eq('week', week!)
        .eq('player_id', playerId!)
        .maybeSingle();
      if (error) throw error;
      return parseFpCards((data as { fp_cards?: unknown } | null)?.fp_cards);
    },
  });
}

export interface NflSlateLine {
  home_ab: string;
  away_ab: string;
  fg_spread_close: number | null;
  fg_total_close: number | null;
  fg_ml_home_close: number | null;
  fg_ml_away_close: number | null;
  wx_indoors: boolean | null;
  wx_summary: string | null;
  wx_temp_f: number | null;
  wx_wind_mph: number | null;
  wx_precip_mm: number | null;
}

export interface NflPropBookQuote {
  overBook: string | null;
  overLine: number | null;
  overPrice: number | null;
  underBook: string | null;
  underLine: number | null;
  underPrice: number | null;
}

function bookNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Best over and under book for each player market. The page line is not assumed to be either book. */
export function useNflPropBooks(season?: number, week?: number) {
  return useQuery({
    queryKey: ['nflPropMatchups', 'books', season, week],
    enabled: season != null && week != null,
    staleTime: STALE,
    queryFn: async (): Promise<Map<string, NflPropBookQuote>> => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_slate_props')
        .select('player_id,market,best_over_book,best_over_line,best_over_price,best_under_book,best_under_line,best_under_price')
        .eq('season', season!)
        .eq('week', week!);
      if (error) throw error;
      const quotes = new Map<string, NflPropBookQuote>();
      for (const row of data ?? []) {
        const record = row as Record<string, unknown>;
        const playerId = String(record.player_id ?? '');
        const market = String(record.market ?? '');
        if (!playerId || !market) continue;
        quotes.set(`${playerId}:${market}`, {
          overBook: typeof record.best_over_book === 'string' ? record.best_over_book : null,
          overLine: bookNum(record.best_over_line),
          overPrice: bookNum(record.best_over_price),
          underBook: typeof record.best_under_book === 'string' ? record.best_under_book : null,
          underLine: bookNum(record.best_under_line),
          underPrice: bookNum(record.best_under_price),
        });
      }
      return quotes;
    },
  });
}

export function quotesForPlayer(
  quotes: Map<string, NflPropBookQuote> | undefined,
  playerId: string | undefined,
  markets: { key: string }[],
): Record<string, NflPropBookQuote> {
  const out: Record<string, NflPropBookQuote> = {};
  if (!quotes || !playerId) return out;
  for (const market of markets) {
    const quote = quotes.get(`${playerId}:${market.key}`);
    if (quote) out[market.key] = quote;
  }
  return out;
}

function weatherLine(row: NflSlateLine): string | null {
  if (row.wx_indoors === true) return 'Indoors';
  if (row.wx_summary) return row.wx_summary;
  const parts: string[] = [];
  if (typeof row.wx_temp_f === 'number') parts.push(`${Math.round(row.wx_temp_f)}°F`);
  if (typeof row.wx_wind_mph === 'number') parts.push(`wind ${Math.round(row.wx_wind_mph)} mph`);
  if (typeof row.wx_precip_mm === 'number' && row.wx_precip_mm > 0) parts.push(`${row.wx_precip_mm.toFixed(1)} mm`);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Spread, total, market-implied score, and the posted weather. No betting side. */
export function slateContextFacts(
  page: { team: string; opponent: string; is_home: boolean },
  rows: NflSlateLine[],
): { label: string; value: string }[] {
  const home = page.is_home ? page.team : page.opponent;
  const away = page.is_home ? page.opponent : page.team;
  const row = rows.find((item) => item.home_ab === home && item.away_ab === away);
  if (!row) return [];
  const facts: { label: string; value: string }[] = [];
  const homeSpread = typeof row.fg_spread_close === 'number' ? row.fg_spread_close : null;
  const total = typeof row.fg_total_close === 'number' ? row.fg_total_close : null;
  const teamSpread = homeSpread == null ? null : page.is_home ? homeSpread : -homeSpread;
  if (teamSpread != null) facts.push({ label: 'Team spread', value: `${page.team} ${teamSpread > 0 ? '+' : ''}${teamSpread}` });
  if (total != null) facts.push({ label: 'Total', value: String(total) });
  if (homeSpread != null && total != null) {
    const homeImplied = (total - homeSpread) / 2;
    const awayImplied = (total + homeSpread) / 2;
    facts.push({ label: 'Implied', value: `${away} ${awayImplied.toFixed(1)} · ${home} ${homeImplied.toFixed(1)}` });
  }
  const weather = weatherLine(row);
  if (weather) facts.push({ label: 'Weather', value: weather });
  return facts;
}

/** Posted full-game spread, total, moneyline, and weather for the week. Sixteen rows, not the prop cards. */
export function useNflSlateLines(season?: number, week?: number) {
  return useQuery({
    queryKey: ['nflPropMatchups', 'slateLines', season, week, 'context'],
    enabled: season != null && week != null,
    staleTime: STALE,
    queryFn: async (): Promise<NflSlateLine[]> => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_slate_feed')
        .select('home_ab,away_ab,fg_spread_close,fg_total_close,fg_ml_home_close,fg_ml_away_close,wx_indoors,wx_summary,wx_temp_f,wx_wind_mph,wx_precip_mm')
        .eq('season', season!)
        .eq('week', week!);
      if (error) throw error;
      return (data ?? []) as NflSlateLine[];
    },
  });
}

const SPOTLIGHT_COLUMNS =
  'season,week,player_id,player_name,position,team,opponent,market,market_label,side,line,net,n_for,n_against,board_rank,tells,narrative,narrative_model,result,actual_value,kickoff,headshot_url';

/** The week's spotlight board. Short stale time — an ungraded pick can be withdrawn mid-week. */
export function useNflPropSpotlight(season?: number, week?: number) {
  return useQuery({
    queryKey: ['nflPropMatchups', 'spotlight', season, week],
    enabled: season != null && week != null,
    staleTime: 60_000,
    queryFn: async (): Promise<NflPropSpotlight[]> => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_prop_spotlight')
        .select(SPOTLIGHT_COLUMNS)
        .eq('season', season!)
        .eq('week', week!)
        .order('board_rank', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => normalizeSpotlight(row as Record<string, unknown>));
    },
  });
}

/** Graded spotlight results only. Empty until a game has been played — do not invent a rate. */
export function useNflPropSpotlightRecord() {
  return useQuery({
    queryKey: ['nflPropMatchups', 'spotlight-record'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_prop_spotlight')
        .select('result')
        .not('result', 'is', null);
      if (error) throw error;
      let wins = 0;
      let losses = 0;
      let pushes = 0;
      for (const row of data ?? []) {
        const result = String(row.result ?? '').toLowerCase();
        if (result === 'win') wins += 1;
        else if (result === 'loss') losses += 1;
        else if (result === 'push') pushes += 1;
      }
      return { wins, losses, pushes, graded: wins + losses + pushes };
    },
  });
}

const LEDGER_COLUMNS = 'season,week,player_name,market_label,side,line,price,book_name,result,actual_value,units,board_rank';

function ledgerNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Every spotlight row, named columns only. Units stay null until a pick is graded. */
export function useNflPropSpotlightLedger() {
  return useQuery({
    queryKey: ['nflPropMatchups', 'spotlight-ledger'],
    staleTime: 60_000,
    queryFn: async (): Promise<LedgerRow[]> => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_prop_spotlight')
        .select(LEDGER_COLUMNS)
        .order('season', { ascending: false })
        .order('week', { ascending: false })
        .order('board_rank', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        return {
          season: ledgerNum(record.season) ?? 0,
          week: ledgerNum(record.week) ?? 0,
          player_name: typeof record.player_name === 'string' ? record.player_name : '',
          market_label: typeof record.market_label === 'string' ? record.market_label : '',
          side: typeof record.side === 'string' ? record.side : '',
          line: ledgerNum(record.line),
          price: ledgerNum(record.price),
          book_name: typeof record.book_name === 'string' ? record.book_name : null,
          result: typeof record.result === 'string' ? record.result : null,
          actual_value: ledgerNum(record.actual_value),
          units: ledgerNum(record.units),
          board_rank: ledgerNum(record.board_rank),
        };
      });
    },
  });
}

const CHEAT_COLUMNS = 'season,week,family,table_key,position_filter,alignment_filter,side,team,opponent,kickoff,metrics,headline,player';

/** The week's team board. Same week as the player pages — no picker onto an empty week. */
export function useNflPropCheatsheet(season?: number, week?: number) {
  return useQuery({
    queryKey: ['nflPropMatchups', 'cheatsheet', season, week],
    enabled: season != null && week != null,
    staleTime: STALE,
    queryFn: async (): Promise<CheatRow[]> => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_prop_cheatsheet')
        .select(CHEAT_COLUMNS)
        .eq('season', season!)
        .eq('week', week!);
      if (error) throw error;
      return parseCheatRows(data ?? []);
    },
  });
}

/** Career trends for the players in the open game (vs-team records). */
export function useNflPropTrendsBatch(playerIds: string[]) {
  const key = [...playerIds].sort().join(',');
  return useQuery({
    queryKey: ['nflPropMatchups', 'trends', key],
    enabled: playerIds.length > 0,
    staleTime: STALE,
    queryFn: async (): Promise<Record<string, NflPropPlayerTrends>> => {
      const { data, error } = await collegeFootballSupabase
        .from('nfl_player_prop_trends')
        .select('player_id,recent_game_log,matchups,splits')
        .in('player_id', playerIds);
      if (error) throw error;
      const out: Record<string, NflPropPlayerTrends> = {};
      for (const row of data ?? []) {
        out[row.player_id] = row as NflPropPlayerTrends;
      }

      const gameLogs = Object.values(out).flatMap((trend) => trend.recent_game_log ?? []);
      const seasons = [...new Set(gameLogs.map((game) => game.season))];
      const weeks = [...new Set(gameLogs.map((game) => game.week))];
      if (seasons.length > 0 && weeks.length > 0) {
        const { data: statRows, error: statError } = await collegeFootballSupabase
          .from('nfl_player_game_logs')
          .select('player_id,season,week,pass_yds,pass_tds,rush_yds,rush_tds,rec_yds,rec_tds,receptions,pass_attempts,carries,completions')
          .in('player_id', playerIds)
          .in('season', seasons)
          .in('week', weeks);
        if (statError) throw statError;
        const statsByGame = new Map(
          (statRows ?? []).map((row) => [`${row.player_id}-${row.season}-${row.week}`, row] as const),
        );
        const statByMarket = {
          player_pass_yds: 'pass_yds',
          player_pass_tds: 'pass_tds',
          player_receptions: 'receptions',
          player_reception_yds: 'rec_yds',
          player_rush_yds: 'rush_yds',
          player_pass_attempts: 'pass_attempts',
          player_rush_attempts: 'carries',
          player_pass_completions: 'completions',
        } as const;
        for (const [playerId, trend] of Object.entries(out)) {
          trend.recent_game_log = (trend.recent_game_log ?? []).map((game) => {
            const stats = statsByGame.get(`${playerId}-${game.season}-${game.week}`);
            if (!stats) return game;
            const actuals: Record<string, number> = { ...(game.actuals ?? {}) };
            for (const [market, stat] of Object.entries(statByMarket)) {
              const value = stats[stat as keyof typeof stats];
              if (typeof value === 'number' && Number.isFinite(value)) actuals[market] = value;
            }
            const rushTds = typeof stats.rush_tds === 'number' ? stats.rush_tds : 0;
            const receivingTds = typeof stats.rec_tds === 'number' ? stats.rec_tds : 0;
            actuals.player_anytime_td = rushTds + receivingTds;
            return { ...game, actuals };
          });
        }
      }
      return out;
    },
  });
}
