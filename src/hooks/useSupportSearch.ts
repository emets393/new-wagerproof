import { useState, useEffect, useRef, useCallback } from 'react';
import type { SearchIndexEntry } from '@/types/support';
import { loadSearchIndex, normalizeText } from '@/lib/support';

export function useSupportSearch() {
  const [index, setIndex] = useState<SearchIndexEntry[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchIndexEntry[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadSearchIndex().then(setIndex).catch(() => setIndex([]));
  }, []);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const normalized = normalizeText(q);
      const terms = normalized.split(/\s+/).filter(Boolean);

      const scored = index
        .map(entry => {
          const titleNorm = normalizeText(entry.title);
          const descNorm = normalizeText(entry.description);
          const keywordsNorm = entry.keywords.map(normalizeText);

          let score = 0;
          for (const term of terms) {
            if (titleNorm.includes(term)) score += 10;
            if (descNorm.includes(term)) score += 5;
            if (keywordsNorm.some(k => k.includes(term))) score += 3;
          }
          return { entry, score };
        })
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(s => s.entry);

      setResults(scored);
    }, 200);
  }, [index]);

  return { query, search, results };
}
