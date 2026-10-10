import type { MlbToolFeedItem, MlbToolTeam } from '@/features/mlbTools/shared/types';
import type { NflPropPlayerPage, PropHighlight } from '@/features/propBreakdown/types';
import { getNFLTeamColors, getNFLTeamLogo } from '@/features/games/api/nflGames';
import { lookupNflTeam } from '@/utils/nflTeamAssets';

export interface NflPropGameFeedItem extends MlbToolFeedItem {
  gameLabel: string;
  kickoff: string | null;
  homePlayers: NflPropPlayerPage[];
  awayPlayers: NflPropPlayerPage[];
  /** Best edge highlight across both sides (for the feed card teaser). */
  topHighlight: { player: NflPropPlayerPage; highlight: PropHighlight } | null;
  playerCount: number;
  season: number;
  week: number;
}

function teamRef(abbr: string): MlbToolTeam {
  const meta = lookupNflTeam(abbr);
  const colors = getNFLTeamColors(abbr);
  return {
    name: meta?.name ?? abbr,
    abbrev: abbr,
    logoUrl: getNFLTeamLogo(abbr),
    colors,
  };
}

function kickoffLabel(iso: string | null | undefined): string {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

function dateKey(iso: string | null | undefined): string {
  if (!iso) return '2099-01-01';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '2099-01-01';
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export interface LeanStrength {
  direction: 'up' | 'down';
  count: number;
}

/** Highlights that all point the same way. A mix of up and down is not a lean. */
export function leanStrength(highlights: PropHighlight[] | null | undefined): LeanStrength | null {
  let ups = 0;
  let downs = 0;
  for (const highlight of highlights ?? []) {
    if (highlight?.direction === 'up') ups += 1;
    else if (highlight?.direction === 'down') downs += 1;
  }
  if (ups > 0 && downs > 0) return null;
  if (ups > 0) return { direction: 'up', count: ups };
  if (downs > 0) return { direction: 'down', count: downs };
  return null;
}

/** Lowest board rank per player. Missing ranks sort after numbered spotlight picks, still ahead of everyone else. */
export function spotlightRankMap(
  picks: readonly { player_id: string; board_rank: number | null }[],
): Map<string, number> {
  const ranks = new Map<string, number>();
  for (const pick of picks) {
    const rank = typeof pick.board_rank === 'number' ? pick.board_rank : Number.POSITIVE_INFINITY;
    const previous = ranks.get(pick.player_id);
    if (previous == null || rank < previous) ranks.set(pick.player_id, rank);
  }
  return ranks;
}

/** The spotlight market with the best board rank for each player. */
export function bestSpotlightMarketByPlayer(
  picks: readonly { player_id: string; board_rank: number | null; market: string }[],
): Map<string, string> {
  const markets = new Map<string, string>();
  const ranks = new Map<string, number>();
  for (const pick of picks) {
    const rank = typeof pick.board_rank === 'number' ? pick.board_rank : Number.POSITIVE_INFINITY;
    const previous = ranks.get(pick.player_id);
    if (previous == null || rank < previous) {
      ranks.set(pick.player_id, rank);
      markets.set(pick.player_id, pick.market);
    }
  }
  return markets;
}

export const EMPTY_SPOTLIGHT_RANK: ReadonlyMap<string, number> = new Map();
export const EMPTY_LEAN_IDS: ReadonlySet<string> = new Set();

export type NflPropList = 'spotlight' | 'leans' | 'all' | `g:${string}`;

function listBand(playerId: string, spotlightRank: ReadonlyMap<string, number>, leanIds: ReadonlySet<string>): number {
  if (spotlightRank.has(playerId)) return 0;
  if (leanIds.has(playerId)) return 1;
  return 2;
}

/**
 * Spotlight, then lean-tagged players, then everyone else.
 * Alphabetical inside each group. Board rank and lean strength are not an order.
 */
export function compareNflPropPlayers(
  a: NflPropPlayerPage,
  b: NflPropPlayerPage,
  spotlightRank: ReadonlyMap<string, number>,
  leanIds: ReadonlySet<string> = EMPTY_LEAN_IDS,
): number {
  const band = listBand(a.player_id, spotlightRank, leanIds) - listBand(b.player_id, spotlightRank, leanIds);
  if (band !== 0) return band;
  return a.player_name.localeCompare(b.player_name);
}

export function sortNflPropPlayers(
  players: readonly NflPropPlayerPage[],
  spotlightRank: ReadonlyMap<string, number> = EMPTY_SPOTLIGHT_RANK,
  leanIds: ReadonlySet<string> = EMPTY_LEAN_IDS,
): NflPropPlayerPage[] {
  return [...players].sort((a, b) => compareNflPropPlayers(a, b, spotlightRank, leanIds));
}

export type NflPropPlayerFocus = NflPropList;

/**
 * The left rail. A search ignores the active filter and looks across every player.
 * Matchup rails are `g:<game id>` built from the week's rows.
 */
export function browseNflPropPlayers(
  players: readonly NflPropPlayerPage[],
  focus: NflPropPlayerFocus,
  query: string,
  spotlightRank: ReadonlyMap<string, number>,
  teamCity: (abbr: string) => string | null = () => null,
  leanIds: ReadonlySet<string> = EMPTY_LEAN_IDS,
  gameIdByPlayer: ReadonlyMap<string, string> = new Map(),
): NflPropPlayerPage[] {
  const needle = query.trim().toLowerCase();
  const filtered = players.filter((player) => {
    if (needle) {
      const city = teamCity(player.team)?.toLowerCase() ?? '';
      return (
        player.player_name.toLowerCase().includes(needle) ||
        player.team.toLowerCase().includes(needle) ||
        city.includes(needle)
      );
    }
    if (focus === 'spotlight') return spotlightRank.has(player.player_id);
    if (focus === 'leans') return leanIds.has(player.player_id);
    if (focus === 'all') return true;
    return gameIdByPlayer.get(player.player_id) === focus.slice(2);
  });
  return sortNflPropPlayers(filtered, spotlightRank, leanIds);
}

function pickTopHighlight(
  players: NflPropPlayerPage[]
): { player: NflPropPlayerPage; highlight: PropHighlight } | null {
  let best: { player: NflPropPlayerPage; highlight: PropHighlight } | null = null;
  for (const p of players) {
    for (const h of p.highlights ?? []) {
      if (!h?.text) continue;
      // Prefer scheme/look_hit ups, then any up, then any.
      const score =
        (h.direction === 'up' ? 2 : 0) +
        (h.kind === 'scheme' || h.kind === 'look_hit' ? 1 : 0);
      const bestScore = best
        ? (best.highlight.direction === 'up' ? 2 : 0) +
          (best.highlight.kind === 'scheme' || best.highlight.kind === 'look_hit' ? 1 : 0)
        : -1;
      if (!best || score > bestScore) best = { player: p, highlight: h };
    }
  }
  return best;
}

/**
 * Group flat player-page rows into one feed item per game_label.
 * Id = `${away}-${home}-${season}-${week}` for stable deep links.
 */
export function buildNflPropGameFeed(pages: NflPropPlayerPage[]): NflPropGameFeedItem[] {
  const byGame = new Map<
    string,
    {
      label: string;
      kickoff: string | null;
      homeAbbr: string;
      awayAbbr: string;
      home: NflPropPlayerPage[];
      away: NflPropPlayerPage[];
      season: number;
      week: number;
    }
  >();

  for (const p of pages) {
    const homeAbbr = p.is_home ? p.team : p.opponent;
    const awayAbbr = p.is_home ? p.opponent : p.team;
    const label = p.game_label || `${awayAbbr} @ ${homeAbbr}`;
    const key = `${awayAbbr}@${homeAbbr}@${p.season}@${p.week}`;
    let g = byGame.get(key);
    if (!g) {
      g = {
        label,
        kickoff: p.kickoff,
        homeAbbr,
        awayAbbr,
        home: [],
        away: [],
        season: p.season,
        week: p.week,
      };
      byGame.set(key, g);
    }
    if (p.is_home) g.home.push(p);
    else g.away.push(p);
    if (p.kickoff && (!g.kickoff || p.kickoff < g.kickoff)) g.kickoff = p.kickoff;
  }

  const items: NflPropGameFeedItem[] = [];
  for (const [key, g] of byGame) {
    const sortName = (a: NflPropPlayerPage, b: NflPropPlayerPage) =>
      a.player_name.localeCompare(b.player_name);
    // POSTED-LINE GATE (owner 2026-08-17): once a game's prop board starts posting,
    // list ONLY players with at least one posted market (any market counts, incl.
    // anytime-TD). Before any props post for the game, keep the full roster preview —
    // the page stays browsable pre-lines and self-tightens per game as books post.
    const hasPosted = (p: NflPropPlayerPage) =>
      p.markets.some((m) => m.status === 'posted');
    if ([...g.home, ...g.away].some(hasPosted)) {
      g.home = g.home.filter(hasPosted);
      g.away = g.away.filter(hasPosted);
    }
    g.home.sort(sortName);
    g.away.sort(sortName);
    const all = [...g.home, ...g.away];
    const id = key.replace(/@/g, '-');
    items.push({
      id,
      gamePk: 0,
      away: teamRef(g.awayAbbr),
      home: teamRef(g.homeAbbr),
      gameDate: dateKey(g.kickoff),
      gameTimeLabel: kickoffLabel(g.kickoff),
      timeSortKey: g.kickoff || g.label,
      gameLabel: g.label,
      kickoff: g.kickoff,
      homePlayers: g.home,
      awayPlayers: g.away,
      topHighlight: pickTopHighlight(all),
      playerCount: all.length,
      season: g.season,
      week: g.week,
    });
  }

  items.sort((a, b) => a.timeSortKey.localeCompare(b.timeSortKey) || a.id.localeCompare(b.id));
  return items;
}

export function shortPlayerName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}
