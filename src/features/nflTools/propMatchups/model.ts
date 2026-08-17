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
