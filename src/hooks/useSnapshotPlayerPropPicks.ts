// Reads which picks are locked for the given report date so the UI can show
// 🔒 badges. As of the server-side scorer rollout, the CLIENT no longer
// writes picks to mlb_player_prop_picks — the score-player-props edge
// function (invoked by the MLB hourly runner after data ingest) is now the
// only writer. The picks-report page just computes a preview locally for
// instant display, then reads the locked set from the server.

import { useEffect, useState } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import type { PropPick } from '@/utils/dailyPropsReport';

function keyOf(p: { game_pk: number; player_id: number; market: string; side?: string }): string {
  return `${p.game_pk}|${p.player_id}|${p.market}|${p.side ?? 'over'}`;
}

export function useSnapshotPlayerPropPicks(
  reportDate: string | null,
  _picks: PropPick[],
  enabled: boolean,
): Set<string> {
  const [lockedKeys, setLockedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !reportDate) return;
    let cancelled = false;

    (async () => {
      const { data: locked, error } = await collegeFootballSupabase
        .from('mlb_player_prop_picks')
        .select('game_pk, player_id, market, side')
        .eq('report_date', reportDate)
        .eq('locked', true);
      if (cancelled || error) {
        if (error) console.warn('[picks_locked_read]', error.message);
        return;
      }
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

    return () => { cancelled = true; };
    // Re-check the locked set if the user navigates away/back. Picks
    // themselves change rarely (server cron) so we don't watch them.
  }, [reportDate, enabled]);

  return lockedKeys;
}

export function pickIsLocked(p: PropPick, lockedKeys: Set<string>): boolean {
  return lockedKeys.has(keyOf(p));
}
