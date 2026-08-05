import { supabase } from '@/integrations/supabase/client';
import type {
  CompDraftPick,
  CompEntry,
  CompGame,
  CompLeaderboardRow,
  CompPick,
  CompWeek,
  CompWeekStatRow,
} from './types';

function rpcMessage(err: { message?: string } | null): string {
  return err?.message?.replace(/^.*?:\s*/, '') || 'Something went wrong';
}

export async function fetchCompWeeks(): Promise<CompWeek[]> {
  const { data, error } = await supabase
    .from('comp_weeks')
    .select('id,season,week_no,label,deadline,window_end,status')
    .order('season', { ascending: false })
    .order('week_no', { ascending: true });
  if (error) throw new Error(rpcMessage(error));
  return (data ?? []) as CompWeek[];
}

export async function fetchCompGames(weekId: number): Promise<CompGame[]> {
  const { data, error } = await supabase
    .from('comp_games')
    .select(
      'id,week_id,sport,event_id,home_team,away_team,kickoff,spread_home,total,books_n,lines_updated_at,home_score,away_score,is_final'
    )
    .eq('week_id', weekId)
    .order('kickoff', { ascending: true });
  if (error) throw new Error(rpcMessage(error));
  return (data ?? []) as CompGame[];
}

export async function fetchMyEntry(weekId: number, userId: string): Promise<CompEntry | null> {
  const { data, error } = await supabase
    .from('comp_entries')
    .select('id,week_id,user_id,status,submitted_at,editable_until')
    .eq('week_id', weekId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(rpcMessage(error));
  return (data as CompEntry | null) ?? null;
}

export async function fetchMyPicks(entryId: number): Promise<CompPick[]> {
  const { data, error } = await supabase
    .from('comp_picks')
    .select(
      'id,entry_id,game_id,market,side,line,line_stamped_at,is_potw,result,points,cover_points'
    )
    .eq('entry_id', entryId);
  if (error) throw new Error(rpcMessage(error));
  return (data ?? []) as CompPick[];
}

export async function saveCompPicks(weekId: number, picks: CompDraftPick[]): Promise<void> {
  const payload = picks.map((p) => ({
    game_id: p.game_id,
    market: p.market,
    side: p.side,
    is_potw: p.is_potw,
  }));
  const { error } = await supabase.rpc('comp_save_picks', {
    p_week_id: weekId,
    p_picks: payload,
  });
  if (error) throw new Error(rpcMessage(error));
}

export async function submitCompPicks(
  weekId: number
): Promise<{ editable_until: string; entry_id: number; status: string }> {
  const { data, error } = await supabase.rpc('comp_submit_picks', { p_week_id: weekId });
  if (error) throw new Error(rpcMessage(error));
  return data as { editable_until: string; entry_id: number; status: string };
}

export async function fetchLeaderboard(
  season: number,
  weekId?: number | null
): Promise<CompLeaderboardRow[]> {
  const args: { p_season: number; p_week_id?: number } = { p_season: season };
  if (weekId != null) args.p_week_id = weekId;
  const { data, error } = await supabase.rpc('comp_leaderboard', args);
  if (error) throw new Error(rpcMessage(error));
  return (data ?? []) as CompLeaderboardRow[];
}

export async function fetchWeekStats(weekId: number): Promise<CompWeekStatRow[]> {
  const { data, error } = await supabase.rpc('comp_week_stats', { p_week_id: weekId });
  if (error) throw new Error(rpcMessage(error));
  return (data ?? []) as CompWeekStatRow[];
}

/**
 * Current week for picking / default view:
 * 1) Soonest week with a future deadline (open slate — e.g. Week 0)
 * 2) Else locked week still inside its Tue window (games weekend)
 * 3) Else most recent past week
 *
 * Past-deadline preview/graded weeks stay selectable via the picker but never
 * steal default while an open week exists.
 */
export function pickCurrentWeek(weeks: CompWeek[], now = Date.now()): CompWeek | null {
  if (!weeks.length) return null;
  const upcoming = weeks
    .filter((w) => new Date(w.deadline).getTime() > now)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  if (upcoming[0]) return upcoming[0];
  const inPlay = weeks
    .filter((w) => new Date(w.window_end).getTime() > now)
    .sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());
  if (inPlay[0]) return inPlay[0];
  return [...weeks].sort(
    (a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime()
  )[0] ?? null;
}

/** Most recent week whose deadline has passed — for reveal surfaces. */
export function pickLatestPastWeek(weeks: CompWeek[], now = Date.now()): CompWeek | null {
  const past = weeks
    .filter((w) => new Date(w.deadline).getTime() <= now)
    .sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());
  return past[0] ?? null;
}

/**
 * Past weeks (deadline passed) + current open week. Never future weeks.
 * Past-deadline weeks are always included so graded / preview slates stay
 * reachable from the picker without becoming the My Picks default.
 */
export function visibleCompWeeks(weeks: CompWeek[], now = Date.now()): CompWeek[] {
  const current = pickCurrentWeek(weeks, now);
  if (!current) return [];
  const currentDl = new Date(current.deadline).getTime();
  return weeks
    .filter((w) => {
      const dl = new Date(w.deadline).getTime();
      if (dl <= now) return true;
      if (w.id === current.id) return true;
      return dl <= currentDl;
    })
    .sort((a, b) =>
      a.season !== b.season ? a.season - b.season : a.week_no - b.week_no
    );
}
