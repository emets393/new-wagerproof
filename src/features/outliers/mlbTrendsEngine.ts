// Faithful TS port of the iOS MLBTrendsEngine
// (wagerproof-ios-native/WagerproofKit/Sources/WagerproofServices/MLBTrendsEngine.swift).
// Builds Outliers trend cards client-side from `mlb_team_trends` splits/matchups
// plus slate odds + series context — market keys and row phrasing match iOS exactly.
import { MLB_FALLBACK_BY_NAME, normalizeTeamNameKey } from '@/utils/mlbTeamLogos';
import type {
  MLBTeamTrendRecord,
  MLBTrendsSlateBundle,
  OutliersTrendsBettingLine,
  OutliersTrendsCard,
  OutliersTrendsCardRow,
  OutliersTrendsGame,
  OutliersTrendsMatchupFilter,
  OutliersTrendsSubject,
  TrendH2HCell,
  TrendMatchupRecord,
  TrendSplitCell,
  TrendSplits,
} from './types';
import { gameLabel } from './types';

export const MLB_ALL_GAMES_PREVIEW_CAP = 50;

const TEAM_MARKETS = ['ml', 'rl', 'ou', 'f5_ml', 'f5_rl', 'f5_ou'];

/** Slate / mapping abbr → `mlb_team_trends.team_abbr` (legacy short keys in the table). */
const APP_TO_TRENDS_ABBR: Record<string, string> = {
  ARI: 'AZ',
  OAK: 'ATH',
  SFG: 'SF',
  SDP: 'SD',
};

export function trendsAbbr(appAbbr: string): string {
  const upper = appAbbr.toUpperCase();
  return APP_TO_TRENDS_ABBR[upper] ?? upper;
}

export function appAbbr(forTrendsAbbr: string): string {
  const upper = forTrendsAbbr.toUpperCase();
  for (const [app, trends] of Object.entries(APP_TO_TRENDS_ABBR)) {
    if (trends === upper) return app;
  }
  return upper;
}

export function remapTeamRecord(
  record: MLBTeamTrendRecord,
  preferredAppAbbr: string | null,
): MLBTeamTrendRecord {
  const resolvedAbbr = preferredAppAbbr ?? appAbbr(record.teamAbbr);
  const normalizedMatchups: Record<string, TrendMatchupRecord> = {};
  for (const [opp, value] of Object.entries(record.matchups)) {
    normalizedMatchups[appAbbr(opp)] = value;
  }
  return { ...record, teamAbbr: resolvedAbbr, matchups: normalizedMatchups };
}

function matchupRecord(
  matchups: Record<string, TrendMatchupRecord>,
  opponent: string,
): TrendMatchupRecord | null {
  const candidates = new Set([opponent.toUpperCase(), trendsAbbr(opponent), appAbbr(opponent)]);
  for (const key of candidates) {
    const record = matchups[key];
    if (record) return record;
  }
  return null;
}

const DIVISIONS: string[][] = [
  ['BAL', 'BOS', 'NYY', 'TBR', 'TOR'],
  ['CWS', 'CLE', 'DET', 'KC', 'MIN'],
  ['HOU', 'LAA', 'ATH', 'SEA', 'TEX'],
  ['ATL', 'MIA', 'NYM', 'PHI', 'WSH'],
  ['CHC', 'CIN', 'MIL', 'PIT', 'STL'],
  ['ARI', 'COL', 'LAD', 'SDP', 'SFG'],
];

export interface MLBGameContext {
  homeFavDog: string | null;
  awayFavDog: string | null;
  divisionScope: string;
  dayNightScope: string;
  seriesDimension: string | null;
}

export function isDivisionGame(home: string, away: string): boolean {
  const homeKey = trendsAbbr(home);
  const awayKey = trendsAbbr(away);
  return DIVISIONS.some((div) => {
    const normalized = div.map((ab) => trendsAbbr(ab));
    return normalized.includes(homeKey) && normalized.includes(awayKey);
  });
}

/** ET hour of a kickoff timestamp; falls back to the raw "T HH" token. */
function etHour(kickoff: string): number | null {
  const date = new Date(kickoff);
  if (!Number.isNaN(date.getTime())) {
    const hourPart = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .find((p) => p.type === 'hour')?.value;
    const hour = Number(hourPart);
    if (Number.isFinite(hour)) return hour;
  }
  const tail = kickoff.split('T').pop();
  const rawHour = Number(tail?.split(':')[0]);
  return Number.isFinite(rawHour) ? rawHour : null;
}

export function isDayGame(kickoff: string | null): boolean {
  if (!kickoff) return false;
  const hour = etHour(kickoff);
  return hour !== null && hour < 17;
}

export function mlbGameContext(game: OutliersTrendsGame): MLBGameContext {
  const ctx = game.mlbContext;
  const homeMl = ctx?.homeMl ?? null;
  const awayMl = ctx?.awayMl ?? null;

  let homeFav: string | null = null;
  let awayFav: string | null = null;
  if (homeMl !== null && awayMl !== null && homeMl !== awayMl) {
    if (homeMl < awayMl) {
      homeFav = 'favorite';
      awayFav = 'underdog';
    } else {
      homeFav = 'underdog';
      awayFav = 'favorite';
    }
  }

  const divisionScope = (ctx?.isDivisional ?? isDivisionGame(game.homeAb, game.awayAb))
    ? 'division'
    : 'non_division';
  const dayNightScope = (ctx?.isDayGame ?? isDayGame(game.kickoff)) ? 'day' : 'night';
  const n = ctx?.seriesGameNumber ?? null;
  const seriesDimension = n !== null && n >= 1 && n <= 4 ? `series_game_${n}` : null;

  return { homeFavDog: homeFav, awayFavDog: awayFav, divisionScope, dayNightScope, seriesDimension };
}

// MARK: - Nickname (port of MLBTeams.nickname — "Marlins", "Red Sox", …)

const TWO_TOKEN_MASCOTS = new Set(['red sox', 'white sox', 'blue jays']);

function capitalize(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function mascot(normalizedFullName: string): string {
  const tokens = normalizedFullName.split(' ').filter(Boolean);
  if (tokens.length < 2) {
    return tokens[0] ? capitalize(tokens[0]) : capitalize(normalizedFullName);
  }
  const lastTwo = tokens.slice(-2).join(' ');
  if (TWO_TOKEN_MASCOTS.has(lastTwo)) {
    return lastTwo.split(' ').map(capitalize).join(' ');
  }
  return capitalize(tokens[tokens.length - 1]);
}

export function mlbNickname(nameOrAbbrev: string): string {
  const upper = nameOrAbbrev.toUpperCase();
  const entry = Object.entries(MLB_FALLBACK_BY_NAME).find(([, v]) => v.team === upper);
  if (entry) return mascot(entry[0]);
  return mascot(normalizeTeamNameKey(nameOrAbbrev));
}

// MARK: - Card building

export function buildMLBCards(
  bundle: MLBTrendsSlateBundle,
  gameFilter: OutliersTrendsMatchupFilter,
  subject: OutliersTrendsSubject,
  visibleLimit: number = Number.MAX_SAFE_INTEGER,
): OutliersTrendsCard[] {
  if (subject !== 'all' && subject !== 'teams') return [];
  const games =
    gameFilter === 'all' ? bundle.games : bundle.games.filter((g) => g.id === gameFilter);
  const teamByAbbr = new Map(bundle.teams.map((t) => [t.teamAbbr, t]));
  const cards: OutliersTrendsCard[] = [];

  for (const game of games) {
    const ctx = mlbGameContext(game);
    const matchupLabel = gameLabel(game);
    const sides: Array<[string, string, string, string | null]> = [
      [game.homeAb, 'home', game.awayAb, ctx.homeFavDog],
      [game.awayAb, 'away', game.homeAb, ctx.awayFavDog],
    ];
    for (const [abbr, side, opp, favDog] of sides) {
      const team = teamByAbbr.get(abbr);
      if (!team) continue;
      for (const market of TEAM_MARKETS) {
        const card = buildTeamCard(team, game, ctx, side, opp, favDog, matchupLabel, market);
        if (card) cards.push(card);
      }
    }
  }

  cards.sort((a, b) => b.trendValue - a.trendValue || b.trendSampleN - a.trendSampleN);

  if (gameFilter === 'all') return cards.slice(0, visibleLimit);
  return cards;
}

function buildTeamCard(
  team: MLBTeamTrendRecord,
  game: OutliersTrendsGame,
  ctx: MLBGameContext,
  side: string,
  opponent: string,
  favDog: string | null,
  matchupLabel: string,
  market: string,
): OutliersTrendsCard | null {
  const dims = teamDimensionSpecs(side, favDog, ctx);
  const extraRows: OutliersTrendsCardRow[] = [];
  const h2h = headToHeadRow(team, opponent, market);
  if (h2h) extraRows.push(h2h);
  const lines = mlbBettingLines(market, game, team.teamAbbr);
  return buildSplitCard(
    `team-${team.teamAbbr}-${game.id}-${market}`,
    game.id,
    matchupLabel,
    mlbNickname(team.teamName ?? team.teamAbbr),
    team.teamAbbr,
    team.teamAbbr,
    market,
    team.splits,
    dims,
    lines,
    extraRows,
  );
}

function headToHeadRow(
  team: MLBTeamTrendRecord,
  opponent: string,
  market: string,
): OutliersTrendsCardRow | null {
  const record = matchupRecord(team.matchups, opponent);
  const cell = record?.markets[market];
  if (!cell) return null;
  return h2hRow(cell, market, opponent);
}

interface TrendDimensionSpec {
  key: string;
  displayContext: string;
}

function buildSplitCard(
  idPrefix: string,
  gameId: string,
  matchupLabel: string,
  subjectName: string,
  subjectDetail: string | null,
  teamAbbr: string,
  market: string,
  splits: TrendSplits,
  dimensions: TrendDimensionSpec[],
  bettingLines: OutliersTrendsBettingLine[],
  extraRows: OutliersTrendsCardRow[] = [],
): OutliersTrendsCard | null {
  const rows: OutliersTrendsCardRow[] = [];
  for (const dim of dimensions) {
    const row = extremeSplitRow(splits, market, dim.key, dim.displayContext);
    if (row) rows.push(row);
  }
  rows.push(...extraRows);
  if (rows.length === 0) return null;
  const strongest = rows.reduce((best, row) => {
    if (row.dominantPct !== best.dominantPct) {
      return row.dominantPct > best.dominantPct ? row : best;
    }
    return row.sampleN > best.sampleN ? row : best;
  });
  return {
    id: idPrefix,
    gameId,
    matchupLabel,
    subjectKind: 'team',
    subjectName,
    subjectDetail,
    teamAbbr,
    playerId: null,
    marketKey: market,
    betTypeLabel: mlbMarketLabel(market),
    trendValue: strongest.dominantPct,
    trendSampleN: strongest.sampleN,
    headshotUrl: null,
    bettingLines,
    rows,
    isPlayerOverflow: false,
  };
}

function teamDimensionSpecs(
  side: string,
  favDog: string | null,
  ctx: MLBGameContext,
): TrendDimensionSpec[] {
  const dims: TrendDimensionSpec[] = [
    { key: 'overall', displayContext: 'games' },
    { key: side, displayContext: side === 'home' ? 'Home' : 'Away' },
  ];
  if (favDog) {
    dims.push({
      key: favDog,
      displayContext: favDog === 'favorite' ? 'As Favorite' : 'As Underdog',
    });
  }
  dims.push({
    key: ctx.divisionScope,
    displayContext: ctx.divisionScope === 'division' ? 'Division' : 'Non-Division',
  });
  dims.push({
    key: ctx.dayNightScope,
    displayContext: ctx.dayNightScope === 'day' ? 'Day Games' : 'Night Games',
  });
  if (ctx.seriesDimension) {
    dims.push({ key: ctx.seriesDimension, displayContext: seriesDisplayLabel(ctx.seriesDimension) });
  }
  return dims;
}

function seriesDisplayLabel(key: string): string {
  switch (key) {
    case 'series_game_1':
      return 'Series G1';
    case 'series_game_2':
      return 'Series G2';
    case 'series_game_3':
      return 'Series G3';
    case 'series_game_4':
      return 'Series G4';
    default:
      return key
        .split('_')
        .map(capitalize)
        .join(' ');
  }
}

// MARK: - Extreme stats

interface TrendRowMetrics {
  count: number;
  displayPct: number;
  sortPct: number;
  hitSide: boolean;
  verb: string;
}

function isOverUnderMarket(market: string): boolean {
  return market === 'ou' || market === 'f5_ou';
}

function isRunLineMarket(market: string): boolean {
  return market === 'rl' || market === 'f5_rl';
}

function h2hCellMetrics(market: string, cell: TrendH2HCell): TrendRowMetrics | null {
  if (cell.n < 1) return null;
  const pct = cell.pct ?? (cell.n > 0 ? cell.h / cell.n : 0);
  const synthetic: TrendSplitCell = {
    h: cell.h,
    l: Math.max(0, cell.n - cell.h),
    p: 0,
    n: cell.n,
    pct,
  };
  return splitCellMetrics(market, synthetic, 1);
}

function splitCellMetrics(
  market: string,
  cell: TrendSplitCell,
  minSample = 2,
): TrendRowMetrics | null {
  if (cell.n < minSample) return null;
  if (isOverUnderMarket(market)) {
    const rate = cell.pct;
    const hitSide = rate >= 0.5;
    const count = hitSide ? cell.h : cell.l;
    return {
      count,
      displayPct: Math.max(rate, 1 - rate),
      sortPct: Math.max(rate, 1 - rate),
      hitSide,
      verb: hitSide ? 'Over' : 'Under',
    };
  }
  const dominant = Math.max(cell.pct, 1 - cell.pct);
  const hitSide = cell.pct >= 0.5;
  const count = hitSide ? cell.h : cell.l;
  const verb = isRunLineMarket(market)
    ? hitSide
      ? 'Covered'
      : "Didn't cover"
    : hitSide
      ? 'Won'
      : 'Lost';
  return { count, displayPct: dominant, sortPct: dominant, hitSide, verb };
}

function extremeSplitRow(
  splits: TrendSplits,
  market: string,
  dimension: string,
  displayContext: string,
): OutliersTrendsCardRow | null {
  const dimBlock = splits[market]?.[dimension];
  if (!dimBlock) return null;
  const windowKeys = Object.keys(dimBlock).sort(
    (a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0),
  );
  let best: { cell: TrendSplitCell; window: string; metrics: TrendRowMetrics } | null = null;
  for (const window of windowKeys) {
    const cell = dimBlock[window];
    if (!cell) continue;
    const metrics = splitCellMetrics(market, cell);
    if (!metrics) continue;
    if (
      !best ||
      metrics.sortPct > best.metrics.sortPct ||
      (metrics.sortPct === best.metrics.sortPct && cell.n > best.cell.n)
    ) {
      best = { cell, window, metrics };
    }
  }
  if (!best) return null;
  const pctText = Math.round(best.metrics.displayPct * 100);
  const text = `${best.metrics.verb} ${best.metrics.count} of last ${best.cell.n} ${displayContext} (${pctText}%)`;
  return {
    id: `${market}-${dimension}-${best.window}`,
    text,
    coverageNote: null,
    dominantPct: best.metrics.displayPct,
    sampleN: best.cell.n,
  };
}

function h2hRow(cell: TrendH2HCell, market: string, opponent: string): OutliersTrendsCardRow | null {
  const metrics = h2hCellMetrics(market, cell);
  if (!metrics) return null;
  const pctText = Math.round(metrics.displayPct * 100);
  const oppLabel = opponent.toUpperCase();
  const text = `${metrics.verb} ${metrics.count} of last ${cell.n} vs ${oppLabel} (${pctText}%)`;
  const note = cell.n < 3 ? `Small sample (${cell.n} game${cell.n === 1 ? '' : 's'})` : null;
  return {
    id: `${market}-h2h-${oppLabel}`,
    text,
    coverageNote: note,
    dominantPct: metrics.displayPct,
    sampleN: cell.n,
  };
}

export function mlbMarketLabel(market: string): string {
  switch (market) {
    case 'ml':
      return 'Moneyline';
    case 'rl':
      return 'Run Line';
    case 'ou':
      return 'Total';
    case 'f5_ml':
      return '1st 5 Moneyline';
    case 'f5_rl':
      return '1st 5 Run Line';
    case 'f5_ou':
      return '1st 5 Total';
    default:
      return market
        .split('_')
        .map(capitalize)
        .join(' ');
  }
}

// MARK: - Betting lines from slate odds

export function mlbBettingLines(
  market: string,
  game: OutliersTrendsGame,
  teamAbbr: string,
): OutliersTrendsBettingLine[] {
  const ctx = game.mlbContext;
  if (!ctx) return [];
  const isHome = teamAbbr.toUpperCase() === game.homeAb.toUpperCase();
  const prefix = `${teamAbbr}-${game.id}-${market}`;

  const line = (
    id: string,
    label: string,
    lineText: string,
    oddsText: string | null,
    withTeam = false,
  ): OutliersTrendsBettingLine => ({
    id,
    label,
    lineText,
    oddsText,
    bookName: null,
    bookLogoUrl: null,
    teamAbbr: withTeam ? teamAbbr : null,
  });

  switch (market) {
    case 'ml': {
      const odds = isHome ? ctx.homeMl : ctx.awayMl;
      if (odds === null) return [];
      return [line(`${prefix}-ml`, 'Moneyline', 'ML', formatAmerican(odds), true)];
    }
    case 'rl': {
      const spread = isHome ? ctx.homeSpread : ctx.awaySpread;
      const juice = isHome ? ctx.homeSpreadOdds : ctx.awaySpreadOdds;
      if (spread === null) return [];
      return [
        line(
          `${prefix}-rl`,
          'Run Line',
          formatSignedSpread(spread),
          juice !== null ? formatAmerican(juice) : null,
          true,
        ),
      ];
    }
    case 'ou': {
      if (ctx.totalLine === null) return [];
      const totalText = formatLine(ctx.totalLine);
      const lines: OutliersTrendsBettingLine[] = [];
      if (ctx.totalOverOdds !== null) {
        lines.push(line(`${prefix}-over`, 'Over', `Over ${totalText}`, formatAmerican(ctx.totalOverOdds)));
      }
      if (ctx.totalUnderOdds !== null) {
        lines.push(line(`${prefix}-under`, 'Under', `Under ${totalText}`, formatAmerican(ctx.totalUnderOdds)));
      }
      if (lines.length === 0) {
        lines.push(line(`${prefix}-total`, 'Total', totalText, null));
      }
      return lines;
    }
    case 'f5_ml': {
      const odds = isHome ? ctx.f5HomeMl : ctx.f5AwayMl;
      if (odds === null) return [];
      return [line(`${prefix}-f5-ml`, '1st 5 Moneyline', '1st 5 ML', formatAmerican(odds), true)];
    }
    case 'f5_rl': {
      const spread = isHome ? ctx.f5HomeSpread : ctx.f5AwaySpread;
      const juice = isHome ? ctx.f5HomeSpreadOdds : ctx.f5AwaySpreadOdds;
      if (spread === null) return [];
      return [
        line(
          `${prefix}-f5-rl`,
          '1st 5 Run Line',
          formatSignedSpread(spread),
          juice !== null ? formatAmerican(juice) : null,
          true,
        ),
      ];
    }
    case 'f5_ou': {
      if (ctx.f5TotalLine === null) return [];
      const totalText = formatLine(ctx.f5TotalLine);
      const lines: OutliersTrendsBettingLine[] = [];
      if (ctx.f5TotalOverOdds !== null) {
        lines.push(
          line(`${prefix}-f5-over`, 'Over', `Over ${totalText}`, formatAmerican(ctx.f5TotalOverOdds)),
        );
      }
      if (ctx.f5TotalUnderOdds !== null) {
        lines.push(
          line(`${prefix}-f5-under`, 'Under', `Under ${totalText}`, formatAmerican(ctx.f5TotalUnderOdds)),
        );
      }
      if (lines.length === 0) {
        lines.push(line(`${prefix}-f5-total`, '1st 5 Total', totalText, null));
      }
      return lines;
    }
    default:
      return [];
  }
}

function formatSignedSpread(value: number): string {
  const body = Number.isInteger(value) ? String(Math.trunc(Math.abs(value))) : Math.abs(value).toFixed(1);
  return value > 0 ? `+${body}` : value < 0 ? `-${body}` : body;
}

function formatLine(value: number): string {
  return Number.isInteger(value) ? String(Math.trunc(value)) : value.toFixed(1);
}

function formatAmerican(value: number): string {
  const iv = Math.round(value);
  return iv > 0 ? `+${iv}` : String(iv);
}
