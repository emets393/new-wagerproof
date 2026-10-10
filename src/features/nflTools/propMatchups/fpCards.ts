import type {
  FpCards,
  FpRouteLeaf,
  NflPropPlayerPage,
  NflPropSpotlight,
  SpotlightTell,
} from '@/features/propBreakdown/types';

/**
 * Which stat blocks a market is allowed to show. A block is included only when
 * its blob is present — a missing key is "no coverage", not a zero.
 * See CURSOR_PROPS_PAGE_PROMPT.md and .claude/docs/29_cursor_props_build_brief.md.
 */
export type CardSection =
  | 'routes'
  | 'alignment'
  | 'scheme'
  | 'throw_depth'
  | 'role'
  | 'vs_position'
  | 'efficiency'
  | 'run_concept'
  | 'run_consistency'
  | 'script'
  | 'coverage'
  | 'redzone';

const RECV = new Set(['WR', 'TE']);
const BACK = new Set(['RB', 'FB']);

export function blobPresent(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

function decodeBlob(blob: unknown): unknown {
  if (typeof blob !== 'string') return blob;
  const text = blob.trim();
  if (!text || (text[0] !== '{' && text[0] !== '[')) return blob;
  try {
    return JSON.parse(text);
  } catch {
    return blob;
  }
}

/** A JSON object, or null when the column is absent. An empty object is absent, not a zeroed card. */
export function jsonObject<T>(raw: unknown): T | null {
  let value = raw;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    try {
      value = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value as object).length === 0) return null;
  return value as T;
}

/** Parquet used to land each blob as a JSON string. Decode once so a missing key stays missing. */
export function parseFpCards(raw: unknown): FpCards | null {
  let value = raw;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    try {
      value = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, blob] of Object.entries(value as Record<string, unknown>)) {
    const decoded = decodeBlob(blob);
    if (!blobPresent(decoded)) continue;
    out[key] = decoded;
  }
  return Object.keys(out).length ? (out as FpCards) : null;
}

/** Week-row normalizer. Missing projection, research, splits, or cards stay null — never zero. */
export function normalizePlayerPage(row: NflPropPlayerPage): NflPropPlayerPage {
  return {
    ...row,
    markets: Array.isArray(row.markets) ? row.markets : [],
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
    projection: jsonObject(row.projection),
    research: jsonObject(row.research),
    scheme_game_splits: jsonObject(row.scheme_game_splits),
    fp_cards: parseFpCards(row.fp_cards),
    rookie: typeof row.rookie === 'boolean' ? row.rookie : undefined,
  };
}

export function sectionsFor(
  position: string,
  market: string,
  cards: FpCards | null | undefined,
): CardSection[] {
  if (!cards) return [];
  const pos = position.toUpperCase();
  const out: CardSection[] = [];
  const push = (id: CardSection, ok: boolean) => {
    if (ok) out.push(id);
  };
  const isAtd = market === 'player_anytime_td';
  const isRecvYds = market === 'player_reception_yds';
  const isRec = market === 'player_receptions';
  const isRush = market === 'player_rush_yds' || market === 'player_rush_attempts';
  const isPassVolume =
    market === 'player_pass_yds' ||
    market === 'player_pass_attempts' ||
    market === 'player_pass_completions';
  const isPassTd = market === 'player_pass_tds';

  if (isAtd) {
    push('redzone', blobPresent(cards.redzone));
    push('vs_position', blobPresent(cards.matchup?.vs_position));
    push('script', blobPresent(cards.situational));
    return out;
  }

  if (RECV.has(pos) && (isRecvYds || isRec)) {
    if (isRec) push('efficiency', blobPresent(cards.efficiency));
    push('routes', blobPresent(cards.routes));
    push('alignment', blobPresent(cards.playsheet) || blobPresent(cards.matchup?.vs_alignment));
    push('scheme', blobPresent(cards.scheme?.player));
    push('throw_depth', blobPresent(cards.throw_depth));
    push('role', blobPresent(cards.role));
    push('vs_position', blobPresent(cards.matchup?.vs_position));
    if (isRecvYds) push('efficiency', blobPresent(cards.efficiency));
    return out;
  }

  if ((BACK.has(pos) || pos === 'QB') && isRush) {
    push('run_concept', blobPresent(cards.run_concept));
    push('run_consistency', blobPresent(cards.run_consistency));
    push('role', blobPresent(cards.role));
    push('script', blobPresent(cards.situational));
    push('vs_position', blobPresent(cards.matchup?.vs_position));
    return out;
  }

  if (BACK.has(pos) && (isRecvYds || isRec)) {
    if (isRec) push('efficiency', blobPresent(cards.efficiency));
    push('routes', blobPresent(cards.routes));
    push('alignment', blobPresent(cards.playsheet) || blobPresent(cards.matchup?.vs_alignment));
    push('role', blobPresent(cards.role));
    push('vs_position', blobPresent(cards.matchup?.vs_position));
    if (isRecvYds) push('efficiency', blobPresent(cards.efficiency));
    return out;
  }

  if (pos === 'QB' && isPassVolume) {
    push('throw_depth', blobPresent(cards.throw_depth));
    push('script', blobPresent(cards.situational));
    push('coverage', blobPresent(cards.coverage?.by) || blobPresent(cards.scheme?.player));
    push('vs_position', blobPresent(cards.matchup?.vs_position));
    push('efficiency', blobPresent(cards.efficiency));
    return out;
  }

  if (pos === 'QB' && isPassTd) {
    push('redzone', blobPresent(cards.redzone));
    push('script', blobPresent(cards.situational));
    push('vs_position', blobPresent(cards.matchup?.vs_position));
    return out;
  }

  return out;
}

const BASELINE_KEY: Record<string, string> = {
  player_reception_yds: 'rec_yds',
  player_receptions: 'receptions',
  player_rush_yds: 'rush_yds',
  player_rush_attempts: 'rush_att',
  player_pass_yds: 'pass_yds',
  player_pass_tds: 'pass_tds',
  player_pass_attempts: 'pass_attempts',
};

const PAGE_BASELINE_KEY: Record<string, string> = {
  player_reception_yds: 'rec_yds',
  player_receptions: 'receptions',
  player_rush_yds: 'rush_yds',
  player_rush_attempts: 'rush_att',
  player_pass_yds: 'pass_yds',
  player_pass_tds: 'pass_td',
  player_pass_attempts: 'pass_att',
  player_anytime_td: 'total_td',
};

export function baselineKeyForMarket(market: string): string | null {
  return BASELINE_KEY[market] ?? null;
}

/** The rate stored on the player page itself (often the prior season), separate from the fp blend. */
export function storedBaselineRate(page: NflPropPlayerPage, market: string): number | null {
  const pageKey = PAGE_BASELINE_KEY[market];
  const value = pageKey ? page.baseline?.[pageKey] : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function ordinal(n: number): string {
  const value = Math.round(n);
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

/** Rank 1 allows the most. Near end of the list reads as "fewest". */
export function rankPhrase(rank: number | null | undefined, of: number | null | undefined): string | null {
  if (rank == null || of == null || !Number.isFinite(rank) || !Number.isFinite(of) || of <= 0) return null;
  const r = Math.round(rank);
  const n = Math.round(of);
  if (r <= (n + 1) / 2) return `${ordinal(r)}-most of ${n}`;
  return `${ordinal(n - r + 1)}-fewest of ${n}`;
}

export function formatNum(value: number | null | undefined, digits = 1): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPct(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  const pct = Math.abs(n) <= 1.5 ? n * 100 : n;
  return `${Math.round(pct)}%`;
}

export function isRateKey(key: string): boolean {
  return /share|pct|rate|percentage/i.test(key);
}

export function overGames(games: number | null | undefined): string | null {
  if (games == null || !Number.isFinite(Number(games)) || Number(games) <= 0) return null;
  const n = Math.round(Number(games));
  return n === 1 ? 'over 1 game' : `over ${n} games`;
}

export function samplePhrase(games: number | null | undefined, window?: string | null): string | null {
  if (window === 'last season') return 'last season';
  return overGames(games);
}

export function allowanceClaim(args: {
  subject: string;
  value: number | null | undefined;
  unit: string;
  rank?: number | null;
  of?: number | null;
  games?: number | null;
  window?: string | null;
  digits?: number;
}): string | null {
  const valueText = formatNum(args.value, args.digits ?? 1);
  if (!valueText) return null;
  const bits = [
    `${args.subject} ${valueText} ${args.unit}`.replace(/\s+/g, ' ').trim(),
    rankPhrase(args.rank, args.of),
    samplePhrase(args.games, args.window),
  ].filter(Boolean);
  return `${bits.join(', ')}.`;
}

export function positionPlural(position: string): string {
  const pos = position.toUpperCase();
  if (pos === 'WR') return 'WRs';
  if (pos === 'TE') return 'TEs';
  if (pos === 'RB') return 'RBs';
  if (pos === 'QB') return 'QBs';
  return `${position}s`;
}

export function marketUnit(market: string): string {
  if (market.includes('yds')) return 'yards a game';
  if (market === 'player_receptions') return 'receptions a game';
  if (market === 'player_rush_attempts') return 'carries a game';
  if (market === 'player_pass_attempts') return 'attempts a game';
  if (market === 'player_pass_completions') return 'completions a game';
  if (market === 'player_pass_tds') return 'passing touchdowns a game';
  if (market === 'player_anytime_td') return 'touchdowns a game';
  return 'a game';
}

export interface RouteRead {
  hisThin: boolean;
  theirThin: boolean;
  hisN: number | null;
  highlight: boolean;
}

/** Thin samples stay on the card, grey, with no delta and no emphasis. */
export function readRoute(row: FpRouteLeaf, overallYards: number | null | undefined): RouteRead {
  const perGame = row.routes;
  const games = row.games;
  const hisN =
    perGame != null && games != null && Number.isFinite(perGame) && Number.isFinite(games)
      ? perGame * games
      : null;
  const hisThin = hisN == null || hisN < 15;
  const faced = row.def_routes_faced;
  const theirThin = faced == null || !Number.isFinite(faced) || faced < 40;
  const leaky =
    row.def_rank != null &&
    row.def_of != null &&
    row.def_of > 0 &&
    row.def_rank <= row.def_of / 3;
  const aboveOwn =
    row.yards_per_route != null &&
    overallYards != null &&
    Number.isFinite(row.yards_per_route) &&
    Number.isFinite(overallYards) &&
    row.yards_per_route > overallYards;
  return {
    hisThin,
    theirThin,
    hisN,
    highlight: !hisThin && !theirThin && leaky && aboveOwn,
  };
}

export function sortRoutes(routes: FpRouteLeaf[]): FpRouteLeaf[] {
  return [...routes].sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
}

const VS_POSITION_STAT: Record<string, { key: string; unit: string; verb: string }> = {
  player_reception_yds: { key: 'rec_yds', unit: 'receiving yards a game', verb: 'allow' },
  player_receptions: { key: 'receptions', unit: 'catches a game', verb: 'allow' },
  player_rush_yds: { key: 'rush_yds', unit: 'rushing yards a game', verb: 'allow' },
  player_rush_attempts: { key: 'rush_att', unit: 'carries a game', verb: 'allow' },
  player_pass_yds: { key: 'pass_yds', unit: 'passing yards a game', verb: 'allow' },
  player_pass_tds: { key: 'pass_tds', unit: 'passing touchdowns a game', verb: 'allow' },
  player_pass_attempts: { key: 'pass_att', unit: 'pass attempts a game', verb: 'allow' },
  player_pass_completions: { key: 'pass_att', unit: 'pass attempts a game', verb: 'allow' },
};

export function vsPositionStat(market: string, position: string): { key: string; unit: string; verb: string } | null {
  if (market === 'player_anytime_td') {
    if (position.toUpperCase() === 'QB' || position.toUpperCase() === 'RB') {
      return { key: 'rush_tds', unit: 'rushing touchdowns a game', verb: 'allow' };
    }
    return { key: 'rec_tds', unit: 'receiving touchdowns a game', verb: 'allow' };
  }
  return VS_POSITION_STAT[market] ?? null;
}

export function numField(bag: Record<string, number | string | null> | undefined, key: string): number | null {
  const value = bag?.[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

/** Prefer the observed allowance. The unsuffixed key is shrunk toward the league and is not a fact. */
export function actualField(bag: Record<string, number | string | null> | undefined, key: string): number | null {
  return numField(bag, `${key}_actual`) ?? null;
}

export interface HeadlineNumber {
  value: number;
  unit: string;
  games: number | null;
  seasonToDate: number | null;
  priorSeason: number | null;
  weightThisSeason: number | null;
  rookie: boolean;
  source: 'blend' | 'season';
}

export function headlineFor(page: NflPropPlayerPage, market: string): HeadlineNumber | null {
  const unit = marketUnit(market);
  const cards = page.fp_cards;
  const key = baselineKeyForMarket(market);
  const arm = key ? cards?.baseline?.[key] : undefined;
  if (arm && typeof arm.blended === 'number' && Number.isFinite(arm.blended)) {
    return {
      value: arm.blended,
      unit,
      games: typeof arm.games === 'number' ? arm.games : null,
      seasonToDate: typeof arm.season_to_date === 'number' ? arm.season_to_date : null,
      priorSeason: typeof arm.prior_season === 'number' ? arm.prior_season : null,
      weightThisSeason: typeof arm.weight_this_season === 'number' ? arm.weight_this_season : null,
      rookie: arm.rookie === true,
      source: 'blend',
    };
  }
  if (cards) return null;
  const pageKey = PAGE_BASELINE_KEY[market];
  const seasonValue = pageKey ? page.baseline?.[pageKey] : undefined;
  if (typeof seasonValue === 'number' && Number.isFinite(seasonValue)) {
    return {
      value: seasonValue,
      unit,
      games: page.baseline?.games ?? null,
      seasonToDate: seasonValue,
      priorSeason: null,
      weightThisSeason: null,
      rookie: page.rookie === true,
      source: 'season',
    };
  }
  return null;
}

/** Provenance under the hero number. The blend is not a season label. */
export function baselineCaption(headline: HeadlineNumber, season: number | null | undefined): string | null {
  if (headline.source === 'blend') {
    const now = headline.seasonToDate;
    const prior = headline.priorSeason;
    const weight = headline.weightThisSeason;
    if (now != null && prior != null && weight != null) {
      const thisPct = Math.round(weight * 100);
      return `${now.toFixed(1)} this season and ${prior.toFixed(1)} last, weighted ${thisPct}/${100 - thisPct}`;
    }
    if (now != null) return `${now.toFixed(1)} this season`;
    return null;
  }
  const bits = [
    season != null ? String(season) : null,
    headline.games != null ? `${headline.games} games` : null,
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(' · ') : null;
}

export interface StandoutMeasure {
  key: string;
  label: string;
  value: number;
  text: string;
  rate: boolean;
}

const STANDOUTS: Record<string, Array<{ key: string; label: string; from: 'role' | 'efficiency' }>> = {
  player_reception_yds: [
    { key: 'routes_per_game', label: 'Routes a game', from: 'role' },
    { key: 'target_share', label: 'Target share', from: 'role' },
    { key: 'yards_per_route', label: 'Yards per route', from: 'efficiency' },
    { key: 'adot', label: 'aDOT', from: 'efficiency' },
    { key: 'align_wide_share', label: 'Wide alignment', from: 'role' },
  ],
  player_receptions: [
    { key: 'targets_per_route', label: 'Targets per route', from: 'efficiency' },
    { key: 'catchable_pct', label: 'Catchable rate', from: 'efficiency' },
    { key: 'target_share', label: 'Target share', from: 'role' },
    { key: 'routes_per_game', label: 'Routes a game', from: 'role' },
  ],
  player_rush_yds: [
    { key: 'carry_share', label: 'Carry share', from: 'role' },
    { key: 'snap_share', label: 'Snap share', from: 'role' },
    { key: 'explosive_run_pct', label: 'Explosive-run rate', from: 'efficiency' },
    { key: 'rush_success_pct', label: 'Successful-run rate', from: 'efficiency' },
  ],
  player_rush_attempts: [
    { key: 'carry_share', label: 'Carry share', from: 'role' },
    { key: 'snap_share', label: 'Snap share', from: 'role' },
    { key: 'rz5_carry_share', label: 'Carries inside the 5', from: 'role' },
  ],
  player_pass_yds: [
    { key: 'dropbacks', label: 'Dropbacks a game', from: 'efficiency' },
    { key: 'deep_throw_pct', label: 'Deep-throw rate', from: 'efficiency' },
    { key: 'pressured_pct', label: 'Pressured rate', from: 'efficiency' },
    { key: 'pass_catchable_pct', label: 'Catchable throws', from: 'efficiency' },
  ],
  player_pass_attempts: [
    { key: 'dropbacks', label: 'Dropbacks a game', from: 'efficiency' },
    { key: 'pressured_pct', label: 'Pressured rate', from: 'efficiency' },
  ],
  player_pass_completions: [
    { key: 'dropbacks', label: 'Dropbacks a game', from: 'efficiency' },
    { key: 'pass_catchable_pct', label: 'Catchable throws', from: 'efficiency' },
  ],
  player_pass_tds: [
    { key: 'ez_attempts', label: 'End-zone attempts a game', from: 'efficiency' },
    { key: 'dropbacks', label: 'Dropbacks a game', from: 'efficiency' },
  ],
  player_anytime_td: [
    { key: 'ez_targets', label: 'End-zone targets a game', from: 'role' },
    { key: 'rz5_carry_share', label: 'Carries inside the 5', from: 'role' },
    { key: 'rec_td_share', label: 'Share of receiving TDs', from: 'role' },
  ],
};

function readMeasure(cards: FpCards, from: 'role' | 'efficiency', key: string): number | null {
  const bag = from === 'role' ? cards.role : cards.efficiency;
  const value = bag?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function standoutMeasures(cards: FpCards | null | undefined, market: string): StandoutMeasure[] {
  if (!cards) return [];
  const specs = STANDOUTS[market] ?? [];
  const out: StandoutMeasure[] = [];
  for (const spec of specs) {
    const value = readMeasure(cards, spec.from, spec.key);
    if (value == null) continue;
    const rate = isRateKey(spec.key);
    const text = rate ? formatPct(value) : formatNum(value, spec.key === 'adot' ? 1 : 1);
    if (!text) continue;
    out.push({ key: spec.key, label: spec.label, value, text, rate });
  }
  return out;
}

export function peerValues(
  slate: NflPropPlayerPage[],
  position: string,
  selfId: string,
  from: 'role' | 'efficiency',
  key: string,
): number[] {
  const values: number[] = [];
  for (const page of slate) {
    if (page.player_id === selfId || page.position.toUpperCase() !== position.toUpperCase()) continue;
    if (!page.fp_cards) continue;
    const value = readMeasure(page.fp_cards, from, key);
    if (value != null) values.push(value);
  }
  return values;
}

/** Percent of peers strictly below this value. Needs a real group — under 8 peers, no rank. */
export function percentileAmong(value: number, peers: number[]): number | null {
  if (peers.length < 8) return null;
  const below = peers.filter((peer) => peer < value).length;
  return Math.round((below / peers.length) * 100);
}

export function standoutSource(market: string, key: string): 'role' | 'efficiency' {
  const spec = (STANDOUTS[market] ?? []).find((row) => row.key === key);
  return spec?.from ?? 'role';
}

const DEPTH_ORDER = ['Under0', '0To9', '10To19', 'Over20'];
const DEPTH_LABEL: Record<string, string> = {
  Under0: 'Behind the line',
  '0To9': '0–9 yards',
  '10To19': '10–19 yards',
  Over20: '20+ yards',
};

export function depthBands(by: Record<string, Record<string, number | null>> | undefined): string[] {
  if (!by) return [];
  const known = DEPTH_ORDER.filter((key) => blobPresent(by[key]));
  const rest = Object.keys(by).filter((key) => !DEPTH_ORDER.includes(key) && blobPresent(by[key]));
  return [...known, ...rest];
}

export function depthLabel(key: string): string {
  return DEPTH_LABEL[key] ?? key.replace(/([A-Z])/g, ' $1').trim();
}

const SCRIPT_BY_MARKET: Record<string, string[]> = {
  player_anytime_td: ['Inside10', 'Inside20'],
  player_pass_tds: ['Inside20', 'Inside10', 'Neutral'],
  player_rush_yds: ['Leading', 'Neutral', 'Trailing'],
  player_rush_attempts: ['Leading', 'Neutral', 'Trailing', 'Inside10'],
  player_pass_yds: ['Neutral', 'Leading', 'Trailing'],
  player_pass_attempts: ['Neutral', 'Leading', 'Trailing'],
  player_pass_completions: ['Neutral', 'Leading', 'Trailing'],
  player_reception_yds: ['Neutral', 'Leading'],
  player_receptions: ['Neutral', 'Leading'],
};

export function scriptBuckets(market: string, situational: FpCards['situational']): string[] {
  if (!situational) return [];
  const preferred = SCRIPT_BY_MARKET[market] ?? ['Neutral', 'Leading', 'Trailing', 'Inside10', 'Inside20'];
  return preferred.filter((key) => blobPresent(situational[key]));
}

export function scriptLabel(bucket: string): string {
  const labels: Record<string, string> = {
    Inside10: 'Inside the 10',
    Inside20: 'Inside the 20',
    Neutral: 'Neutral game',
    Leading: 'When leading',
    Trailing: 'When trailing',
    FirstDown: 'First down',
    ThirdDown: 'Third down',
  };
  return labels[bucket] ?? bucket;
}

const SHELL_ORDER = ['Man', 'Zone', 'SingleHigh', 'TwoHigh'];

export function shellKeys(player: Record<string, Record<string, number | null>> | undefined): string[] {
  if (!player) return [];
  const known = SHELL_ORDER.filter((key) => blobPresent(player[key]));
  const rest = Object.keys(player).filter((key) => key !== 'Overall' && !SHELL_ORDER.includes(key) && blobPresent(player[key]));
  return [...known, ...rest];
}

export function prettyKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPickLine(pick: Pick<NflPropSpotlight, 'market' | 'market_label' | 'side' | 'line'>): string {
  const side = pick.side === 'under' ? 'Under' : 'Over';
  if (pick.market === 'player_anytime_td' || pick.line == null || !Number.isFinite(pick.line)) {
    return `${pick.market_label} · ${side}`;
  }
  const line = Number.isInteger(pick.line) ? pick.line.toFixed(1) : pick.line.toFixed(1);
  return `${pick.market_label} ${line} · ${side}`;
}

export function formatSignedNet(net: number | null | undefined): string | null {
  if (net == null || !Number.isFinite(net)) return null;
  const text = Math.abs(net).toFixed(1);
  if (net > 0) return `+${text}`;
  if (net < 0) return `−${text}`;
  return text;
}

export function normalizeSpotlight(row: Record<string, unknown>): NflPropSpotlight {
  const tellsRaw = row.tells;
  const tells: SpotlightTell[] = Array.isArray(tellsRaw)
    ? tellsRaw.filter((tell): tell is SpotlightTell => Boolean(tell) && typeof tell === 'object' && typeof (tell as SpotlightTell).text === 'string')
    : [];
  return {
    season: Number(row.season),
    week: Number(row.week),
    player_id: String(row.player_id),
    player_name: String(row.player_name ?? ''),
    position: String(row.position ?? ''),
    team: String(row.team ?? ''),
    opponent: String(row.opponent ?? ''),
    market: String(row.market ?? ''),
    market_label: String(row.market_label ?? row.market ?? ''),
    side: String(row.side ?? ''),
    line: typeof row.line === 'number' ? row.line : null,
    net: typeof row.net === 'number' ? row.net : null,
    n_for: typeof row.n_for === 'number' ? row.n_for : null,
    n_against: typeof row.n_against === 'number' ? row.n_against : null,
    board_rank: typeof row.board_rank === 'number' ? row.board_rank : null,
    tells,
    narrative: typeof row.narrative === 'string' && row.narrative.trim() ? row.narrative : null,
    narrative_model: typeof row.narrative_model === 'string' ? row.narrative_model : null,
    result: typeof row.result === 'string' && row.result.trim() ? row.result : null,
    actual_value: typeof row.actual_value === 'number' ? row.actual_value : null,
    kickoff: typeof row.kickoff === 'string' ? row.kickoff : null,
    headshot_url: typeof row.headshot_url === 'string' ? row.headshot_url : null,
  };
}

export function qualifiedPlayerCount(picks: NflPropSpotlight[]): number {
  return new Set(picks.map((pick) => pick.player_id)).size;
}

export function resultWord(result: string | null | undefined): string {
  if (!result) return 'Pending';
  const value = result.toLowerCase();
  if (value === 'win') return 'Win';
  if (value === 'loss') return 'Loss';
  if (value === 'push') return 'Push';
  return result;
}

const ROLE_TILES: Record<string, Array<{ key: string; label: string; from: 'role' | 'efficiency' }>> = {
  player_reception_yds: [
    { key: 'snap_share', label: 'Snap share', from: 'role' },
    { key: 'route_share', label: 'Route share', from: 'role' },
    { key: 'target_share', label: 'Target share', from: 'role' },
    { key: 'routes_per_game', label: 'Routes / game', from: 'role' },
  ],
  player_receptions: [
    { key: 'targets_per_route', label: 'Targets / route', from: 'efficiency' },
    { key: 'catchable_pct', label: 'Catchable', from: 'efficiency' },
    { key: 'target_share', label: 'Target share', from: 'role' },
    { key: 'routes_per_game', label: 'Routes / game', from: 'role' },
  ],
  player_rush_yds: [
    { key: 'carry_share', label: 'Carry share', from: 'role' },
    { key: 'snap_share', label: 'Snap share', from: 'role' },
    { key: 'routes_per_game', label: 'Routes / game', from: 'role' },
  ],
  player_rush_attempts: [
    { key: 'carry_share', label: 'Carry share', from: 'role' },
    { key: 'snap_share', label: 'Snap share', from: 'role' },
    { key: 'rz5_carry_share', label: 'Inside-5 carries', from: 'role' },
  ],
  player_pass_yds: [
    { key: 'dropbacks', label: 'Dropbacks / game', from: 'efficiency' },
    { key: 'deep_throw_pct', label: 'Deep throws', from: 'efficiency' },
    { key: 'pressured_pct', label: 'Pressured', from: 'efficiency' },
  ],
  player_pass_attempts: [
    { key: 'dropbacks', label: 'Dropbacks / game', from: 'efficiency' },
    { key: 'pressured_pct', label: 'Pressured', from: 'efficiency' },
  ],
  player_pass_completions: [
    { key: 'dropbacks', label: 'Dropbacks / game', from: 'efficiency' },
    { key: 'pass_catchable_pct', label: 'Catchable', from: 'efficiency' },
  ],
  player_pass_tds: [
    { key: 'ez_attempts', label: 'End-zone throws', from: 'efficiency' },
    { key: 'dropbacks', label: 'Dropbacks / game', from: 'efficiency' },
  ],
  player_anytime_td: [
    { key: 'ez_targets', label: 'End-zone targets', from: 'role' },
    { key: 'rz5_carry_share', label: 'Inside-5 carries', from: 'role' },
    { key: 'rz5_snap_share', label: 'Inside-5 snaps', from: 'role' },
  ],
};

export function heroTiles(cards: FpCards | null | undefined, market: string): Array<{ key: string; label: string; text: string }> {
  if (!cards) return [];
  const specs = ROLE_TILES[market] ?? ROLE_TILES.player_reception_yds;
  const tiles: Array<{ key: string; label: string; text: string }> = [];
  for (const spec of specs) {
    const value = readMeasure(cards, spec.from, spec.key);
    if (value == null) continue;
    const text = isRateKey(spec.key) ? formatPct(value) : formatNum(value, 1);
    if (!text) continue;
    tiles.push({ key: spec.key, label: spec.label, text });
  }
  return tiles;
}

export function traitReading(
  traits: Record<string, number | null> | undefined,
  needle: string,
): { actual: number | null; rank: number | null; of: number | null; league: number | null } | null {
  if (!traits) return null;
  const match = Object.keys(traits).find((key) => key.includes(needle) && key.endsWith('_actual'));
  if (!match) return null;
  const base = match.slice(0, -'_actual'.length);
  return {
    actual: typeof traits[match] === 'number' ? traits[match] : null,
    rank: typeof traits[`${base}_rank`] === 'number' ? traits[`${base}_rank`] : null,
    of: typeof traits[`${base}_of`] === 'number' ? traits[`${base}_of`] : null,
    league: typeof traits[`${base}_league`] === 'number' ? traits[`${base}_league`] : null,
  };
}
