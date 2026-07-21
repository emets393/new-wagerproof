// The dashboard's entry point for the two MLB Parlay God rails. Reuses the
// Outliers MLB bundle fetcher + the existing MLB props hooks, then builds the
// leg pool → tickets via the pure engine. Resilient: a failed bundle still
// yields prop tickets and vice-versa (see buildParlayTickets's null handling).
// See specs/outliers_spec.md §5c.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { fetchMLBBundle } from '@/features/outliers/outliersTrendsService';
import { useTodaysMatchupGames } from '@/hooks/useTodaysMatchupGames';
import { useAllPlayerProps } from '@/hooks/useAllPlayerProps';
import { buildParlayTickets } from './engine';
import { buildPropMatchups, type LineupTeamRow } from './propMatchupAdapter';
import type { ParlayTicket } from './types';

/** One batched pull of team assignments across the whole slate (avatar tint). */
async function fetchLineupTeamRows(gamePks: number[]): Promise<LineupTeamRow[]> {
  if (gamePks.length === 0) return [];
  const { data, error } = await collegeFootballSupabase
    .from('mlb_game_lineups')
    .select('game_pk, team_id, player_id')
    .in('game_pk', gamePks);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    game_pk: Number(r.game_pk),
    team_id: Number(r.team_id),
    player_id: Number(r.player_id),
  }));
}

export interface UseParlayGodResult {
  slateTickets: ParlayTicket[];
  propsTickets: ParlayTicket[];
  // The two rails resolve independently (spec §10) — the Parlay God rail is a
  // pure bundle read, Props Cheats fans out N per-game prop RPCs. Kept separate
  // so a slow prop pull never drags the already-built slate rail back to its
  // skeleton (and vice-versa); each rail feeds off its own flag.
  slateLoading: boolean;
  propsLoading: boolean;
  isError: boolean;
}

/**
 * `enabled` = `sport === 'mlb'` (the two sections are MLB-only). When false the
 * expensive work is inert: the bundle, per-game prop RPCs, and lineup query are
 * all gated off and the hook returns empty arrays. The shared today's-games list
 * (`useTodaysMatchupGames`) has no `enabled` switch, so it stays deduped with the
 * Matchups grid rather than being re-fetched here.
 */
export function useParlayGod(enabled: boolean): UseParlayGodResult {
  const bundleQuery = useQuery({
    queryKey: ['parlay-god-bundle'],
    queryFn: fetchMLBBundle,
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const gamesQuery = useTodaysMatchupGames();
  const games = enabled ? (gamesQuery.data ?? []) : [];

  const { propsByGamePk, isLoading: propsLoading } = useAllPlayerProps(games, enabled);

  const gamePks = useMemo(
    () => games.map((g) => g.game_pk).filter((pk) => pk > 0),
    [games],
  );
  const lineupQuery = useQuery({
    queryKey: ['parlay-god-lineups', gamePks],
    queryFn: () => fetchLineupTeamRows(gamePks),
    enabled: enabled && gamePks.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const propMatchups = useMemo(() => {
    if (!enabled) return [];
    return buildPropMatchups({
      games,
      propsByGamePk,
      lineupRows: lineupQuery.data ?? [],
    });
    // Pool is small — recomputing on any input identity change is negligible and
    // avoids threading a stale-props signature through the memo.
  }, [enabled, games, propsByGamePk, lineupQuery.data]);

  const tickets = useMemo(() => {
    if (!enabled) return { slateTickets: [], propsTickets: [] };
    return buildParlayTickets({ bundle: bundleQuery.data ?? null, propMatchups });
  }, [enabled, bundleQuery.data, propMatchups]);

  return {
    slateTickets: tickets.slateTickets,
    propsTickets: tickets.propsTickets,
    // Parlay God rail: bundle only. Props Cheats rail: the per-game prop RPCs.
    // Decoupled so neither rail flickers back to its skeleton when the other's
    // data lands later (spec §10).
    slateLoading: enabled && bundleQuery.isLoading,
    propsLoading: enabled && propsLoading,
    // Props degrade to empty on error (per useAllPlayerProps/RPC catch), so only
    // the bundle failing is a hard error — prop tickets can still populate.
    isError: enabled && bundleQuery.isError,
  };
}
