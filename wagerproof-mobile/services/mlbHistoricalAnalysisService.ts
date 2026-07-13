import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import type {
  MlbAnalysisBetType,
  MlbAnalysisResponse,
  MlbAnalysisUpcomingGame,
  MlbPitcherOption,
} from '@/types/mlbHistoricalAnalysis';

export async function fetchMlbAnalysis(
  betType: MlbAnalysisBetType,
  filters: Record<string, unknown>,
): Promise<MlbAnalysisResponse | null> {
  const { data, error } = await collegeFootballSupabase.rpc('mlb_analysis', {
    p_bet_type: betType,
    p_filters: filters,
  });
  if (error) {
    console.error('[mlb_analysis]', error.message);
    return null;
  }
  return data as MlbAnalysisResponse;
}

export async function fetchMlbAnalysisUpcoming(
  betType: MlbAnalysisBetType,
  filters: Record<string, unknown>,
): Promise<MlbAnalysisUpcomingGame[]> {
  const { data, error } = await collegeFootballSupabase.rpc('mlb_analysis_upcoming', {
    p_bet_type: betType,
    p_filters: filters,
  });
  if (error) {
    console.error('[mlb_analysis_upcoming]', error.message);
    return [];
  }
  return (data as MlbAnalysisUpcomingGame[]) || [];
}

export async function fetchMlbPitcherOptions(q: string | null): Promise<MlbPitcherOption[]> {
  const { data, error } = await collegeFootballSupabase.rpc('mlb_pitcher_options', {
    p_q: q && q.trim() ? q.trim() : null,
  });
  if (error) {
    console.error('[mlb_pitcher_options]', error.message);
    return [];
  }
  return (data as MlbPitcherOption[]) || [];
}

export async function fetchMlbTeamAbbrs(): Promise<{ abbr: string; name: string }[]> {
  const { data, error } = await collegeFootballSupabase
    .from('mlb_team_mapping')
    .select('team, team_name');
  if (error || !data) return [];
  const seen = new Set<string>();
  return (data as { team?: string; team_name?: string }[])
    .map(r => ({ abbr: String(r.team || '').toUpperCase(), name: String(r.team_name || r.team || '') }))
    .filter(t => t.abbr && (seen.has(t.abbr) ? false : (seen.add(t.abbr), true)))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));
}
