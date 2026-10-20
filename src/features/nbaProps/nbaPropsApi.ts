import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

export type NbaRecentGame = {
  ha?: string | null;
  min?: number | string | null;
  opp?: string | null;
  date?: string | null;
  line?: number | string | null;
  value?: number | string | null;
  result?: string | null;
};

export type NbaFlagDetail = {
  above?: number | string | null;
  games?: number | string | null;
  chief?: string | null;
};

export type NbaSlateProp = {
  id: number | string;
  game_date: string | null;
  commence_time: string | null;
  game: string | null;
  home_abbr: string | null;
  away_abbr: string | null;
  athlete_id: string | number | null;
  player_name: string | null;
  position: string | null;
  team: string | null;
  opponent: string | null;
  headshot_url: string | null;
  market: string | null;
  market_label: string | null;
  line: number | string | null;
  over_price: number | string | null;
  under_price: number | string | null;
  open_line: number | string | null;
  line_delta: number | string | null;
  gp_prior: number | string | null;
  last_game: number | string | null;
  l3_avg: number | string | null;
  l5_avg: number | string | null;
  l10_avg: number | string | null;
  szn_avg: number | string | null;
  prior_szn_avg: number | string | null;
  prior_szn_gp: number | string | null;
  min_l5: number | string | null;
  over_rate_l5: number | string | null;
  over_rate_l10: number | string | null;
  over_rate_szn: number | string | null;
  recent_games: NbaRecentGame[] | null;
  baseline: number | string | null;
  baseline_gap: number | string | null;
  rank_pos: number | string | null;
  rank_tier: string | null;
  flags: string[] | null;
  flag_detail: Record<string, NbaFlagDetail> | null;
  report_status: string | null;
};

export type NbaPropDef = {
  signal_key: string;
  display_name: string | null;
  one_liner: string | null;
  definition: string | null;
  why_it_works: string | null;
  bet_direction: string | null;
  record_text: string | null;
  season_record_text: string | null;
};

export type NbaBookQuote = {
  bookmaker: string | null;
  line: number | string | null;
  over_odds: number | string | null;
  under_odds: number | string | null;
  snapshot_time: string | null;
};

const SLATE_COLUMNS = [
  'id', 'game_date', 'commence_time', 'game', 'home_abbr', 'away_abbr', 'athlete_id',
  'player_name', 'position', 'team', 'opponent', 'headshot_url', 'market', 'market_label',
  'line', 'over_price', 'under_price', 'open_line', 'line_delta', 'gp_prior', 'last_game',
  'l3_avg', 'l5_avg', 'l10_avg', 'szn_avg', 'prior_szn_avg', 'prior_szn_gp', 'min_l5',
  'over_rate_l5', 'over_rate_l10', 'over_rate_szn', 'recent_games', 'baseline', 'baseline_gap',
  'rank_pos', 'rank_tier', 'flags', 'flag_detail', 'report_status',
].join(',');

const DEF_COLUMNS = 'signal_key, display_name, one_liner, definition, why_it_works, bet_direction, record_text, season_record_text';

export function etDates(dayCount = 2): string[] {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day + index));
    return date.toISOString().slice(0, 10);
  });
}

export function propKey(row: Pick<NbaSlateProp, 'athlete_id' | 'market' | 'game_date'>): string {
  return `${row.game_date ?? ''}:${row.athlete_id ?? ''}:${row.market ?? ''}`;
}

export async function fetchNbaSlateProps(): Promise<{ rows: NbaSlateProp[]; defs: Record<string, NbaPropDef> }> {
  const dates = etDates(2);
  const [{ data: rows, error }, { data: defs, error: defsError }] = await Promise.all([
    collegeFootballSupabase
      .from('nba_slate_props')
      .select(SLATE_COLUMNS)
      .in('game_date', dates)
      .order('rank_pos', { ascending: true }),
    collegeFootballSupabase.from('nba_prop_defs').select(DEF_COLUMNS),
  ]);
  if (error) throw error;
  if (defsError) throw defsError;
  const defMap: Record<string, NbaPropDef> = {};
  for (const def of (defs || []) as NbaPropDef[]) {
    if (def.signal_key) defMap[def.signal_key] = def;
  }
  return { rows: (rows || []) as unknown as NbaSlateProp[], defs: defMap };
}

export async function fetchNbaPropBooks(row: NbaSlateProp): Promise<{ current: NbaBookQuote[]; history: NbaBookQuote[] }> {
  if (row.athlete_id == null || !row.market || !row.game_date) return { current: [], history: [] };
  const [{ data: current, error: currentError }, { data: history, error: historyError }] = await Promise.all([
    collegeFootballSupabase
      .from('nba_player_props_current')
      .select('bookmaker, line, over_odds, under_odds, snapshot_time')
      .eq('athlete_id', row.athlete_id)
      .eq('market', row.market)
      .eq('game_date', row.game_date),
    collegeFootballSupabase
      .from('nba_player_props')
      .select('bookmaker, line, over_odds, under_odds, snapshot_time')
      .eq('athlete_id', row.athlete_id)
      .eq('market', row.market)
      .eq('game_date', row.game_date)
      .order('snapshot_time', { ascending: true })
      .limit(500),
  ]);
  if (currentError) throw currentError;
  if (historyError) throw historyError;
  return { current: (current || []) as NbaBookQuote[], history: (history || []) as NbaBookQuote[] };
}

export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isOut(status: string | null | undefined): boolean {
  return (status || '').trim().toLowerCase() === 'out';
}

export function flagKeys(flags: NbaSlateProp['flags']): string[] {
  if (!Array.isArray(flags)) return [];
  return flags.filter((flag): flag is string => typeof flag === 'string' && flag.length > 0);
}

const REF_KEYS = new Set(['nba_player_ref_over', 'nba_player_ref_under']);

export function refSentence(key: string, detail: NbaSlateProp['flag_detail']): string | null {
  if (!REF_KEYS.has(key) || !detail) return null;
  const row = detail[key];
  if (!row) return null;
  const above = num(row.above);
  const games = num(row.games);
  const chief = row.chief?.trim();
  if (above === null || games === null || !chief) return null;
  return `${above} of ${games} games above his norm with ${chief}`;
}
