import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { getNBATeamInitials } from '@/utils/teamColors';

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
  below?: number | string | null;
  games?: number | string | null;
  chief?: string | null;
  heat_l5?: number | string | null;
  out_mpg?: number | string | null;
  position?: string | null;
  out_player?: number | string | null;
  games_missed_before?: number | string | null;
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
  const games = num(row.games);
  const chief = row.chief?.trim();
  if (games === null || !chief) return null;
  if (key.endsWith('_under')) {
    const below = num(row.below);
    if (below === null) return null;
    return `${below} of ${games} games below his norm with ${chief}`;
  }
  const above = num(row.above);
  if (above === null) return null;
  return `${above} of ${games} games above his norm with ${chief}`;
}

/** Player-specific facts for a fired signal. Unknown keys stay on the def copy. */
export function signalSentence(
  key: string,
  detail: NbaSlateProp['flag_detail'],
  playerName?: (athleteId: string) => string | null,
): string | null {
  const crew = refSentence(key, detail);
  if (crew) return crew;
  const row = detail?.[key];
  if (!row) return null;
  if (key === 'nba_hot_shooter_under') {
    const heat = num(row.heat_l5);
    if (heat === null) return null;
    return `Last 5 games he scored ${heat.toFixed(1)} points a night more than his own finishing`;
  }
  if (key === 'nba_backup_same_pos_under') {
    const mpg = num(row.out_mpg);
    const id = row.out_player == null ? '' : String(row.out_player);
    const name = id && playerName ? playerName(id) : null;
    const minutes = mpg === null ? '' : `${Math.round(mpg)}-minute `;
    const position = row.position?.trim() ? `${row.position.trim()} ` : '';
    const missed = num(row.games_missed_before);
    const which = missed === 0 ? ' for the first game' : missed === 1 ? ' for the second game' : '';
    const starter = `a ${minutes}${position}starter`;
    const who = name ? `${name}, ${starter},` : `A ${minutes}${position}starter`;
    return `${who} is out${which} and this player is still on the bench`;
  }
  return null;
}

export type NbaPickSide = 'over' | 'under';

/** Side a fired signal actually names. A row with no signal has no side. */
export function pickSide(row: NbaSlateProp, defs: Record<string, NbaPropDef>): NbaPickSide | null {
  for (const key of flagKeys(row.flags)) {
    const direction = (defs[key]?.bet_direction || '').trim().toLowerCase();
    if (direction === 'over' || direction === 'o') return 'over';
    if (direction === 'under' || direction === 'u') return 'under';
    if (key === 'nba_player_ref_over' || key.endsWith('_over')) return 'over';
    if (key === 'nba_player_ref_under' || key.endsWith('_under')) return 'under';
  }
  return null;
}

export function gameKey(row: Pick<NbaSlateProp, 'game_date' | 'away_abbr' | 'home_abbr' | 'game'>): string {
  if (row.away_abbr && row.home_abbr) return `${row.game_date ?? ''}:${row.away_abbr}:${row.home_abbr}`;
  return `${row.game_date ?? ''}:${row.game ?? ''}`;
}

export function gameLabel(row: Pick<NbaSlateProp, 'away_abbr' | 'home_abbr' | 'game'>): string {
  if (row.away_abbr && row.home_abbr) return `${row.away_abbr} @ ${row.home_abbr}`;
  return row.game || 'Game';
}

export function formatPropNumber(value: number | null): string {
  if (value === null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatAmerican(value: number | null): string {
  if (value === null) return '—';
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}`;
  return `${rounded}`;
}

/** A higher American price is the better number for the bettor. */
export function betterAmerican(candidate: number, current: number): boolean {
  return candidate > current;
}

const NBA_LOGO_SLUG: Record<string, string> = {
  ATL: 'atl', BOS: 'bos', BKN: 'bkn', BRK: 'bkn',
  CHA: 'cha', CHO: 'cha', CHI: 'chi', CLE: 'cle',
  DAL: 'dal', DEN: 'den', DET: 'det',
  GSW: 'gs', GS: 'gs', HOU: 'hou', IND: 'ind',
  LAC: 'lac', LAL: 'lal', MEM: 'mem', MIA: 'mia',
  MIL: 'mil', MIN: 'min', NOP: 'no', NO: 'no',
  NYK: 'ny', NY: 'ny', OKC: 'okc', ORL: 'orl',
  PHI: 'phi', PHX: 'phx', PHO: 'phx', POR: 'por',
  SAC: 'sac', SAS: 'sa', SA: 'sa', TOR: 'tor',
  UTA: 'utah', UTAH: 'utah', WAS: 'wsh', WSH: 'wsh',
};

/** ESPN mark for an opponent abbreviation or team name on the recent-game chart. */
export function nbaOpponentLogo(opponent: string | null | undefined): string | null {
  const raw = (opponent || '').trim();
  if (!raw) return null;
  const direct = NBA_LOGO_SLUG[raw.toUpperCase()];
  const slug = direct ?? NBA_LOGO_SLUG[getNBATeamInitials(raw).toUpperCase()];
  if (!slug) return null;
  return `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`;
}

/**
 * Games above tonight's line. `over_rate_*` is a share; a value above 1 is a percent.
 */
export function clearedCount(rate: number | null, games: number | null): number | null {
  if (rate === null || games === null || games <= 0) return null;
  const share = rate > 1 ? rate / 100 : rate;
  if (share < 0 || share > 1) return null;
  return Math.round(share * games);
}

export type LineStamp = { at: number; line: number };

export type LineMovement = {
  moves: LineStamp[];
  open: LineStamp | null;
  mid: LineStamp | null;
  current: LineStamp | null;
};

function sameLine(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.05;
}

function medianLine(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

/**
 * Consensus line each minute, collapsed to the minutes it actually changed.
 * Middle is the number in effect halfway between the first and last snapshot.
 */
export function lineMovement(quotes: NbaBookQuote[]): LineMovement {
  const buckets = new Map<number, number[]>();
  for (const quote of quotes) {
    const line = num(quote.line);
    const at = Date.parse(quote.snapshot_time ?? '');
    if (line === null || !Number.isFinite(at)) continue;
    const minute = Math.floor(at / 60000) * 60000;
    const list = buckets.get(minute) ?? [];
    list.push(line);
    buckets.set(minute, list);
  }
  const samples = [...buckets.entries()]
    .map(([at, lines]) => ({ at, line: medianLine(lines) }))
    .sort((a, b) => a.at - b.at);
  if (samples.length === 0) return { moves: [], open: null, mid: null, current: null };

  const moves: LineStamp[] = [];
  for (const sample of samples) {
    const last = moves[moves.length - 1];
    if (!last || !sameLine(last.line, sample.line)) moves.push(sample);
  }
  const open = moves[0];
  const end = samples[samples.length - 1].at;
  const current = { at: end, line: moves[moves.length - 1].line };
  let mid: LineStamp | null = null;
  if (moves.length > 1 && end > open.at) {
    const at = open.at + (end - open.at) / 2;
    let line = open.line;
    for (const move of moves) {
      if (move.at <= at) line = move.line;
    }
    mid = { at, line };
  }
  return { moves, open, mid, current };
}

export type NbaRecentBar = {
  value: number;
  cleared: boolean;
  isDay: boolean;
  archetype: string | null;
  date: string | null;
};

export type NbaRecentForm = {
  bars: NbaRecentBar[];
  strip: { cleared: boolean; value: number }[];
  hits: number;
  games: number;
  pct: number | null;
};

function gameStamp(game: NbaRecentGame): number {
  const ms = Date.parse(game.date ?? '');
  return Number.isFinite(ms) ? ms : Number.NaN;
}

/**
 * Last `limit` logged games, oldest first. A bar clears tonight's number.
 * The strip is the same series, for the card sparkline.
 */
export function recentForm(row: NbaSlateProp, limit = 10): NbaRecentForm {
  const line = num(row.line);
  const logged = (row.recent_games ?? []).flatMap((game) => {
    const value = num(game.value);
    if (value === null) return [];
    return [{ game, value }];
  });
  const ordered = [...logged].sort((a, b) => {
    const left = gameStamp(a.game);
    const right = gameStamp(b.game);
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
    if (Number.isFinite(left)) return 1;
    if (Number.isFinite(right)) return -1;
    return 0;
  }).slice(-limit);
  const bars: NbaRecentBar[] = ordered.map(({ game, value }) => ({
    value,
    cleared: line !== null && value > line,
    isDay: false,
    archetype: game.opp?.trim() || null,
    date: game.date ?? null,
  }));
  const hits = bars.filter((bar) => bar.cleared).length;
  return {
    bars,
    strip: bars.map((bar) => ({ cleared: bar.cleared, value: bar.value })),
    hits,
    games: bars.length,
    pct: bars.length > 0 && line !== null ? (hits / bars.length) * 100 : null,
  };
}
