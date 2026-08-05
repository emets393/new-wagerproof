import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { installCfbTeamAssets } from '@/utils/cfbTeamAssets';
import { installNflTeamAssets } from '@/utils/nflTeamAssets';
import {
  fetchCompGames,
  fetchCompWeeks,
  fetchLeaderboard,
  fetchMyEntry,
  fetchMyPicks,
  fetchWeekStats,
  pickCurrentWeek,
  pickLatestPastWeek,
  saveCompPicks,
  submitCompPicks,
  visibleCompWeeks,
} from './api';
import type { CompDraftPick, CompPick, CompWeek, CompetitionTab } from './types';

const STALE = 30_000;

/** Load NFL/CFB logo reference tables once for the competition slate. */
export function useEnsureCompTeamAssets() {
  return useQuery({
    queryKey: ['comp', 'team-assets'],
    staleTime: Infinity,
    queryFn: async () => {
      const [{ data: nfl }, { data: cfb }] = await Promise.all([
        collegeFootballSupabase
          .from('nfl_teams')
          .select('team_abbr, team_name, team_nick, logo_espn'),
        collegeFootballSupabase
          .from('cfb_teams')
          .select('team_name, abbr, logo, logo_dark, color, alt_color'),
      ]);
      installNflTeamAssets(nfl || []);
      installCfbTeamAssets(cfb || []);
      return true;
    },
  });
}

export function useCompWeeks() {
  return useQuery({
    queryKey: ['comp', 'weeks'],
    queryFn: fetchCompWeeks,
    staleTime: STALE,
  });
}

export function useResolvedCompWeek(
  selectedWeekId: number | null,
  tab: CompetitionTab = 'picks'
) {
  const weeksQ = useCompWeeks();
  const allWeeks = weeksQ.data ?? [];
  const weeks = visibleCompWeeks(allWeeks);
  const current = pickCurrentWeek(allWeeks);
  const latestPast = pickLatestPastWeek(allWeeks);

  const explicit =
    selectedWeekId != null
      ? weeks.find((w) => w.id === selectedWeekId) ??
        allWeeks.find((w) => w.id === selectedWeekId) ??
        null
      : null;

  // My Picks → open/current week. Most Picked / Leaderboard → latest week past
  // deadline when nothing is explicitly selected, so reveal RPCs aren't gated
  // behind a still-open slate.
  const week =
    explicit ??
    ((tab === 'most' || tab === 'leaderboard') && latestPast ? latestPast : null) ??
    current;

  return { weeksQ, weeks, current, latestPast, week: week ?? null };
}

export function useCompGames(weekId: number | undefined) {
  return useQuery({
    queryKey: ['comp', 'games', weekId],
    enabled: weekId != null,
    queryFn: () => fetchCompGames(weekId!),
    staleTime: STALE,
    refetchInterval: 60_000,
  });
}

export function useMyCompEntry(weekId: number | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['comp', 'entry', weekId, user?.id],
    enabled: weekId != null && Boolean(user?.id),
    queryFn: async () => {
      const entry = await fetchMyEntry(weekId!, user!.id);
      if (!entry) return { entry: null as null, picks: [] as CompPick[] };
      const picks = await fetchMyPicks(entry.id);
      return { entry, picks };
    },
    staleTime: 10_000,
  });
}

export function useCompLeaderboard(season: number | undefined, weekId: number | null) {
  return useQuery({
    queryKey: ['comp', 'leaderboard', season, weekId],
    enabled: season != null,
    queryFn: () => fetchLeaderboard(season!, weekId),
    staleTime: STALE,
    refetchInterval: 60_000,
  });
}

export function useCompWeekStats(weekId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['comp', 'week-stats', weekId],
    enabled: weekId != null && enabled,
    queryFn: () => fetchWeekStats(weekId!),
    staleTime: STALE,
    retry: false,
  });
}

export function useNowTicker(intervalMs = 1000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useSaveCompPicks(weekId: number | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (picks: CompDraftPick[]) => {
      if (weekId == null) throw new Error('no week selected');
      return saveCompPicks(weekId, picks);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['comp', 'entry', weekId, user?.id] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useSubmitCompPicks(weekId: number | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: () => {
      if (weekId == null) throw new Error('no week selected');
      return submitCompPicks(weekId);
    },
    onSuccess: () => {
      toast.success('Picks submitted — lines stamped');
      void qc.invalidateQueries({ queryKey: ['comp', 'entry', weekId, user?.id] });
      void qc.invalidateQueries({ queryKey: ['comp', 'games', weekId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function isWeekLocked(week: CompWeek | null, now: number): boolean {
  if (!week) return true;
  if (week.status === 'locked' || week.status === 'graded') return true;
  return new Date(week.deadline).getTime() <= now;
}

export function isPastDeadline(week: CompWeek | null, now: number): boolean {
  if (!week) return false;
  return new Date(week.deadline).getTime() <= now;
}
