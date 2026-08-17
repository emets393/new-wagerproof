import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  SPORTSBOOK_PREF_KEY,
  decodePreferredBookList,
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

async function pullFromProfile(userId: string): Promise<
  { kind: 'error' } | { kind: 'unset' } | { kind: 'set'; keys: Set<string> }
> {
  const { data, error } = await supabase
    .from('profiles')
    .select('preferred_sportsbooks')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { kind: 'error' };
  if (data?.preferred_sportsbooks == null) return { kind: 'unset' };
  return { kind: 'set', keys: decodePreferredBookList(data.preferred_sportsbooks) };
}

async function pushToProfile(userId: string, keys: Set<string>): Promise<void> {
  await supabase
    .from('profiles')
    .update({ preferred_sportsbooks: [...keys].sort() })
    .eq('user_id', userId);
}

/** The books the user holds. Empty set = best number from any book. */
export function useSportsbookPreference() {
  const { user, loading } = useAuth();
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

  useEffect(() => {
    if (loading) return;
    if (!user) {
      writeStored(new Set());
      setSelectedKeys(new Set());
      return;
    }

    let cancelled = false;
    void (async () => {
      const remote = await pullFromProfile(user.id);
      if (cancelled) return;
      if (remote.kind === 'error') return;
      if (remote.kind === 'set') {
        writeStored(remote.keys);
        setSelectedKeys(remote.keys);
        return;
      }
      const local = readStored();
      if (local.size > 0) {
        await pushToProfile(user.id, local);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading]);

  const persist = useCallback(
    (next: Set<string>) => {
      writeStored(next);
      if (user) void pushToProfile(user.id, next);
    },
    [user],
  );

  const toggleBook = useCallback(
    (key: string) => {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearBooks = useCallback(() => {
    const empty = new Set<string>();
    persist(empty);
    setSelectedKeys(empty);
  }, [persist]);

  return { selectedKeys, toggleBook, clearBooks };
}
