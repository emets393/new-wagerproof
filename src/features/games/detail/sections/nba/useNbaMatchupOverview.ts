import { useQuery } from '@tanstack/react-query';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';

/**
 * NBA injuries + team-trend fetches, ported from MatchupOverviewModal (which
 * queried collegeFootballSupabase directly on open). Same queries/normalization;
 * React Query replaces the modal's open/close state machine so results cache
 * per matchup while the user flips through the split view.
 */

export interface NbaInjuryReport {
  player_name: string;
  avg_pie_season: string | number | null;
  status: string;
  team_id: number;
  team_name: string;
  team_abbr: string;
}

export interface NbaGameTrends {
  home_ovr_rtg: number | null;
  away_ovr_rtg: number | null;
  home_consistency: number | null;
  away_consistency: number | null;
  home_win_streak: number | null;
  away_win_streak: number | null;
  home_ats_pct: number | null;
  away_ats_pct: number | null;
  home_ats_streak: number | null;
  away_ats_streak: number | null;
  home_last_margin: number | null;
  away_last_margin: number | null;
  home_over_pct: number | null;
  away_over_pct: number | null;
  home_adj_pace_pregame_l3_trend: number | null;
  away_adj_pace_pregame_l3_trend: number | null;
  home_adj_off_rtg_pregame_l3_trend: number | null;
  away_adj_off_rtg_pregame_l3_trend: number | null;
  home_adj_def_rtg_pregame_l3_trend: number | null;
  away_adj_def_rtg_pregame_l3_trend: number | null;
}

// game_date from nba_input_values_view should already be YYYY-MM-DD; strip a
// time part if present but avoid new Date() on clean dates (timezone shifts).
function normalizeDateStrict(gameDate: string): string {
  let normalizedDate = gameDate;

  if (gameDate.includes('T')) {
    normalizedDate = gameDate.split('T')[0];
  } else if (gameDate.includes(' ')) {
    normalizedDate = gameDate.split(' ')[0];
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    try {
      const dateObj = new Date(normalizedDate);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        normalizedDate = `${year}-${month}-${day}`;
      }
    } catch (e) {
      // If parsing fails, use as-is
    }
  }

  return normalizedDate;
}

// Trends fetch in the modal only stripped the time part (no re-parse branch).
function normalizeDateLoose(gameDate: string): string {
  if (gameDate.includes('T')) return gameDate.split('T')[0];
  if (gameDate.includes(' ')) return gameDate.split(' ')[0];
  return gameDate;
}

export function useNbaMatchupOverview(
  awayTeam: string | undefined,
  homeTeam: string | undefined,
  gameDate: string | undefined
) {
  const enabled = !!awayTeam && !!homeTeam && !!gameDate;

  const injuriesQuery = useQuery<NbaInjuryReport[], Error>({
    queryKey: ['nba-matchup-injuries', awayTeam, homeTeam, gameDate],
    enabled,
    queryFn: async () => {
      const normalizedDate = normalizeDateStrict(gameDate!);

      // game_date_et (injury_report) = game_date (nba_input_values_view),
      // team_name IN (away, home), bucket = 'current'
      const { data, error } = await collegeFootballSupabase
        .from('nba_injury_report')
        .select('player_name, avg_pie_season, status, team_id, team_name, team_abbr, game_date_et')
        .in('team_name', [awayTeam!, homeTeam!])
        .eq('game_date_et', normalizedDate)
        .eq('bucket', 'current');

      if (error) {
        debug.error('Error fetching NBA injury data:', error);
        throw new Error(error.message);
      }
      return (data || []) as NbaInjuryReport[];
    },
  });

  const trendsQuery = useQuery<NbaGameTrends | null, Error>({
    queryKey: ['nba-matchup-trends', awayTeam, homeTeam, gameDate],
    enabled,
    queryFn: async () => {
      const normalizedDate = normalizeDateLoose(gameDate!);

      const { data, error } = await collegeFootballSupabase
        .from('nba_input_values_view')
        .select(
          'home_ovr_rtg, away_ovr_rtg, home_consistency, away_consistency, home_win_streak, away_win_streak, home_ats_pct, away_ats_pct, home_ats_streak, away_ats_streak, home_last_margin, away_last_margin, home_over_pct, away_over_pct, home_adj_pace_pregame_l3_trend, away_adj_pace_pregame_l3_trend, home_adj_off_rtg_pregame_l3_trend, away_adj_off_rtg_pregame_l3_trend, home_adj_def_rtg_pregame_l3_trend, away_adj_def_rtg_pregame_l3_trend'
        )
        .eq('game_date', normalizedDate)
        .eq('away_team', awayTeam!)
        .eq('home_team', homeTeam!)
        .maybeSingle();

      if (error) {
        // Modal swallowed trend errors (no error UI) — keep trends null.
        debug.error('Error fetching NBA trends:', error);
        return null;
      }
      return (data as NbaGameTrends | null) ?? null;
    },
  });

  return {
    injuries: injuriesQuery.data ?? [],
    injuriesLoading: injuriesQuery.isLoading && enabled,
    injuriesError: injuriesQuery.error?.message ?? null,
    trends: trendsQuery.data ?? null,
    trendsLoading: trendsQuery.isLoading && enabled,
  };
}

/**
 * Comparison coloring for trend rows — verbatim from MatchupOverviewModal:
 * O/U% uncolored, defensive rating lower-is-better, everything else
 * higher-is-better.
 */
export function getTrendColor(
  awayValue: number | null,
  homeValue: number | null,
  metricName: string
): { awayColor: string; homeColor: string } {
  if (metricName === 'Over/Under %') {
    return { awayColor: 'inherit', homeColor: 'inherit' };
  }

  if (metricName === 'Defensive Rating Trend (Last 3)') {
    if (awayValue === null || homeValue === null) {
      return { awayColor: 'inherit', homeColor: 'inherit' };
    }
    return {
      awayColor: awayValue < homeValue ? 'green' : awayValue > homeValue ? 'red' : 'inherit',
      homeColor: homeValue < awayValue ? 'green' : homeValue > awayValue ? 'red' : 'inherit',
    };
  }

  if (awayValue === null || homeValue === null) {
    return { awayColor: 'inherit', homeColor: 'inherit' };
  }
  return {
    awayColor: awayValue > homeValue ? 'green' : awayValue < homeValue ? 'red' : 'inherit',
    homeColor: homeValue > awayValue ? 'green' : homeValue < awayValue ? 'red' : 'inherit',
  };
}
