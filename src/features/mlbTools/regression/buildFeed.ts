import type { MLBRegressionReport } from '@/hooks/useMLBRegressionReport';
import type { MLBSeriesSignal } from '@/hooks/useMLBSeriesSignals';
import type { PerfectStormTier } from '@/hooks/useMLBPerfectStormRecords';
import {
  MLB_FALLBACK_BY_NAME,
  abbrevFromTeamNameOnly,
  espnMlb500LogoUrlFromAbbrev,
  normalizeTeamNameKey,
} from '@/utils/mlbTeamLogos';
import { getMLBTeamColors } from '@/utils/teamColors';
import {
  TIER_RANK,
  type RegressionBatting,
  type RegressionFilter,
  type RegressionGame,
  type RegressionPitcher,
  type RegressionSortKey,
  type RegressionTeam,
} from './types';

/**
 * Report payload → per-game feed.
 *
 * Only three of the report's collections carry a `game_pk` (picks, weather
 * flags, series signals); everything else is keyed on a team name. So games are
 * seeded from those three and the team-anchored rows are joined on by
 * abbreviation, which is stable across the report's inconsistent naming
 * ("Athletics" vs "Las Vegas Athletics").
 */

/** Report team name → canonical abbreviation, via the shared fallback table. */
export function regressionTeamAbbr(name: string | null | undefined): string {
  if (!name) return '';
  const key = normalizeTeamNameKey(name);
  const fb = MLB_FALLBACK_BY_NAME[key];
  if (fb?.team) return fb.team;
  return abbrevFromTeamNameOnly(name);
}

export function buildTeam(name: string): RegressionTeam {
  const abbrev = regressionTeamAbbr(name) || 'MLB';
  const key = normalizeTeamNameKey(name);
  const logoUrl = MLB_FALLBACK_BY_NAME[key]?.logo_url ?? espnMlb500LogoUrlFromAbbrev(abbrev);
  return { name, abbrev, logoUrl, colors: getMLBTeamColors(abbrev) };
}

/** "Away Team @ Home Team" — the shape every matchup string in the report uses. */
function parseMatchup(matchup: string | null | undefined): { away: string; home: string } | null {
  if (!matchup) return null;
  const parts = matchup.split('@');
  if (parts.length !== 2) return null;
  const away = parts[0].trim();
  const home = parts[1].trim();
  if (!away || !home) return null;
  return { away, home };
}

export function formatEtTime(iso: string | null | undefined): string {
  if (!iso) return 'Time TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Time TBD';
  return `${d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })} ET`;
}

type Draft = RegressionGame;

function blankGame(gamePk: number, awayName: string, homeName: string): Draft {
  return {
    id: String(gamePk),
    gamePk,
    away: buildTeam(awayName),
    home: buildTeam(homeName),
    gameTimeEt: null,
    gameTimeLabel: 'Time TBD',
    // Sentinel sorts timeless games to the end without a special-case comparator.
    timeSortKey: '~',
    isDoubleheader: false,
    gameNumber: 1,
    venue: null,
    picks: [],
    topTier: null,
    pitchers: [],
    batting: [],
    bullpens: [],
    signals: [],
    weather: null,
    lrSplits: [],
    signalCount: 0,
  };
}

export function buildRegressionFeed(
  report: MLBRegressionReport | null | undefined,
  seriesSignals: MLBSeriesSignal[],
): RegressionGame[] {
  if (!report) return [];
  const byPk = new Map<number, Draft>();

  const ensure = (gamePk: number, awayName: string, homeName: string): Draft => {
    const existing = byPk.get(gamePk);
    if (existing) return existing;
    const draft = blankGame(gamePk, awayName, homeName);
    byPk.set(gamePk, draft);
    return draft;
  };

  // 1. Picks — the richest seed: real team names, first pitch, doubleheader flags.
  for (const pick of report.suggested_picks ?? []) {
    if (!Number.isFinite(pick.game_pk)) continue;
    const game = ensure(pick.game_pk, pick.away_team, pick.home_team);
    game.picks.push(pick);
    if (pick.game_time_et) {
      game.gameTimeEt = pick.game_time_et;
      game.gameTimeLabel = formatEtTime(pick.game_time_et);
      game.timeSortKey = pick.game_time_et;
    }
    if (pick.game_number) game.gameNumber = pick.game_number;
    if (pick.is_doubleheader || (pick.game_number ?? 1) >= 2) game.isDoubleheader = true;
  }

  // 2. Weather/park flags — cover games the pick engine passed on.
  for (const flag of report.weather_park_flags ?? []) {
    const teams = parseMatchup(flag.matchup);
    if (!Number.isFinite(flag.game_pk) || !teams) continue;
    const game = ensure(flag.game_pk, teams.away, teams.home);
    game.weather = flag;
    if (flag.venue) game.venue = flag.venue;
  }

  // 3. Series signals — a live view, not part of the report ETL, so a game can
  //    appear here and nowhere else.
  for (const signal of seriesSignals) {
    const teams = parseMatchup(signal.matchup);
    if (!Number.isFinite(signal.game_pk) || !teams) continue;
    const game = ensure(signal.game_pk, teams.away, teams.home);
    game.signals.push(signal);
  }

  // Index both sides of every game so the team-anchored rows can be attached.
  // A doubleheader has two entries per abbreviation and the rows carry no
  // game_pk, so both games legitimately receive the same team-level signal.
  const byAbbrev = new Map<string, Draft[]>();
  for (const game of byPk.values()) {
    for (const abbrev of [game.away.abbrev, game.home.abbrev]) {
      const list = byAbbrev.get(abbrev);
      if (list) list.push(game);
      else byAbbrev.set(abbrev, [game]);
    }
  }
  const forTeam = (name: string | null | undefined): Draft[] =>
    byAbbrev.get(regressionTeamAbbr(name)) ?? [];

  for (const [direction, rows] of [
    ['negative', report.pitcher_negative_regression ?? []],
    ['positive', report.pitcher_positive_regression ?? []],
  ] as const) {
    for (const row of rows) {
      const entry: RegressionPitcher = { ...row, direction };
      for (const game of forTeam(row.team_name)) game.pitchers.push(entry);
    }
  }

  for (const [direction, rows] of [
    ['heat', report.batting_heat_up ?? []],
    ['cool', report.batting_cool_down ?? []],
  ] as const) {
    for (const row of rows) {
      const entry: RegressionBatting = { ...row, direction };
      for (const game of forTeam(row.team_name)) game.batting.push(entry);
    }
  }

  for (const row of report.bullpen_fatigue ?? []) {
    for (const game of forTeam(row.team_name)) game.bullpens.push(row);
  }

  for (const row of report.lr_splits_today ?? []) {
    for (const game of forTeam(row.team_name)) game.lrSplits.push(row);
  }

  for (const game of byPk.values()) {
    game.topTier = strongestTier(game.picks.map((p) => p.perfect_storm_tier ?? null));
    game.signalCount =
      game.pitchers.length +
      game.batting.length +
      game.bullpens.length +
      game.signals.length +
      (game.weather ? 1 : 0);
  }

  return [...byPk.values()];
}

function strongestTier(tiers: (PerfectStormTier | null)[]): PerfectStormTier | null {
  let best: PerfectStormTier | null = null;
  for (const tier of tiers) {
    if (!tier) continue;
    if (!best || TIER_RANK[tier] > TIER_RANK[best]) best = tier;
  }
  return best;
}

/** Filter, then sort. Search is applied separately so typing can't move the selection. */
export function selectRegressionGames(
  games: RegressionGame[],
  filter: RegressionFilter,
  sortKey: RegressionSortKey,
): RegressionGame[] {
  const filtered = filter === 'picks' ? games.filter((g) => g.picks.length > 0) : games;
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sortKey === 'tier') {
      const diff = tierScore(b) - tierScore(a);
      if (diff !== 0) return diff;
      return a.timeSortKey.localeCompare(b.timeSortKey);
    }
    if (sortKey === 'signals') {
      const diff = b.signalCount - a.signalCount;
      if (diff !== 0) return diff;
      return a.timeSortKey.localeCompare(b.timeSortKey);
    }
    return a.timeSortKey.localeCompare(b.timeSortKey);
  });
  return sorted;
}

// Conviction first, pick count as the tiebreak: two Hammers beat one.
function tierScore(game: RegressionGame): number {
  const tier = game.topTier ? TIER_RANK[game.topTier] : 0;
  return tier * 100 + game.picks.length;
}

export function searchRegressionGames(
  games: RegressionGame[],
  searchText: string,
): RegressionGame[] {
  const q = searchText.trim().toLowerCase();
  if (!q) return games;
  return games.filter((g) =>
    [g.away.name, g.away.abbrev, g.home.name, g.home.abbrev].some((v) =>
      String(v ?? '').toLowerCase().includes(q),
    ),
  );
}
