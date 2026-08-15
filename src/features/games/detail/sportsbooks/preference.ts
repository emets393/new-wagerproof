import { useCallback, useEffect, useState } from 'react';
import {
  SPORTSBOOK_PREF_KEY,
  decodePreferredBooks,
  encodePreferredBooks,
} from './quotes';

function readStored(): Set<string> {
  try {
    return decodePreferredBooks(localStorage.getItem(SPORTSBOOK_PREF_KEY));
  } catch {
    return new Set();
  }
}

function writeStored(keys: Set<string>): void {
  try {
    const encoded = encodePreferredBooks(keys);
    if (encoded) localStorage.setItem(SPORTSBOOK_PREF_KEY, encoded);
    else localStorage.removeItem(SPORTSBOOK_PREF_KEY);
    window.dispatchEvent(new Event('sportsbook-preference-change'));
  } catch {
    /* quota / private mode */
  }
}

/** The books the user holds. Empty set = best number from any book. */
export function useSportsbookPreference() {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(readStored);

  useEffect(() => {
    const sync = () => setSelectedKeys(readStored());
    window.addEventListener('storage', sync);
    window.addEventListener('sportsbook-preference-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('sportsbook-preference-change', sync);
    };
  }, []);

  const toggleBook = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      writeStored(next);
      return next;
    });
  }, []);

  const clearBooks = useCallback(() => {
    const empty = new Set<string>();
    writeStored(empty);
    setSelectedKeys(empty);
  }, []);

  return { selectedKeys, toggleBook, clearBooks };
}
