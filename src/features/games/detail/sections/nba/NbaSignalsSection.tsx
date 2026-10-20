import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import { type SignalPerformanceRow } from '@/utils/signalPerformance';
import { GameLevelSignalList, type SignalDefinition, type SlateFlag } from '../cfb/CfbSlateSections';
import type { NBAPrediction, NbaSlateFlag } from '../../../api/nbaGames';
import type { GameFeedItem } from '../../../types';

export type NbaSignalMarket = 'spread' | 'total' | 'moneyline' | 'h1_spread' | 'h1_total';

/**
 * Flag `market` values land on the card that prices that market.
 * A blank flag market falls back to the definition's market.
 */
function canonicalMarket(value: string | null | undefined): NbaSignalMarket | '' {
  const key = String(value || '').toLowerCase().trim();
  if (key === 'spread' || key === 'fg_spread') return 'spread';
  if (key === 'total' || key === 'fg_total' || key === 'ou') return 'total';
  if (key === 'moneyline' || key === 'ml' || key === 'money_line' || key === 'fg_ml') return 'moneyline';
  if (key === 'h1_spread') return 'h1_spread';
  if (key === 'h1_total' || key === 'h1_ou' || key === 'h1_over_under') return 'h1_total';
  return '';
}

interface NbaSignalContextValue {
  away: GameFeedItem['awayTeam'];
  home: GameFeedItem['homeTeam'];
  byMarket: Record<NbaSignalMarket, SlateFlag[]>;
  signalDefs: Record<string, SignalDefinition>;
  performance: Record<string, SignalPerformanceRow>;
}

const NbaSignalContext = createContext<NbaSignalContextValue | null>(null);

const EMPTY_MARKETS: Record<NbaSignalMarket, SlateFlag[]> = {
  spread: [],
  total: [],
  moneyline: [],
  h1_spread: [],
  h1_total: [],
};

export function NbaSignalProvider({ game, children }: { game: GameFeedItem; children: ReactNode }) {
  const raw = game.raw as unknown as NBAPrediction;
  const flags = useMemo(() => (raw.nba_flags || []) as NbaSlateFlag[], [raw.nba_flags]);
  const [signalDefs, setSignalDefs] = useState<Record<string, SignalDefinition>>({});
  const [performance, setPerformance] = useState<Record<string, SignalPerformanceRow>>({});

  useEffect(() => {
    if (flags.length === 0) return;
    let cancelled = false;
    const season = Number(String(raw.game_date || '').slice(0, 4));
    Promise.all([
      collegeFootballSupabase.from('nba_signal_defs').select('*'),
      collegeFootballSupabase.from('signal_performance').select('*').eq('sport', 'nba').eq('season', season),
    ])
      .then(([{ data: defs, error: defsError }, { data: perf, error: perfError }]) => {
        if (cancelled) return;
        if (defsError) debug.warn('nba_signal_defs error:', defsError.message);
        if (perfError) debug.warn('nba signal_performance error:', perfError.message);
        setSignalDefs(
          ((defs || []) as SignalDefinition[]).reduce<Record<string, SignalDefinition>>((acc, row) => {
            if (row.signal_key) acc[row.signal_key] = row;
            return acc;
          }, {}),
        );
        setPerformance(
          ((perf || []) as SignalPerformanceRow[]).reduce<Record<string, SignalPerformanceRow>>((acc, row) => {
            if (row.signal_key) acc[row.signal_key] = row;
            return acc;
          }, {}),
        );
      })
      .catch((err) => debug.error('Error loading NBA signal defs:', err));
    return () => {
      cancelled = true;
    };
  }, [flags.length, raw.game_date]);

  const byMarket = useMemo(() => {
    const grouped: Record<NbaSignalMarket, SlateFlag[]> = {
      spread: [],
      total: [],
      moneyline: [],
      h1_spread: [],
      h1_total: [],
    };
    for (const flag of flags) {
      const def = signalDefs[flag.signal_key];
      const market = canonicalMarket(flag.market) || canonicalMarket((def as { market?: string | null } | undefined)?.market);
      if (!market) continue;
      grouped[market].push(flag as unknown as SlateFlag);
    }
    return grouped;
  }, [flags, signalDefs]);

  const value = useMemo(
    () => ({ away: game.awayTeam, home: game.homeTeam, byMarket, signalDefs, performance }),
    [game.awayTeam, game.homeTeam, byMarket, signalDefs, performance],
  );

  return <NbaSignalContext.Provider value={value}>{children}</NbaSignalContext.Provider>;
}

/** The pick-signal row for one market. Renders nothing when that market has no flags. */
export function NbaMarketSignals({ market }: { market: NbaSignalMarket }) {
  const ctx = useContext(NbaSignalContext);
  if (!ctx) return null;
  const flags = ctx.byMarket[market] || EMPTY_MARKETS[market];
  if (flags.length === 0) return null;
  return (
    <GameLevelSignalList
      flags={flags}
      away={ctx.away}
      home={ctx.home}
      signalDefs={ctx.signalDefs}
      signalPerformance={ctx.performance}
      showLifecycleRecords
      listTitle="Pick Signals"
    />
  );
}
