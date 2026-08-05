/** Which baseline / NGS / defense / coverage dims each market toggle shows. */

export type BaselineKey =
  | 'receptions'
  | 'targets'
  | 'rec_yds'
  | 'rush_att'
  | 'rush_yds'
  | 'pass_att'
  | 'pass_yds'
  | 'pass_td'
  | 'total_td';

export type NgsKey = string;
export type DefenseKey = 'man' | 'zone' | 'two_high' | 'pressure' | 'blitz' | 'heavy_box' | 'light_box';
export type CoverageKey = 'zone' | 'man' | 'two_high' | 'one_high' | 'pressure' | 'blitz';
export type RushLookKey = 'heavy_box' | 'neutral' | 'light_box';

export interface MarketContentMap {
  baseline: BaselineKey[];
  ngs: NgsKey[];
  ngsDescriptive?: NgsKey[];
  defense: DefenseKey[];
  coverage: CoverageKey[];
  /** Show overall-vs-look scheme comparison for this market. */
  showSchemeCompare: boolean;
}

const RECEPTIONS: MarketContentMap = {
  baseline: ['receptions', 'targets'],
  ngs: ['separation', 'air_share'],
  defense: ['man', 'zone', 'pressure'],
  coverage: ['zone', 'man'],
  showSchemeCompare: true,
};

const REC_YDS: MarketContentMap = {
  baseline: ['rec_yds', 'targets'],
  ngs: ['adot', 'yac_above_exp'],
  defense: ['two_high', 'man'],
  coverage: ['two_high', 'one_high', 'zone'],
  showSchemeCompare: true,
};

const RUSH: MarketContentMap = {
  baseline: ['rush_att', 'rush_yds'],
  ngs: ['efficiency', 'ryoe_per_att'],
  ngsDescriptive: ['time_to_los'],
  defense: ['heavy_box', 'light_box'],
  coverage: [],
  showSchemeCompare: true,
};

const ATD: MarketContentMap = {
  baseline: ['total_td', 'receptions', 'rec_yds'],
  ngs: ['yac_above_exp'],
  defense: ['two_high', 'heavy_box'],
  coverage: ['zone', 'two_high'],
  showSchemeCompare: true,
};

const PASS: MarketContentMap = {
  baseline: ['pass_att', 'pass_yds', 'pass_td'],
  ngs: ['time_to_throw', 'intended_air_yds'],
  ngsDescriptive: ['time_to_throw'],
  defense: ['pressure', 'blitz', 'two_high'],
  coverage: ['pressure', 'blitz', 'zone', 'two_high'],
  showSchemeCompare: true,
};

const BY_KEY: Record<string, MarketContentMap> = {
  player_receptions: RECEPTIONS,
  player_reception_yds: REC_YDS,
  player_rush_yds: RUSH,
  player_rush_attempts: RUSH,
  player_anytime_td: ATD,
  player_pass_yds: PASS,
  player_pass_tds: PASS,
  player_pass_attempts: PASS,
  player_pass_completions: PASS,
};

export function contentMapForMarket(marketKey: string): MarketContentMap {
  return (
    BY_KEY[marketKey] ?? {
      baseline: [],
      ngs: [],
      defense: [],
      coverage: [],
      showSchemeCompare: false,
    }
  );
}

export const BASELINE_LABELS: Record<BaselineKey, string> = {
  receptions: 'Rec / g',
  targets: 'Tgt / g',
  rec_yds: 'Rec yds / g',
  rush_att: 'Rush att / g',
  rush_yds: 'Rush yds / g',
  pass_att: 'Pass att / g',
  pass_yds: 'Pass yds / g',
  pass_td: 'Pass TD / g',
  total_td: 'Season TDs',
};

export const NGS_LABELS: Record<string, string> = {
  separation: 'Separation',
  cushion: 'Cushion',
  adot: 'aDOT',
  air_share: 'Air-Yard Share',
  yac_above_exp: 'YAC Over Expected',
  catch_pct: 'Catch %',
  drop_rate: 'Drop Rate',
  contested_catch: 'Contested Catch %',
  created_rate: 'Created Receptions',
  rz_tgt_share: 'Red-Zone Target Share',
  rz_carry_share: 'Red-Zone Carry Share',
  efficiency: 'Efficiency',
  ryoe_per_att: 'RYOE / Attempt',
  eight_box_pct: '8+ Box Rate',
  time_to_los: 'Time to LOS',
  cpoe: 'CPOE',
  time_to_throw: 'Time to Throw',
  completed_air_yds: 'Completed Air Yds',
  intended_air_yds: 'Intended Air Yds',
  air_yds_to_sticks: 'Air Yds to Sticks',
  aggressiveness: 'Aggressiveness',
  int_worthy_rate: 'INT-Worthy Rate',
  pa_rate: 'Play-Action Rate',
  comp_pct: 'Completion %',
};

export const DEFENSE_LABELS: Record<DefenseKey, string> = {
  man: 'Man coverage',
  zone: 'Zone coverage',
  two_high: 'Two-high shell',
  pressure: 'Pressure',
  blitz: 'Blitz',
  heavy_box: 'Heavy box',
  light_box: 'Light box',
};

export const COVERAGE_LABELS: Record<CoverageKey, string> = {
  zone: 'vs Zone',
  man: 'vs Man',
  two_high: 'vs Two-high',
  one_high: 'vs One-high',
  pressure: 'vs Pressure',
  blitz: 'vs Blitz',
};

export const RUSH_LOOK_LABELS: Record<RushLookKey, string> = {
  heavy_box: 'vs Heavy box',
  neutral: 'vs Neutral box',
  light_box: 'vs Light box',
};

export const LOOK_BUCKET_LABELS: Record<string, string> = {
  zone_heavy: 'vs zone-heavy Ds',
  man_heavy: 'vs man-heavy Ds',
  two_high: 'vs two-high Ds',
  two_high_heavy: 'vs two-high Ds',
  single_high: 'vs single-high Ds',
  heavy_box: 'vs heavy-box Ds',
  light_box: 'vs light-box Ds',
  blitz_heavy: 'vs blitz-heavy Ds',
};

export const GAME_SPLIT_BUCKET_LABELS: Record<string, string> = {
  zone_heavy: 'zone-heavy',
  man_heavy: 'man-heavy',
  two_high_heavy: 'two-high',
  single_high: 'single-high',
  heavy_box: 'heavy box',
  light_box: 'light box',
  blitz_heavy: 'blitz-heavy',
};
