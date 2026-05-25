// Calls the snapshot_player_prop_picks RPC after the report computes picks.
// The RPC persists every pick to mlb_player_prop_picks and freezes anything
// whose game has already started, so subsequent runs of the algorithm can't
// rewrite picks that bettors already saw / bet. Returns the set of (game_pk,
// player_id, market, side) keys that the server reports as locked, so the UI
// can show a 🔒 badge inline.

import { useEffect, useState } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { PropPick } from '@/utils/dailyPropsReport';

export interface LockedKey {
  game_pk: number;
  player_id: number;
  market: string;
  side: 'over' | 'under';
}

function keyOf(p: { game_pk: number; player_id: number; market: string; side?: string }): string {
  return `${p.game_pk}|${p.player_id}|${p.market}|${p.side ?? 'over'}`;
}

function toRpcPayload(picks: PropPick[]) {
  return picks.map(p => ({
    game_pk: p.game_pk,
    player_id: p.player_id,
    market: p.market,
    side: 'over' as const,
    player_name: p.player_name,
    team_name: p.team_name,
    game_label: p.game_label,
    game_time: p.game_time,
    is_day: p.is_day,
    market_label: p.market_label,
    kind: p.kind,
    tier: p.tier,
    score: p.score,
    line: p.line,
    over_odds: p.over_odds,
    under_odds: p.under_odds,
    l10_over: p.l10_over,
    l10_games: p.l10_games,
    l10_pct: p.l10_pct,
    rationale: p.rationale,
  }));
}

export function useSnapshotPlayerPropPicks(
  reportDate: string | null,
  picks: PropPick[],
  enabled: boolean,
): Set<string> {
  const [lockedKeys, setLockedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !reportDate || picks.length === 0) return;
    let cancelled = false;

    (async () => {
      const payload = toRpcPayload(picks);
      const { error } = await collegeFootballSupabase.rpc('snapshot_player_prop_picks', {
        p_report_date: reportDate,
        p_picks: payload,
      });
      if (cancelled || error) {
        if (error) console.warn('[snapshot_player_prop_picks]', error.message);
        return;
      }
      // Re-query locked rows for this date so the UI can badge them.
      const { data: locked } = await collegeFootballSupabase
        .from('mlb_player_prop_picks')
        .select('game_pk, player_id, market, side')
        .eq('report_date', reportDate)
        .eq('locked', true);
      if (cancelled) return;
      const next = new Set<string>();
      for (const row of locked ?? []) {
        next.add(
          keyOf({
            game_pk: Number(row.game_pk),
            player_id: Number(row.player_id),
            market: String(row.market),
            side: String(row.side ?? 'over'),
          }),
        );
      }
      setLockedKeys(next);
    })();

    return () => {
      cancelled = true;
    };
    // Only re-snapshot when the report date or the picks set changes meaningfully.
  }, [reportDate, picks, enabled]);

  return lockedKeys;
}

export function pickIsLocked(p: PropPick, lockedKeys: Set<string>): boolean {
  return lockedKeys.has(keyOf({ ...p, side: 'over' }));
}
