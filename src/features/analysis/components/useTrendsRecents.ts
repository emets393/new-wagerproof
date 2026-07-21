import { useCallback, useEffect, useState } from 'react';
import type { Sport } from './adapters/types';

const MAX_RECENTS = 8;
const keyFor = (sport: Sport) => `wp:trends:recents:${sport}`;

/**
 * Per-sport recent chat queries in localStorage. Most-recent-first, max 8, de-duped
 * case-insensitively (a re-add drops the prior copy). Mirrors iOS `ha_recent_queries_<sport>`.
 */
export function useTrendsRecents(sport: Sport) {
  const [recents, setRecents] = useState<string[]>([]);

  const read = useCallback((s: Sport): string[] => {
    try {
      const raw = localStorage.getItem(keyFor(s));
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }, []);

  // read on mount, re-read on sport switch
  useEffect(() => {
    setRecents(read(sport));
  }, [sport, read]);

  const persist = useCallback(
    (next: string[]) => {
      try {
        localStorage.setItem(keyFor(sport), JSON.stringify(next));
      } catch {
        /* ignore quota / private-mode failures */
      }
      return next;
    },
    [sport],
  );

  const push = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) return;
      setRecents((prev) =>
        persist([q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENTS)),
      );
    },
    [persist],
  );

  const remove = useCallback(
    (query: string) => setRecents((prev) => persist(prev.filter((x) => x !== query))),
    [persist],
  );

  const clear = useCallback(() => setRecents(() => persist([])), [persist]);

  return { recents, push, remove, clear };
}
