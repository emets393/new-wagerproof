/**
 * Render-only types for `nfl_prop_player_pages` + `nfl_player_prop_trends`.
 * No client-derived math — fields mirror the warehouse contract.
 */

export type PropMarketStatus = 'pending' | 'posted';
export type SampleFlag = 'ok' | 'thin';
export type SchemeKind = 'receiving' | 'qb' | 'rb';

export interface PropMarket {
  key: string;
  label: string;
  line: number | null;
  over_price: number | null;
  under_price: number | null;
  status: PropMarketStatus;
}

export interface MetricPctile {
  v: number;
  /** Null = descriptive — render value only, no TOP badge / good-bad color. */
  pctile: number | null;
}

export interface PropBaseline {
  season: number;
  games: number;
  receptions?: number;
  rec_yds?: number;
  targets?: number;
  rush_att?: number;
  rush_yds?: number;
  pass_att?: number;
  pass_yds?: number;
  pass_td?: number;
  total_td?: number;
  [key: string]: number | undefined;
}

export interface PropNgs {
  kind: 'receiving' | 'rushing' | 'passing';
  [metric: string]: MetricPctile | string | undefined;
}

export interface DefenseDim {
  rate: number;
  pctile: number;
}

export interface PropDefense {
  identity: string;
  two_high?: DefenseDim;
  man?: DefenseDim;
  pressure?: DefenseDim;
  blitz?: DefenseDim;
  heavy_box?: DefenseDim;
  light_box?: DefenseDim;
  [key: string]: string | DefenseDim | undefined;
  /** Market-aware headline tags (2026-08-17): the tab shows ITS family's identity —
   *  a blitz tag never headlines a receiving market. Fallbacks are honest
   *  ("AVERAGE COVERAGE MIX"), legacy `identity` kept for older payload rows. */
  identity_by_family?: { receiving?: string; rushing?: string; passing?: string } | null;
  note_by_family?: { receiving?: string | null } | null;
}

/** WR/TE/RB receiving coverage split. */
export interface PlayerCoverageSplit {
  ypt: number | null;
  targets: number;
  pctile: number | null;
  delta_ypt?: number | null;
  sample?: SampleFlag;
  insufficient?: boolean;
}

export interface PlayerOverallYpt {
  ypt: number;
  targets: number;
  pctile: number | null;
  sample?: SampleFlag;
}

/** QB EPA/dropback layer. */
export interface PlayerQbOverall {
  epa_db: number;
  ypa: number;
  comp_pct: number;
  sack_rate: number;
  dropbacks: number;
  pctile: number | null;
  sample?: SampleFlag;
}

export interface PlayerQbSplit {
  dropbacks: number;
  epa_db?: number | null;
  ypa?: number | null;
  comp_pct?: number | null;
  sack_rate?: number | null;
  delta_epa_db?: number | null;
  delta_ypa?: number | null;
  pctile?: number | null;
  sample?: SampleFlag;
  insufficient?: boolean;
}

/** RB box layer — YPC display, EPA/rush compare. */
export interface PlayerRushOverall {
  ypc: number;
  epa_rush: number;
  td_rate: number;
  carries: number;
  pctile: number | null;
  sample?: SampleFlag;
}

export interface PlayerRushSplit {
  carries: number;
  ypc?: number | null;
  epa_rush?: number | null;
  td_rate?: number | null;
  delta_ypc?: number | null;
  delta_epa_rush?: number | null;
  pctile?: number | null;
  sample?: SampleFlag;
  insufficient?: boolean;
}

export type LookFocusKey =
  | 'zone'
  | 'man'
  | 'two_high'
  | 'one_high'
  | 'pressure'
  | 'blitz';

export type RushLookKey = 'heavy_box' | 'neutral' | 'light_box';

export type LookHitBucket =
  | 'zone_heavy'
  | 'man_heavy'
  | 'two_high'
  | 'two_high_heavy'
  | 'single_high'
  | 'heavy_box'
  | 'light_box'
  | 'blitz_heavy';

export interface LookHitRate {
  h: number;
  n: number;
  pct: number | null;
}

export interface PropScheme {
  opponent: string;
  defense: PropDefense | null;
  kind?: SchemeKind;
  /** Career overall — receiving YPT or QB EPA (shape depends on kind). */
  player_overall?: PlayerOverallYpt | PlayerQbOverall | null;
  player_splits?: Partial<
    Record<LookFocusKey, PlayerCoverageSplit | PlayerQbSplit>
  > | null;
  look_focus?: LookFocusKey[];
  rush_overall?: PlayerRushOverall | null;
  rush_splits?: Partial<Record<RushLookKey, PlayerRushSplit>> | null;
  rush_look_focus?: RushLookKey[];
  look_hit_rates?: Partial<Record<LookHitBucket, Partial<Record<string, LookHitRate>>>> | null;
}

export interface SchemeGameSplitEntry {
  n: number;
  insufficient?: boolean;
  receptions?: number;
  rec_yds?: number;
  targets?: number;
  rush_att?: number;
  rush_yds?: number;
  pass_att?: number;
  pass_yds?: number;
  delta?: Partial<Record<string, number>>;
  [key: string]: number | boolean | Partial<Record<string, number>> | undefined;
}

export interface SchemeGameSplits {
  overall?: SchemeGameSplitEntry;
  splits?: Partial<Record<string, SchemeGameSplitEntry>>;
  applicable?: string[];
  window?: string;
}

export type ProjectionStatus = 'preview' | 'model';

export interface ProjectionPoint {
  kind: 'point';
  value: number;
  n: number;
  status: ProjectionStatus | string;
  source: string;
  /** Served only — never compute client-side. */
  vs_line?: number | null;
}

export interface ProjectionRate {
  kind: 'rate';
  score_rate: number;
  n: number;
  status: ProjectionStatus | string;
  source: string;
  vs_line?: number | null;
}

export type MarketProjection = ProjectionPoint | ProjectionRate;

export type HighlightDirection = 'up' | 'down';

export interface PropHighlight {
  kind: string;
  direction: HighlightDirection;
  markets: string[];
  text: string;
  split?: string;
  bucket?: string;
}

export interface NflPropPlayerPage {
  player_id: string;
  season: number;
  week: number;
  player_name: string;
  position: string;
  team: string;
  opponent: string;
  is_home: boolean;
  game_label: string | null;
  kickoff: string | null;
  headshot_url: string | null;
  markets: PropMarket[];
  baseline: PropBaseline | null;
  ngs: PropNgs | null;
  scheme: PropScheme | null;
  /** Top-level: per-game averages overall vs defense-type buckets. */
  scheme_game_splits?: SchemeGameSplits | null;
  /** Top-level: per-market preview bands (status: preview until model swaps in). */
  projection?: Partial<Record<string, MarketProjection>> | null;
  rookie?: boolean;
  highlights: PropHighlight[] | null;
}

export interface TrendGameLogEntry {
  season: number;
  week: number;
  opp: string;
  is_home?: boolean;
  is_div?: boolean;
  is_primetime?: boolean;
  markets?: Record<string, string>;
  /** Actual stat totals, keyed by market, for quantitative Last 10 charts. */
  actuals?: Record<string, number>;
  /** The closing line used to grade each historical result. */
  lines?: Record<string, number>;
}

export interface TrendMatchupMarket {
  h: number;
  n: number;
  pct: number;
}

export interface TrendMatchup {
  meetings: number;
  [marketKey: string]: number | TrendMatchupMarket;
}

export interface NflPropPlayerTrends {
  player_id: string;
  recent_game_log: TrendGameLogEntry[] | null;
  matchups: Record<string, TrendMatchup> | null;
  splits?: unknown;
}

export interface PropSlateAnchor {
  season: number;
  week: number;
}
