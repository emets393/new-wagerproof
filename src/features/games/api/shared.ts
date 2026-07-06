import { getTodayInET } from '@/utils/dateUtils';
import type { GameFeedItem, GamesSortKey } from '../types';

export const formatMoneyline = (ml: number | null): string => {
  if (ml === null || ml === undefined) return '-';
  if (ml > 0) return `+${ml}`;
  return ml.toString();
};

export const formatSpread = (spread: number | null): string => {
  if (spread === null || spread === undefined) return '-';
  if (spread > 0) return `+${spread}`;
  return spread.toString();
};

export const roundToNearestHalf = (value: number): number => Math.round(value * 2) / 2;

/** Displayed probability = max(p, 1-p), matching the legacy pages. */
export const getDisplayedProb = (p: number | null): number | null => {
  if (p === null || p === undefined) return null;
  return p >= 0.5 ? p : 1 - p;
};

/** "Sat, Jul 5" style header label; Today/Tomorrow resolved against ET. */
export const formatDateGroupLabel = (dateString: string): string => {
  try {
    const today = getTodayInET();
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
};

export const isGameCurrentOrFuture = (item: GameFeedItem): boolean => {
  if (!item.gameDate) return true;
  return item.gameDate >= getTodayInET();
};

const displayedEdge = (val: number | null): number => {
  if (val === null || val === undefined || isNaN(Number(val))) return -Infinity;
  return roundToNearestHalf(Math.abs(Number(val)));
};

/**
 * Port of each legacy page's getSortedPredictions(): search filter, then
 * current/future games (chosen sort) followed by past games newest-first.
 */
export function sortGames<T extends GameFeedItem>(
  games: T[],
  sortKey: GamesSortKey,
  ascending: boolean,
  searchText: string
): T[] {
  let list = games;
  if (searchText.trim()) {
    const search = searchText.toLowerCase();
    list = list.filter(
      (g) =>
        g.homeTeam.name.toLowerCase().includes(search) ||
        g.awayTeam.name.toLowerCase().includes(search)
    );
  }

  const currentGames = list.filter(isGameCurrentOrFuture);
  const pastGames = list.filter((g) => !isGameCurrentOrFuture(g));

  const byDateTime = (a: T, b: T) => {
    const dateComparison = (a.gameDate || '').localeCompare(b.gameDate || '');
    if (dateComparison !== 0) return dateComparison;
    return (a.timeSortKey || '').localeCompare(b.timeSortKey || '');
  };

  let sortedCurrent: T[];
  if (sortKey === 'time') {
    sortedCurrent = [...currentGames].sort(byDateTime);
    if (ascending) sortedCurrent.reverse();
  } else {
    const score = (g: T): number => {
      if (sortKey === 'ml') return getDisplayedProb(g.edges.mlProb) ?? -1;
      if (sortKey === 'spread') return displayedEdge(g.edges.spreadEdge);
      return displayedEdge(g.edges.totalEdge);
    };
    sortedCurrent = [...currentGames].sort((a, b) => {
      const sb = score(b) - score(a);
      if (sb !== 0) return sb;
      return byDateTime(a, b);
    });
    if (ascending) sortedCurrent.reverse();
  }

  const sortedPast = [...pastGames].sort((a, b) => {
    const dateComparison = (b.gameDate || '').localeCompare(a.gameDate || '');
    if (dateComparison !== 0) return dateComparison;
    return (b.timeSortKey || '').localeCompare(a.timeSortKey || '');
  });

  return [...sortedCurrent, ...sortedPast];
}

/** Group already-sorted games by date, preserving order. */
export function groupGamesByDate<T extends GameFeedItem>(
  games: T[]
): { date: string; label: string; games: T[] }[] {
  const groups: { date: string; label: string; games: T[] }[] = [];
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
