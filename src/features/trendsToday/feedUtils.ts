import type { TrendsFeedItem, TrendsSortKey, TrendsSportFilter } from './types';

function todayInEt(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/** "Sat, Jul 5" style header, with Today/Tomorrow resolved against ET. */
export function formatDateGroupLabel(dateString: string): string {
  if (!dateString) return 'Scheduled';
  try {
    const today = todayInEt();
    if (dateString === today) return 'Today';

    const [ty, tm, td] = today.split('-').map(Number);
    const tomorrow = new Date(ty, tm - 1, td + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    if (dateString === tomorrowStr) return 'Tomorrow';

    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function matchesSearch(item: TrendsFeedItem, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return [item.away.name, item.away.abbrev, item.home.name, item.home.abbrev].some((v) =>
    String(v ?? '').toLowerCase().includes(q),
  );
}

/**
 * Filters by league, then applies the sort. The consensus/dominance sorts are
 * ported from the legacy pages and are strongest-first; time is earliest-first,
 * with games missing a tipoff pushed to the end (their sort key ends in a
 * sentinel). Search is applied separately in the panel so typing never changes
 * which game is auto-selected.
 */
export function selectTrendsGames(
  games: TrendsFeedItem[],
  sport: TrendsSportFilter,
  sortKey: TrendsSortKey,
): TrendsFeedItem[] {
  const filtered = games.filter((g) => sport === 'all' || g.sport === sport);

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sortKey === 'ou') return b.scores.ouConsensus - a.scores.ouConsensus;
    if (sortKey === 'side') return b.scores.sideDominance - a.scores.sideDominance;
    return a.timeSortKey.localeCompare(b.timeSortKey);
  });
  return sorted;
}

/** Team-name / abbreviation search over an already-ordered list. */
export function searchTrendsGames(
  games: TrendsFeedItem[],
  searchText: string,
): TrendsFeedItem[] {
  if (!searchText.trim()) return games;
  return games.filter((g) => matchesSearch(g, searchText));
}

/**
 * Date headers for the feed. Only meaningful under the time sort — the value
 * sorts interleave dates, so the panel skips grouping for those.
 */
export function groupTrendsByDate(
  games: TrendsFeedItem[],
): { date: string; label: string; games: TrendsFeedItem[] }[] {
  const groups: { date: string; label: string; games: TrendsFeedItem[] }[] = [];
  for (const game of games) {
    const last = groups[groups.length - 1];
    if (last && last.date === game.gameDate) {
      last.games.push(game);
    } else {
      groups.push({
        date: game.gameDate,
        label: formatDateGroupLabel(game.gameDate),
        games: [game],
      });
    }
  }
  return groups;
}
