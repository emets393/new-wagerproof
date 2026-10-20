import { useEffect, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import { type SignalPerformanceRow } from '@/utils/signalPerformance';
import { GameLevelSignalList, type SignalDefinition, type SlateFlag } from '../cfb/CfbSlateSections';
import type { NBAPrediction } from '../../../api/nbaGames';
import type { GameFeedItem } from '../../../types';

/**
 * NBA signals card: the situational signals (dead home favorite, three-point luck storm, national-TV
 * unders, Thanksgiving dog, buzzer-beater / OT fades, final-two-weeks over, home rest edge, road-fav
 * blowout carry, cold-road-trip over), the two model-disagreement flags, and the two derived flags the
 * confluence step writes (nba_model_signal_confluence = model + agreeing signal, nba_signal_stack = two
 * situational signals on one team), all from nba_slate_flags. New signal keys render with no code change
 * because names and copy come from nba_signal_defs. The flags ride in on the feed row (`raw.nba_flags`) so the card and the feed ⚡
 * badge count the same rows; only the definitions and the season record are fetched here.
 * Renders the football GameLevelSignalList — the flag contract is shared, so the pills, the
 * Direction row with the bet team's logo, and the backtest meter are identical across sports.
 */
export function NbaSignalsSection({ game }: { game: GameFeedItem }) {
  const raw = game.raw as unknown as NBAPrediction;
  const flags = useMemo(() => (raw.nba_flags || []) as unknown as SlateFlag[], [raw.nba_flags]);
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

  if (flags.length === 0) return null;

  return (
    <WidgetCard
      icon={<Zap />}
      title="Signals"
      subtitle="Situational spots and model disagreements that fired on this game — what each one bets, and its record."
      accessory={
        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
          {flags.length} signal{flags.length === 1 ? '' : 's'}
        </span>
      }
    >
      <GameLevelSignalList
        flags={flags}
        away={game.awayTeam}
        home={game.homeTeam}
        signalDefs={signalDefs}
        signalPerformance={performance}
        showLifecycleRecords
      />
    </WidgetCard>
  );
}
