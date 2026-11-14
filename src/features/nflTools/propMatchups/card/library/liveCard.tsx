import { useEffect } from 'react';
import type {
  FpCards,
  NflPropPlayerPage,
  PropMarket,
  PropScheme,
  TrendGameLogEntry,
} from '@/features/propBreakdown/types';
import { formatAmerican } from '@/features/propBreakdown/format';
import { getNFLTeamColors } from '@/features/games/api/nflGames';
import { getNflLinesCity, lookupNflTeam } from '@/utils/nflTeamAssets';
import { actualField, baselineCaption, headlineFor, numField, ordinal, sectionsFor, vsPositionStat, type CardSection } from '../../fpCards';
import type { NflPropBookQuote } from '../../hooks';
import './prop-cards.css';
import { BookMark } from './BookMark';
import { CardHero, PropCard, StatTiles } from './CardHero';
import { ContextStrip } from './ContextStrip';
import { CoverageWheel, type CoverageShell } from './CoverageWheel';
import { DuelRow, type DuelSide, type DuelTone } from './DuelRow';
import { GameLog, type LogWeek } from './GameLog';
import { OwnName, OwnerLine, PlayerMark, TeamMark } from './Marks';
import { SchemeRead } from './SchemeRead';

const MINUS = '\u2212';

const LOOK_LABEL: Record<string, string> = {
  man: 'Man',
  zone: 'Zone',
  one_high: 'One high',
  two_high: 'Two high',
  blitz: 'Blitz',
  pressure: 'Pressure',
  heavy_box: 'Heavy box',
  light_box: 'Light box',
};

const RECEIVING_LOOKS = ['man', 'zone', 'one_high', 'two_high'];
const PASSING_LOOKS = ['man', 'zone', 'one_high', 'two_high', 'blitz', 'pressure'];
const RUSHING_LOOKS = ['heavy_box', 'light_box'];
const QB_WHEEL = ['man', 'zone', 'blitz', 'one_high', 'pressure', 'two_high'];
const RECV_WHEEL = ['man', 'zone', 'one_high', 'two_high'];

type Family = 'receiving' | 'rushing' | 'passing';

type LookStat = {
  name: string;
  pct: number | null;
  value: number | null;
  delta: number | null;
  sample: number | null;
  thin: boolean;
  unit: string;
  sampleNoun: string;
};

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function priceText(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price)) return null;
  return formatAmerican(price).replace('-', MINUS);
}

function cardNote(level: 'info' | 'error', message: string) {
  if (!import.meta.env.DEV) return;
  const line = `[prop-card] ${message}`;
  if (level === 'error') console.error(line);
  else console.info(line);
}

type MarketFigure =
  | { state: 'two'; line: string; over: string | null; under: string | null }
  | { state: 'yes'; price: string }
  | { state: 'pending' }
  | { state: 'fault' };

function marketFigure(market: PropMarket, playerName: string): MarketFigure {
  if (market.status !== 'posted') return { state: 'pending' };
  if (market.line == null) {
    if (market.key === 'player_anytime_td') {
      const price = priceText(market.over_price);
      return price ? { state: 'yes', price } : { state: 'pending' };
    }
    cardNote('error', `line: ${market.key} is posted with a null line for ${playerName}`);
    return { state: 'fault' };
  }
  return {
    state: 'two',
    line: formatLine(market.line),
    over: priceText(market.over_price),
    under: priceText(market.under_price),
  };
}

function TierRule({ label }: { label: string }) {
  return <div className="tier-div">{label}</div>;
}

function teamName(abbr: string): string {
  return lookupNflTeam(abbr)?.name ?? getNflLinesCity(abbr) ?? abbr;
}

function teamColor(abbr: string): string {
  return getNFLTeamColors(abbr).primary;
}

function marketFamily(market: string, kind: string | undefined): Family {
  if (market === 'player_anytime_td') return kind === 'qb' || kind === 'rb' ? 'rushing' : 'receiving';
  if (market.includes('rush')) return 'rushing';
  if (kind === 'qb' || market.startsWith('player_pass')) return 'passing';
  return 'receiving';
}

function looksFor(family: Family): string[] {
  if (family === 'passing') return PASSING_LOOKS;
  if (family === 'rushing') return RUSHING_LOOKS;
  return RECEIVING_LOOKS;
}

function defenseRate(scheme: PropScheme | null, look: string): number | null {
  const dim = scheme?.defense?.[look];
  if (!dim || typeof dim === 'string') return null;
  return num(dim.rate);
}

function readLook(scheme: PropScheme, look: string): LookStat | null {
  const split = scheme.player_splits?.[look as keyof NonNullable<PropScheme['player_splits']>];
  if (!split || typeof split !== 'object') return null;
  const row = split as unknown as Record<string, unknown>;
  const ypt = num(row.ypt);
  const ypa = num(row.ypa);
  const ypc = num(row.ypc);
  const value = ypt ?? ypa ?? ypc;
  if (value == null) return null;
  const sample = num(row.targets) ?? num(row.dropbacks) ?? num(row.carries);
  const delta = num(row.delta_ypt) ?? num(row.delta_ypa) ?? num(row.delta_ypc);
  const unit = ypt != null ? 'yards per target' : ypa != null ? 'yards per attempt' : 'yards per carry';
  const sampleNoun = ypt != null ? 'targets' : ypa != null ? 'dropbacks' : 'carries';
  return {
    name: LOOK_LABEL[look] ?? look,
    pct: defenseRate(scheme, look),
    value,
    delta,
    sample,
    thin: row.sample === 'thin',
    unit,
    sampleNoun,
  };
}

export function schemeLooks(page: NflPropPlayerPage, market: string): LookStat[] {
  const scheme = page.scheme;
  if (!scheme) return [];
  const family = marketFamily(market, scheme.kind);
  const looks = looksFor(family);
  if (family === 'rushing') {
    return looks
      .map((look) => {
        const split = scheme.rush_splits?.[look as 'heavy_box' | 'light_box'];
        if (!split) return null;
        const value = num(split.ypc);
        if (value == null) return null;
        return {
          name: LOOK_LABEL[look] ?? look,
          pct: defenseRate(scheme, look),
          value,
          delta: num(split.delta_ypc),
          sample: num(split.carries),
          thin: split.sample === 'thin',
          unit: 'yards per carry',
          sampleNoun: 'carries',
        } satisfies LookStat;
      })
      .filter((row): row is LookStat => row != null);
  }
  return looks
    .map((look) => readLook(scheme, look))
    .filter((row): row is LookStat => row != null);
}

export function usualRate(page: NflPropPlayerPage, market: string): { value: number; unit: string } | null {
  const overall = page.scheme?.player_overall as unknown as Record<string, unknown> | undefined;
  if (!overall) return null;
  const family = marketFamily(market, page.scheme?.kind);
  if (family === 'passing') {
    const value = num(overall.ypa);
    return value == null ? null : { value, unit: 'yards per attempt' };
  }
  if (family === 'rushing') {
    const value = num(overall.ypc);
    return value == null ? null : { value, unit: 'yards per carry' };
  }
  const value = num(overall.ypt);
  return value == null ? null : { value, unit: 'yards per target' };
}

function coverageWheel(page: NflPropPlayerPage, market: string): { slices: CoverageShell[]; unit: string; sampleNoun: string; usual: number | null } | null {
  const kind = page.scheme?.kind;
  const family = marketFamily(market, kind);
  const qb = kind === 'qb' && family === 'passing';
  const receiving = kind === 'receiving' && family === 'receiving';
  if (!qb && !receiving) return null;
  const metric = qb ? 'ypa' : 'ypt';
  const deltaKey = qb ? 'delta_ypa' : 'delta_ypt';
  const sampleKey = qb ? 'dropbacks' : 'targets';
  const families = qb ? QB_WHEEL : RECV_WHEEL;
  const splits = page.scheme?.player_splits;
  const who = `${page.player_name} (${market})`;
  if (!splits || Object.keys(splits).length === 0) {
    cardNote('info', `coverage: scheme.player_splits missing for ${who}`);
    return null;
  }
  const cells = families
    .map((name) => splits[name as keyof typeof splits])
    .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell));
  const valued = cells.filter((cell) => num((cell as unknown as Record<string, unknown>)[metric]) != null);
  if (cells.length > 0 && valued.length === 0) {
    cardNote('error', `coverage: scheme.player_splits is present but every ${metric} is null for ${who} — wrong field`);
    return null;
  }
  const overall = page.scheme?.player_overall as unknown as Record<string, unknown> | undefined;
  const slices: CoverageShell[] = [];
  for (const name of families) {
    const cell = splits[name as keyof typeof splits] as unknown as Record<string, unknown> | undefined;
    const value = num(cell?.[metric]);
    const rate = defenseRate(page.scheme, name);
    if (value == null || rate == null || rate <= 0) continue;
    slices.push({
      name: LOOK_LABEL[name] ?? name,
      pct: Math.round(rate * 100),
      yardsPerRoute: value,
      routes: num(cell?.[sampleKey]),
      delta: num(cell?.[deltaKey]),
      pctile: num(cell?.pctile),
    });
  }
  if (slices.length === 0) {
    cardNote('info', `coverage: no ${metric} with a snap rate for ${who}`);
    return null;
  }
  return {
    slices,
    unit: qb ? 'yards an attempt' : 'yards a target',
    sampleNoun: qb ? 'dropbacks' : 'targets',
    usual: num(overall?.[metric]),
  };
}

function washGap(market: string, line: number): number {
  if (market.includes('yds')) return 0.5;
  return Math.abs(line) * 0.03;
}

/** Enough games in the current season to leave last year off the chart. */
const CURRENT_SEASON_ENOUGH = 8;

export function gradedWeeks(log: TrendGameLogEntry[] | null | undefined, market: string): LogWeek[] {
  const weeks: LogWeek[] = [];
  for (const game of log ?? []) {
    const actual = game.actuals?.[market];
    const line = game.lines?.[market];
    if (typeof actual !== 'number' || typeof line !== 'number') continue;
    weeks.push({
      season: game.season,
      week: game.week,
      label: `W${game.week}`,
      opponent: game.opp,
      line,
      actual,
      ...(typeof game.is_home === 'boolean' ? { home: game.is_home } : {}),
      margin: Math.round((actual - line) * 10) / 10,
    });
  }
  weeks.sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.week ?? 0) - (b.week ?? 0));
  const latest = weeks.reduce((max, week) => Math.max(max, week.season ?? 0), 0);
  const current = weeks.filter((week) => week.season === latest);
  const shown = current.length >= CURRENT_SEASON_ENOUGH ? current : weeks;
  return shown.slice(-10);
}

export function medianMargin(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

const TRAIT_FLOOR = 0.05;
const EDGE_WASH = 0.03;

const TRAIT_KEYS: Record<Family, string[]> = {
  rushing: [
    'RushingConceptZoneAttemptsSuccessPercentage',
    'RushingConceptManAttemptsSuccessPercentage',
    'RushingAttemptsStuffsPercentage',
    'RushingRunsExplosivePercentage',
    'RushingYardsAfterContactPerAttempt',
  ],
  passing: [
    'PassingPressuredPercentage',
    'PassingSackedPercentage',
    'PassingCompletionsPercentage',
    'PassingDeepThrowAttemptsPercentage',
  ],
  receiving: [
    'ReceivingAlignmentWideTargetsPercentage',
    'ReceivingAlignmentSlotTargetsPercentage',
    'ReceivingAlignmentInlineTargetsPercentage',
    'ReceivingAlignmentBackfieldTargetsPercentage',
    'PassingYardsAfterCatchPercentage',
    'PassingTargetedReadCheckdownPercentage',
  ],
};

const TRAIT_LABEL: Record<string, string> = {
  RushingConceptZoneAttemptsSuccessPercentage: 'Zone run success',
  RushingConceptManAttemptsSuccessPercentage: 'Man/gap run success',
  RushingAttemptsStuffsPercentage: 'Stuff rate',
  RushingRunsExplosivePercentage: 'Explosive runs',
  RushingYardsAfterContactPerAttempt: 'Yards after contact',
  PassingPressuredPercentage: 'Pressure rate',
  PassingSackedPercentage: 'Sack rate',
  PassingCompletionsPercentage: 'Completion rate',
  PassingDeepThrowAttemptsPercentage: 'Deep throws',
  ReceivingAlignmentWideTargetsPercentage: 'Targets out wide',
  ReceivingAlignmentSlotTargetsPercentage: 'Slot targets',
  ReceivingAlignmentInlineTargetsPercentage: 'Inline targets',
  ReceivingAlignmentBackfieldTargetsPercentage: 'Backfield targets',
  PassingYardsAfterCatchPercentage: 'Yards after the catch',
  PassingTargetedReadCheckdownPercentage: 'Checkdowns',
};

export type TraitPick = {
  key: string;
  label: string;
  actual: number;
  league: number;
  rank: number | null;
  of: number | null;
  gap: number;
};

export function rankedTraits(cards: FpCards | null | undefined, family: Family): TraitPick[] {
  const traits = cards?.scheme?.defense_traits;
  if (!traits) return [];
  const rows: TraitPick[] = [];
  for (const key of TRAIT_KEYS[family]) {
    const actual = num(traits[`${key}_actual`]);
    const league = num(traits[`${key}_league`]);
    if (actual == null || league == null || league === 0) continue;
    const gap = actual / league - 1;
    if (Math.abs(gap) < TRAIT_FLOOR) continue;
    rows.push({
      key,
      label: TRAIT_LABEL[key] ?? key,
      actual,
      league,
      rank: num(traits[`${key}_rank`]),
      of: num(traits[`${key}_of`]),
      gap,
    });
  }
  return rows.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 4);
}

function formatTraitValue(key: string, value: number): string {
  if (key.endsWith('Percentage')) return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
}

function sideName(abbr: string): string {
  return getNflLinesCity(abbr) ?? abbr;
}

function rankOf(rank: number | null): string | null {
  if (rank == null) return null;
  return `${ordinal(Math.round(rank))} of 32`;
}

/** Two-sided line vs front. Null when the blob is absent or both edges sit inside ±0.03. */
export function trenchCopy(cards: FpCards | null | undefined, offenseAbbr: string, defenseAbbr: string): string | null {
  const trenches = cards?.trenches;
  if (!trenches) return null;
  const pass = num(trenches.pass_pro_edge);
  const run = num(trenches.run_block_edge);
  const passLive = pass != null && Math.abs(pass) >= EDGE_WASH;
  const runLive = run != null && Math.abs(run) >= EDGE_WASH;
  if (!passLive && !runLive) return null;
  const offense = sideName(offenseAbbr);
  const defense = sideName(defenseAbbr);
  const line = trenches.line ?? {};
  const front = trenches.front ?? {};
  const offRank = rankOf(num(line.ol_pressure_faced_rank));
  const frontRank = rankOf(num(front.dl_pressure_generated_rank));
  const ybc = num(line.ol_ybc_per_att);
  const allowed = num(front.dl_ybc_allowed);
  const ybcRank = rankOf(num(front.dl_ybc_allowed_rank));
  const pocketWinner = pass != null && pass < 0 ? defense : offense;
  const pocket = `${pocketWinner} win the pocket — ${offense}'s line is ${offRank ?? 'unranked'} at keeping pressure off and ${defense}'s front is ${frontRank ?? 'unranked'} at creating it`;
  const ground = ybc != null && allowed != null
    ? `${offense} opens ${ybc.toFixed(2)} yards before contact against a ${defense} front giving up ${allowed.toFixed(2)}${ybcRank ? `, ${ybcRank}` : ''}`
    : null;
  const passWinner = pass != null && pass < 0 ? 'front' : 'line';
  const runWinner = run != null && run > 0 ? 'line' : 'front';
  const flips = passLive && runLive && passWinner !== runWinner;
  const leadWithGround = runLive && ground != null && (!passLive || Math.abs(run!) >= Math.abs(pass!));
  if (leadWithGround) {
    const rest = passLive ? ` ${flips ? 'In the pocket it flips: ' : 'In the pocket, '}${pocket}.` : '';
    return `${ground}.${rest}`.trim();
  }
  if (!passLive) return ground;
  const rest = runLive && ground ? ` ${flips ? 'On the ground it flips: ' : 'On the ground, '}${ground}.` : '';
  return `${pocket}.${rest}`.trim();
}

const ALIGN_LABEL: Record<string, string> = {
  slot: 'Slot',
  wide: 'Out wide',
  inline: 'Inline',
  backfield: 'Backfield',
};

function markInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? name;
}

function englishList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function favor(delta: number, wash: number, player: string, defense: string): { tone: DuelTone; side: DuelSide; winner: string } {
  if (Math.abs(delta) < wash) return { tone: 'nil', side: 'defense', winner: 'a wash' };
  if (delta > 0) return { tone: 'pos', side: 'player', winner: player };
  return { tone: 'neg', side: 'defense', winner: defense };
}

function rankLabel(rank: number | null, of: number | null): string | undefined {
  if (rank == null || of !== 32) return undefined;
  return `${ordinal(rank)} of 32`;
}

function identitySentence(defense: string, identity: string, note: string | null): string {
  const shell = identity.toLowerCase().replace(/\s*·\s*/g, ', ').replace(/\s+/g, ' ').trim();
  const last = shell.split(' ').pop() ?? '';
  const article = /^[aeiou]/.test(shell) ? 'an' : 'a';
  const lead = /s$/.test(last) ? `${defense} sits in ${shell}.` : `${defense} sits in ${article} ${shell}.`;
  if (!note) return lead;
  return `${lead} ${defense} ${note.trim().replace(/\.$/, '')}.`;
}

type AlignRow = {
  key: string;
  label: string;
  share: number;
  actual: number;
  league: number;
  rank: number | null;
  of: number | null;
};

function alignmentRows(cards: FpCards): AlignRow[] {
  const spots = cards.playsheet?.spots ?? {};
  const align = cards.matchup?.vs_alignment ?? {};
  const entries = Object.entries(spots).flatMap(([key, spot]) => {
    const routes = num(spot?.routes);
    const defense = align[key];
    const actual = num(defense?.yds_actual);
    const league = num(defense?.yds_league);
    if (routes == null || routes <= 0 || actual == null || league == null || league === 0) return [];
    return [{ key, routes, actual, league, rank: num(defense?.yds_rank), of: num(defense?.yds_of) }];
  });
  const total = entries.reduce((sum, row) => sum + row.routes, 0);
  if (total <= 0) return [];
  return entries.map((row) => ({
    key: row.key,
    label: ALIGN_LABEL[row.key] ?? row.key,
    share: row.routes / total,
    actual: row.actual,
    league: row.league,
    rank: row.rank,
    of: row.of,
  }));
}

type RouteCompare = {
  route: string;
  share: number | null;
  perGame: number | null;
  actual: number;
  league: number;
  rank: number | null;
  of: number | null;
};

function routeCompares(cards: FpCards): RouteCompare[] {
  return (cards.routes ?? []).flatMap((row) => {
    const actual = num(row.def_yards_per_route_actual);
    const league = num(row.def_yards_per_route_league);
    if (!row.route || actual == null || league == null) return [];
    return [{
      route: row.route,
      share: num(row.share),
      perGame: num(row.routes),
      actual,
      league,
      rank: num(row.def_rank),
      of: num(row.def_of),
    }];
  });
}

function linesMatch(bookLine: number | null, pageLine: number | null): boolean {
  if (bookLine == null || pageLine == null) return bookLine == null && pageLine == null;
  return bookLine === pageLine;
}

/** Books whose posted number is the line on this market. A different number stays off this tab. */
export function tabBooks(market: PropMarket, quote?: NflPropBookQuote | null): { book: string; line: number | null; price: number | null }[] {
  if (!quote) return [];
  const marks: { book: string; line: number | null; price: number | null }[] = [];
  if (quote.overBook && linesMatch(quote.overLine, market.line)) {
    marks.push({ book: quote.overBook, line: quote.overLine ?? market.line, price: quote.overPrice ?? market.over_price });
  }
  if (quote.underBook && quote.underBook !== quote.overBook && linesMatch(quote.underLine, market.line)) {
    marks.push({ book: quote.underBook, line: quote.underLine ?? market.line, price: quote.underPrice ?? market.under_price });
  }
  return marks;
}

function formatLine(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function lookSentence(look: LookStat, defense: string, usual: number | null): string {
  const howOften = look.pct == null
    ? `How often ${defense} plays this is not on file.`
    : `${defense} plays this on ${Math.round(look.pct * 100)}% of snaps.`;
  const sample = look.sample == null ? '' : ` That comes from ${Math.round(look.sample)} ${look.sampleNoun}.`;
  const versus = look.delta == null || usual == null
    ? ` He gains ${look.value!.toFixed(2)} ${look.unit}.`
    : ` He gains ${look.value!.toFixed(2)} ${look.unit}, ${Math.abs(look.delta).toFixed(2)} ${look.delta < 0 ? 'below' : 'above'} his usual ${usual.toFixed(2)}.`;
  const thin = look.thin ? ' The sample is thin.' : '';
  return `${howOften}${versus}${sample}${thin}`;
}

function StatBody({
  page,
  market,
  log,
  facts = [],
  quote = null,
}: {
  page: NflPropPlayerPage;
  market: PropMarket;
  log: TrendGameLogEntry[] | null;
  facts?: { label: string; value: string }[];
  quote?: NflPropBookQuote | null;
}) {
  const defense = teamName(page.opponent);
  const family = marketFamily(market.key, page.scheme?.kind);
  const identity = page.scheme?.defense?.identity_by_family?.[family] ?? page.scheme?.defense?.identity;
  const note = family === 'receiving' ? page.scheme?.defense?.note_by_family?.receiving ?? null : null;
  const looks = schemeLooks(page, market.key);
  const wheel = coverageWheel(page, market.key);
  const allowed = new Set(sectionsFor(page.position, market.key, page.fp_cards));
  const heroBook = tabBooks(market, quote)[0];
  const usual = usualRate(page, market.key);
  const headline = market.key === 'player_anytime_td' ? null : headlineFor(page, market.key);
  const baseline = headline?.value ?? null;
  const baselineNote = headline ? baselineCaption(headline, headline.source === 'season' ? page.baseline?.season : null) : null;
  const figure = marketFigure(market, page.player_name);
  const line = figure.state === 'two' ? market.line : null;
  const gap = baseline != null && line != null ? baseline - line : null;
  const wash = gap != null && line != null && Math.abs(gap) < washGap(market.key, line);
  const tiles = page.fp_cards && (allowed.has('role') || allowed.has('efficiency'))
    ? usageTiles(page.fp_cards, market.key)
    : [];
  const weeks = gradedWeeks(log, market.key);
  const cleared = weeks.filter((week) => week.margin > 0).length;
  const median = medianMargin(weeks.map((week) => week.margin));
  const medianText = median == null
    ? null
    : `${median > 0 ? '+' : median < 0 ? MINUS : ''}${Math.abs(median).toFixed(1)}`;
  const trenches = trenchCopy(page.fp_cards, page.team, page.opponent);
  const traits = rankedTraits(page.fp_cards, family);
  const traitLead = traitIntro(page.fp_cards, family, defense);
  const showCoverageRead = family !== 'rushing' && Boolean(identity);
  const priceLine = figure.state === 'yes'
    ? figure.price
    : figure.state === 'two'
      ? [figure.over ? `O ${figure.over}` : null, figure.under ? `U ${figure.under}` : null].filter(Boolean).join(' · ')
      : null;
  const away = page.is_home ? page.opponent : page.team;
  const home = page.is_home ? page.team : page.opponent;
  const kickoff = page.kickoff
    ? new Date(page.kickoff).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
      })
    : 'Kickoff time not posted';

  return (
    <>
      <TierRule label="Context" />
      <ContextStrip
        kicker={<><span className="nmb sm">1</span>The game</>}
        matchup={{
          away: { team: away, name: teamName(away), color: teamColor(away) },
          home: { team: home, name: teamName(home), color: teamColor(home) },
          detail: `${page.game_label ?? `${away} at ${home}`} · ${kickoff} ET`,
        }}
        facts={facts}
      />
      {trenches || traits.length > 0 ? <TierRule label="The trenches" /> : null}
      {trenches ? (
        <PropCard tier="t3" title="The line and the front">
          <p className="lede">{trenches}</p>
        </PropCard>
      ) : null}
      {traits.length > 0 ? (
        <PropCard tier="t3" title={`Where ${defense} sit against the league`}>
          {traitLead ? <p className="lede">{traitLead}</p> : null}
          <div className="rows">
            {traits.map((trait) => {
              const above = trait.gap > 0;
              return (
                <DuelRow
                  key={trait.key}
                  duel={false}
                  label={trait.label}
                  detail={`${formatTraitValue(trait.key, trait.actual)} against a league ${formatTraitValue(trait.key, trait.league)}.`}
                  tone={above ? 'pos' : 'neg'}
                  side={above ? 'player' : 'defense'}
                  value={`${above ? '+' : MINUS}${Math.abs(trait.gap * 100).toFixed(1)}%`}
                  rank={trait.rank != null ? `${ordinal(Math.round(trait.rank))} of ${trait.of ?? 32}` : undefined}
                  reach={Math.min(48, (Math.abs(trait.gap) / 0.5) * 48)}
                />
              );
            })}
          </div>
        </PropCard>
      ) : null}
      <TierRule label="Measured" />
      {showCoverageRead ? (
        <SchemeRead kicker={<><span className="nmb sm">3</span>Coverage</>} sentence={identitySentence(defense, identity!, note)}>
          {wheel
            ? `${defense} plays ${englishList(wheel.slices.map((slice) => `${slice.name.toLowerCase()} on ${slice.pct}% of snaps`))}. These looks can overlap, so the slices on the wheel are sized against each other.`
            : looks.some((look) => look.pct != null)
              ? `${defense} plays ${englishList(looks.filter((look) => look.pct != null).map((look) => `${look.name.toLowerCase()} on ${Math.round(look.pct! * 100)}% of snaps`))}. These looks overlap, so the percents are not pieces of one pie.`
              : 'The snap rates for this coverage are not on file.'}
        </SchemeRead>
      ) : null}
      <section className="card t3 hero">
        <div className="who">
          <PlayerMark initials={markInitials(page.player_name)} color={teamColor(page.team)} title={page.player_name} size={64} photo={page.headshot_url ?? undefined} />
          <div className="id">
            <div className="idrow">
              <span className="badge">{page.position}</span>
              <span className="mt">{away} at {home} · Week {page.week}</span>
            </div>
            <h2>{page.player_name}</h2>
            <p className="mkttype">{market.label}</p>
          </div>
        </div>
        <div className="verses">
          <div className="vcell line">
            <div className="k">The number</div>
            <div className="v" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {figure.state === 'two' ? figure.line : figure.state === 'yes' ? figure.price : 'no line yet'}
              {figure.state === 'two' && heroBook ? <BookMark bookKey={heroBook.book} /> : null}
            </div>
            {figure.state === 'two' && priceLine ? <div className="n">{priceLine}</div> : null}
          </div>
          {baseline != null && market.key !== 'player_anytime_td' ? (
            <>
              {gap != null ? (
                <div className={`gapchip ${wash || gap === 0 ? 'nil' : gap > 0 ? 'pos' : 'neg'}`}>
                  {gap > 0 ? '+' : gap < 0 ? MINUS : ''}
                  {Math.abs(gap).toFixed(1)}
                </div>
              ) : null}
              <div className="vcell">
                <div className="k">His baseline</div>
                <div className="v">{baseline.toFixed(1)}</div>
                {baselineNote ? <div className="n">{baselineNote}</div> : null}
              </div>
            </>
          ) : null}
        </div>
        {market.key === 'player_anytime_td' && !page.fp_cards && num(page.baseline?.total_td) != null ? (
          <p className="how">
            {page.baseline?.total_td} touchdowns in {page.baseline?.season}, across {page.baseline?.games} games.
            This market is priced yes or no.
          </p>
        ) : null}
      </section>
      {wheel ? (
        <div className={tiles.length > 0 ? 'pair' : undefined}>
          <PropCard tier="t3" title={`What ${defense} sits in, and how he does in it`} meta={wheel.unit}>
            <OwnerLine>
              <OwnName mark={<PlayerMark initials={markInitials(page.player_name)} color={teamColor(page.team)} title={page.player_name} size={28} photo={page.headshot_url ?? undefined} />} name={page.player_name} />
              {' vs '}
              <OwnName mark={<TeamMark team={page.opponent} title={defense} color={teamColor(page.opponent)} size={26} />} name={`${defense} coverage mix`} />
          </OwnerLine>
          <CoverageWheel
            copy="family"
            measure={wheel.unit}
            sampleNoun={wheel.sampleNoun}
            label={`${defense} coverage mix with ${page.player_name}'s ${wheel.unit}`}
            defenseName={defense}
            composite={wheel.usual != null ? wheel.usual.toFixed(2) : wheel.slices[0].yardsPerRoute!.toFixed(2)}
            season={wheel.usual ?? wheel.slices[0].yardsPerRoute ?? 0}
            seasonLabel={wheel.usual != null ? `his usual is ${wheel.usual.toFixed(2)}` : 'his usual rate'}
            unit={wheel.unit}
            shells={wheel.slices}
          />
          </PropCard>
          {tiles.length > 0 ? (
            <PropCard tier="t3" title="His usage, entering" meta="no matchup component">
              <StatTiles tiles={tiles} />
            </PropCard>
          ) : null}
        </div>
      ) : null}
      {!wheel && looks.length > 0 && family !== 'rushing' ? (
        <PropCard tier="t3" title={`What ${defense} sits in`} meta={usual?.unit ?? 'production'}>
          <p className="lede">
            {family === 'rushing'
              ? `Each row is a box look. The percent is how often ${defense} plays it. The yards are what he gains in that look, next to his usual ${usual ? `${usual.value.toFixed(2)} ${usual.unit}` : 'rate'}.`
              : `Each row is one coverage look. The percent is how often ${defense} plays it. These looks overlap, so the percents are not pieces of one pie. The yards are what he gains in that look, next to his usual ${usual ? `${usual.value.toFixed(2)} ${usual.unit}` : 'rate'}.`}
          </p>
          <div className="rows">
            {looks.map((look) => {
              const tone = look.delta == null || Math.abs(look.delta) < 0.5 ? 'nil' : look.delta > 0 ? 'pos' : 'neg';
              return (
                <DuelRow
                  key={look.name}
                  duel={false}
                  label={look.name}
                  detail={lookSentence(look, defense, usual?.value ?? null)}
                  tone={tone}
                  side={tone === 'neg' ? 'defense' : 'player'}
                  value={look.delta == null ? look.value!.toFixed(2) : `${look.delta > 0 ? '+' : MINUS}${Math.abs(look.delta).toFixed(2)}`}
                  reach={Math.min(48, Math.abs(look.delta ?? 0) * 16)}
                />
              );
            })}
          </div>
        </PropCard>
      ) : null}
      {weeks.length > 0 ? (
        <PropCard tier="t3" title="Every game against that week's number">
          <GameLog
            weeks={weeks}
            hero={
              <CardHero value={`${cleared} of ${weeks.length}${medianText ? ` · ${medianText}` : ''}`} tone={cleared * 2 >= weeks.length ? 'pos' : 'neg'}>
                cleared that week&apos;s line{medianText ? ' · median margin' : ''}
              </CardHero>
            }
          />
        </PropCard>
      ) : null}
      <FpSections page={page} defense={defense} market={market} allowed={allowed} hideUsage={Boolean(wheel && tiles.length > 0)} />
    </>
  );
}

function FpSections({
  page,
  defense,
  market,
  allowed,
  hideUsage = false,
}: {
  page: NflPropPlayerPage;
  defense: string;
  market: PropMarket;
  allowed: Set<CardSection>;
  hideUsage?: boolean;
}) {
  const cards = page.fp_cards;
  if (!cards) return null;
  const spots = allowed.has('alignment') ? alignmentRows(cards) : [];
  const routes = allowed.has('routes') ? routeCompares(cards) : [];
  const allowance = allowed.has('vs_position') ? allowanceRow(cards, market.key, page.position) : null;
  const concepts = allowed.has('run_concept') ? conceptRows(cards) : [];
  const tiles = hideUsage || !(allowed.has('role') || allowed.has('efficiency')) ? [] : usageTiles(cards, market.key);
  const player = lastName(page.player_name);
  const alignNet = spots.reduce((sum, row) => sum + row.share * (row.actual - row.league), 0);
  const alignTone = favor(alignNet, 1, player, defense);
  const routeNet = routes.length === 0
    ? 0
    : routes.reduce((sum, row) => sum + (row.share ?? 1 / routes.length) * (row.actual - row.league), 0);
  const routeTone = favor(routeNet, 0.05, player, defense);
  const playerMark = (size: number) => (
    <PlayerMark initials={markInitials(page.player_name)} color={teamColor(page.team)} title={page.player_name} size={size} photo={page.headshot_url ?? undefined} />
  );
  const defenseMark = (size: number) => (
    <TeamMark team={page.opponent} title={defense} color={teamColor(page.opponent)} size={size} />
  );
  const conceptNet = concepts.length === 0
    ? 0
    : concepts.reduce((sum, row) => sum + (row.actual - row.league), 0) / concepts.length;
  const conceptTone = favor(conceptNet, 0.15, player, defense);
  return (
    <>
      {allowance ? (
        <PropCard tier="t3" title={`What ${defense} allows`} meta={allowance.spec.unit}>
          <OwnerLine>
            <OwnName mark={playerMark(28)} name={page.player_name} />
            {' vs '}
            <OwnName mark={defenseMark(26)} name={defense} />
          </OwnerLine>
          <div className="rows">
            {(() => {
              const side = favor(allowance.gap, 0.03, player, defense);
              return (
                <DuelRow
                  label={allowance.spec.unit}
                  detail={allowanceDetail(allowance, defense)}
                  tone={side.tone}
                  side={side.side}
                  winner={side.winner}
                  mark={side.side === 'player' ? playerMark(17) : defenseMark(17)}
                  value={`${allowance.gap > 0 ? '+' : MINUS}${Math.abs(allowance.gap * 100).toFixed(1)}%`}
                  rank={rankLabel(allowance.rank, allowance.of)}
                  reach={Math.min(48, Math.abs(allowance.gap) * 140)}
                />
              );
            })()}
          </div>
        </PropCard>
      ) : null}
      {concepts.length > 0 ? (
        <PropCard tier="t3" title="How he runs" meta="yards a carry vs the league">
          <OwnerLine>
            <OwnName mark={playerMark(28)} name={page.player_name} />
            {' vs '}
            <OwnName mark={defenseMark(26)} name={defense} />
          </OwnerLine>
          <p className="lede">
            Each row is a run concept. The bar is what {defense} allow on that concept against the league,
            so it points at {conceptTone.side === 'player' ? `${player}'s side` : conceptTone.side === 'defense' ? `${defense}'s side` : 'a wash'}.
          </p>
          <div className="rows">
            {concepts.map((row) => {
              const tone = favor(row.gap, 0.03, player, defense);
              const his = row.his == null ? '' : `He gains ${row.his.toFixed(2)} yards a carry`;
              const tries = row.attempts == null ? '' : `${his ? ' on ' : ''}${row.attempts.toFixed(0)} ${row.name.toLowerCase()} carries`;
              return (
                <DuelRow
                  key={row.name}
                  label={row.name}
                  detail={`${his}${tries}${his || tries ? '. ' : ''}${defense} allow ${row.actual.toFixed(2)} yards a carry. The league allows ${row.league.toFixed(2)}.`}
                  tone={tone.tone}
                  side={tone.side}
                  winner={tone.winner}
                  mark={tone.side === 'player' ? playerMark(17) : defenseMark(17)}
                  value={`${row.gap > 0 ? '+' : MINUS}${Math.abs(row.gap * 100).toFixed(1)}%`}
                  rank={rankLabel(row.rank, row.of)}
                  reach={Math.min(48, Math.abs(row.gap) * 140)}
                />
              );
            })}
          </div>
        </PropCard>
      ) : null}
      {spots.length > 0 ? (
        <PropCard tier="t3" title="Where he lines up" meta="vs league average">
          <OwnerLine>
            <OwnName mark={playerMark(28)} name={page.player_name} />
            {' vs '}
            <OwnName mark={defenseMark(26)} name={defense} />
          </OwnerLine>
          <CardHero value={`${alignNet > 0 ? '+' : alignNet < 0 ? MINUS : ''}${Math.abs(alignNet).toFixed(1)} yds`} tone={alignTone.tone}>
            {alignTone.tone === 'nil' ? 'nearly a wash' : alignTone.tone === 'pos' ? `${player}'s side` : `${defense}'s side`}
            {' — weighted by where his routes actually start'}
          </CardHero>
          <div className="rows">
            {spots.map((row) => {
              const gap = (row.actual - row.league) / row.league;
              const side = favor(gap, 0.03, player, defense);
              return (
                <DuelRow
                  key={row.key}
                  label={row.label}
                  detail={`${(row.share * 100).toFixed(1)}% of his routes start ${row.label === 'Out wide' ? 'out wide' : `in the ${row.label.toLowerCase()}`}. ${defense} allow ${row.actual.toFixed(1)} yards a game to receivers lined up there. A league-average defense allows ${row.league.toFixed(1)}.`}
                  tone={side.tone}
                  side={side.side}
                  winner={side.winner}
                  mark={side.side === 'player' ? playerMark(17) : defenseMark(17)}
                  value={`${gap > 0 ? '+' : MINUS}${Math.abs(gap * 100).toFixed(1)}%`}
                  rank={rankLabel(row.rank, row.of)}
                  reach={Math.min(48, Math.abs(gap) * 140)}
                />
              );
            })}
          </div>
        </PropCard>
      ) : null}
      {routes.length > 0 ? (
        <PropCard tier="t3" title="His route tree" meta="yards vs an average defence">
          <OwnerLine>
            <OwnName mark={playerMark(28)} name={page.player_name} />
            {' vs '}
            <OwnName mark={defenseMark(26)} name={defense} />
          </OwnerLine>
          <CardHero value={`${routeNet > 0 ? '+' : routeNet < 0 ? MINUS : ''}${Math.abs(routeNet).toFixed(1)} yds`} tone={routeTone.tone}>
            {routeTone.tone === 'nil' ? 'nearly a wash' : routeTone.tone === 'pos' ? `${player}'s side` : `${defense}'s side`}
            {' — each branch against what an average defence allows'}
          </CardHero>
          <div className="rows">
            {routes.map((row) => {
              const gap = row.actual - row.league;
              const side = favor(gap, 0.05, player, defense);
              const share = row.share != null ? `${(row.share * 100).toFixed(1)}% of his routes` : 'A branch of his tree';
              const volume = row.perGame != null ? `, ${row.perGame.toFixed(1)} a game` : '';
              return (
                <DuelRow
                  key={row.route}
                  label={row.route}
                  detail={`${share}${volume}. ${defense} allow ${row.actual.toFixed(2)} yards a route on ${row.route.toLowerCase()} routes. The league allows ${row.league.toFixed(2)}.`}
                  tone={side.tone}
                  side={side.side}
                  winner={side.winner}
                  mark={side.side === 'player' ? playerMark(17) : defenseMark(17)}
                  value={`${gap > 0 ? '+' : MINUS}${Math.abs(gap).toFixed(1)} yds`}
                  rank={rankLabel(row.rank, row.of)}
                  reach={Math.min(48, Math.abs(gap) * 16)}
                />
              );
            })}
          </div>
        </PropCard>
      ) : null}
      {tiles.length > 0 ? (
        <PropCard tier="t3" title="His usage, entering" meta="no matchup component">
          <StatTiles tiles={tiles} />
        </PropCard>
      ) : null}
    </>
  );
}

type AllowanceRow = {
  spec: { unit: string };
  actual: number;
  league: number;
  rank: number | null;
  of: number | null;
  gap: number;
};

function allowanceRow(cards: FpCards, market: string, position: string): AllowanceRow | null {
  const spec = vsPositionStat(market, position);
  const bag = cards.matchup?.vs_position;
  if (!spec || !bag) return null;
  const actual = actualField(bag, spec.key);
  const league = numField(bag, `${spec.key}_league`);
  if (actual == null || league == null || league === 0) return null;
  return {
    spec,
    actual,
    league,
    rank: numField(bag, `${spec.key}_rank`),
    of: numField(bag, `${spec.key}_of`),
    gap: (actual - league) / league,
  };
}

function allowanceDetail(row: AllowanceRow, defense: string): string {
  return `${defense} allow ${row.actual.toFixed(1)} ${row.spec.unit}. A league-average defense allows ${row.league.toFixed(1)}.`;
}

type ConceptRow = {
  name: string;
  actual: number;
  league: number;
  his: number | null;
  attempts: number | null;
  rank: number | null;
  of: number | null;
  gap: number;
};

function traitIntro(cards: FpCards | null | undefined, family: Family, defense: string): string | null {
  if (!cards || family !== 'rushing') return null;
  const lead = [...conceptRows(cards)].sort((a, b) => (b.attempts ?? 0) - (a.attempts ?? 0))[0];
  if (!lead) return null;
  const volume = lead.attempts == null ? '' : `${lead.attempts.toFixed(1)} of his carries are ${lead.name.toLowerCase()}. `;
  const his = lead.his == null ? '' : `He averages ${lead.his.toFixed(2)} yards a carry on them. `;
  const rank = lead.rank != null ? `, ${ordinal(Math.round(lead.rank))} of 32` : '';
  return `${volume}${his}${defense} allow ${lead.actual.toFixed(2)} yards a carry on that concept${rank}.`.trim();
}

function conceptRows(cards: FpCards): ConceptRow[] {
  const by = cards.run_concept?.by ?? {};
  return Object.entries(by).flatMap(([name, row]) => {
    const actual = num(row?.def_yards_per_attempt);
    const league = num(row?.def_yards_per_attempt_league);
    if (actual == null || league == null || league === 0) return [];
    return [{
      name,
      actual,
      league,
      his: num(row?.yards_per_attempt),
      attempts: num(row?.attempts),
      rank: num(row?.def_rank),
      of: num(row?.def_of),
      gap: (actual - league) / league,
    }];
  });
}

function usageTiles(cards: FpCards, market: string): { label: string; value: string; unit?: string }[] {
  const source: Record<string, number | null | undefined> = { ...cards.role, ...cards.efficiency };
  const rush = market.includes('rush');
  const labels: Record<string, string> = rush
    ? { carry_share: 'Carry share', snap_share: 'Snap share', rz5_carry_share: 'Goal-line carries' }
    : market === 'player_anytime_td'
      ? {}
      : {
          target_share: 'Target share',
          route_share: 'Route share',
          routes_per_game: 'Routes/game',
          yards_per_route: 'Yards/route',
          adot: 'aDOT',
          catchable_pct: 'Catchable',
        };
  return Object.entries(labels).flatMap(([key, label]) => {
    const value = num(source[key]);
    if (value == null) return [];
    const rate = key.includes('share') || key.includes('pct');
    return [{ label, value: rate ? (value <= 1 ? value * 100 : value).toFixed(1) : value.toFixed(1), unit: rate ? '%' : undefined }];
  });
}

export function LivePropCard({
  page,
  marketKey,
  onMarket,
  log = null,
  facts = [],
  books = null,
}: {
  page: NflPropPlayerPage;
  marketKey: string | null;
  onMarket: (market: string) => void;
  log?: TrendGameLogEntry[] | null;
  facts?: { label: string; value: string }[];
  books?: Record<string, NflPropBookQuote | undefined> | null;
}) {
  const posted = page.markets.filter((market) => market.status === 'posted');
  const selected = page.markets.find((market) => market.key === marketKey) ?? posted[0] ?? page.markets[0];
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.info(
      `[prop-card] ${page.player_name}: fp_cards=${page.fp_cards ? 'yes' : 'no'} research=${page.research ? 'yes' : 'no'} headshot=${page.headshot_url ? 'yes' : 'no'} projection=${page.projection ? 'yes' : 'no'} scheme=${page.scheme?.kind ?? 'no'}`,
    );
  }, [page]);
  return (
    <div className="prop-cards" data-prop-card="live">
      <div className="mkts" role="tablist" aria-label="Prop markets">
        {page.markets.map((market) => {
          const figure = marketFigure(market, page.player_name);
          const marks = figure.state === 'pending' || figure.state === 'fault' ? [] : tabBooks(market, books?.[market.key]);
          return (
            <button
              key={market.key}
              type="button"
              className={market.key === selected?.key ? 'mkt on' : 'mkt'}
              role="tab"
              aria-selected={market.key === selected?.key}
              disabled={market.status !== 'posted'}
              onClick={() => onMarket(market.key)}
            >
              <span>{market.label}</span>
              <span className="ln">
                {marks.map((mark) => <BookMark key={mark.book} bookKey={mark.book} />)}
                {figure.state === 'two' ? (
                  <>
                    <span>{figure.line}</span>
                    {figure.over ? <span>O {figure.over}</span> : null}
                    {figure.under ? <span>U {figure.under}</span> : null}
                  </>
                ) : figure.state === 'yes' ? (
                  <span>{figure.price}</span>
                ) : (
                  <span>no line yet</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {selected ? <StatBody page={page} market={selected} log={log} facts={facts} quote={books?.[selected.key]} /> : <p className="lede">No markets on file for this player.</p>}
    </div>
  );
}
