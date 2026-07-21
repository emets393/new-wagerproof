import type { MlbToolDateGroup, MlbToolFeedItem } from './types';

/** Free-text match over both clubs' names and abbreviations. */
export function searchMlbToolGames<T extends MlbToolFeedItem>(games: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return games;
  return games.filter((g) =>
    [g.away.name, g.away.abbrev, g.home.name, g.home.abbrev]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

/** `official_date` (YYYY-MM-DD) → "Today" / "Tomorrow" / "Mon, May 19". */
export function mlbToolDateLabel(date: string): string {
  if (!date) return 'Date TBD';
  const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  if (date === todayEt) return 'Today';

  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  const tomorrow = new Date(`${todayEt}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (parsed.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Chronological date headers. Both tools' sources can span more than one
 * `official_date` (late doubleheaders roll past midnight ET), which is why the
 * legacy pages grouped too.
 */
export function groupMlbToolGamesByDate<T extends MlbToolFeedItem>(
  games: T[],
): MlbToolDateGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const game of games) {
    const key = game.gameDate || '';
    const list = map.get(key) ?? [];
    list.push(game);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, label: mlbToolDateLabel(date), games: list }));
}

/** First pitch as a sortable key; games with no posted time sort last that day. */
export function mlbToolTimeSortKey(date: string, time: string | null): string {
  if (time) {
    const parsed = new Date(time);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return `${date}T99`;
}

/** ISO timestamp → "7:05 PM ET". */
export function formatMlbToolTime(time: string | null): string {
  if (!time) return 'TBD';
  const parsed = new Date(time);
  if (Number.isNaN(parsed.getTime())) return 'TBD';
  return `${parsed.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} ET`;
}
