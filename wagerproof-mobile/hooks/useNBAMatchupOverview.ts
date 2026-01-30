import { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';
import { NBAInjuryReport, NBAGameTrends } from '@/types/nba';

interface UseNBAMatchupOverviewProps {
  awayTeam: string | undefined;
  homeTeam: string | undefined;
  gameDate: string | undefined;
  isOpen: boolean;
}

interface UseNBAMatchupOverviewResult {
  injuries: NBAInjuryReport[];
  trends: NBAGameTrends | null;
  isLoadingInjuries: boolean;
  isLoadingTrends: boolean;
  error: string | null;
  awayInjuries: NBAInjuryReport[];
  homeInjuries: NBAInjuryReport[];
  awayInjuryImpact: number;
  homeInjuryImpact: number;
}

/**
 * Normalizes a date string to YYYY-MM-DD format
 * Handles various input formats without timezone shifts
 */
function normalizeDateString(dateStr: string): string {
  let normalized = dateStr;

  // Extract just the date part if it includes time
  if (dateStr.includes('T')) {
    normalized = dateStr.split('T')[0];
  } else if (dateStr.includes(' ')) {
    normalized = dateStr.split(' ')[0];
  }

  // Validate it looks like YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    // If it's not in the right format, try to parse it
    try {
      const dateObj = new Date(normalized);
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        normalized = `${year}-${month}-${day}`;
      }
    } catch (e) {
      // If parsing fails, use as-is
    }
  }

  return normalized;
}

/**
 * Calculates cumulative Injury Impact Score (sum of -PIE values)
 */
function calculateInjuryImpact(injuries: NBAInjuryReport[]): number {
  if (injuries.length === 0) return 0.0;
  return injuries.reduce((sum, injury) => {
    if (injury.avg_pie_season === null || injury.avg_pie_season === undefined) return sum;
    const pie = typeof injury.avg_pie_season === 'string'
      ? parseFloat(injury.avg_pie_season)
      : injury.avg_pie_season;
    return sum + (isNaN(pie) ? 0 : -pie);
  }, 0);
}

export function useNBAMatchupOverview({
  awayTeam,
  homeTeam,
  gameDate,
  isOpen,
}: UseNBAMatchupOverviewProps): UseNBAMatchupOverviewResult {
  const [injuries, setInjuries] = useState<NBAInjuryReport[]>([]);
  const [trends, setTrends] = useState<NBAGameTrends | null>(null);
  const [isLoadingInjuries, setIsLoadingInjuries] = useState(false);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hasTeams = !!(awayTeam && homeTeam);
    const hasDate = !!gameDate;
    const allConditionsMet = isOpen && hasTeams && hasDate;

    if (allConditionsMet) {
      fetchInjuryData();
      fetchTrendsData();
    } else {
      // Reset state when conditions are not met
      setInjuries([]);
      setTrends(null);
      setError(null);
    }
  }, [isOpen, awayTeam, homeTeam, gameDate]);

  const fetchInjuryData = async () => {
    if (!awayTeam || !homeTeam || !gameDate) return;

    setIsLoadingInjuries(true);
    setError(null);

    try {
      const normalizedDate = normalizeDateString(gameDate);

      // Query nba_injury_report:
      // - game_date_et = game_date (from nba_input_values_view)
      // - team_name IN (away_team, home_team) (from nba_input_values_view)
      // - bucket = 'current'
      const { data, error: fetchError } = await collegeFootballSupabase
        .from('nba_injury_report')
        .select('player_name, avg_pie_season, status, team_id, team_name, team_abbr')
        .in('team_name', [awayTeam, homeTeam])
        .eq('game_date_et', normalizedDate)
        .eq('bucket', 'current');

      if (fetchError) {
        console.error('Error fetching injury data:', fetchError);
        setError(fetchError.message);
        return;
      }

      setInjuries(data || []);
    } catch (err) {
      console.error('Exception fetching injury data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch injury data');
    } finally {
      setIsLoadingInjuries(false);
    }
  };

  const fetchTrendsData = async () => {
    if (!awayTeam || !homeTeam || !gameDate) return;

    setIsLoadingTrends(true);

    try {
      const normalizedDate = normalizeDateString(gameDate);

      // Query nba_input_values_view for this specific game
      const { data, error: fetchError } = await collegeFootballSupabase
        .from('nba_input_values_view')
        .select(`
          home_ovr_rtg, away_ovr_rtg,
          home_consistency, away_consistency,
          home_win_streak, away_win_streak,
          home_ats_pct, away_ats_pct,
          home_ats_streak, away_ats_streak,
          home_last_margin, away_last_margin,
          home_over_pct, away_over_pct,
          home_adj_pace_pregame_l3_trend, away_adj_pace_pregame_l3_trend,
          home_adj_off_rtg_pregame_l3_trend, away_adj_off_rtg_pregame_l3_trend,
          home_adj_def_rtg_pregame_l3_trend, away_adj_def_rtg_pregame_l3_trend
        `)
        .eq('game_date', normalizedDate)
        .eq('away_team', awayTeam)
        .eq('home_team', homeTeam)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching trends:', fetchError);
      } else {
        setTrends(data as NBAGameTrends | null);
      }
    } catch (err) {
      console.error('Exception fetching trends:', err);
    } finally {
      setIsLoadingTrends(false);
    }
  };

  // Group injuries by team_name (matching away_team and home_team)
  const awayInjuries = injuries.filter((injury) => {
    if (!awayTeam || !injury.team_name) return false;
    return injury.team_name.toLowerCase() === awayTeam.toLowerCase();
  });

  const homeInjuries = injuries.filter((injury) => {
    if (!homeTeam || !injury.team_name) return false;
    return injury.team_name.toLowerCase() === homeTeam.toLowerCase();
  });

  const awayInjuryImpact = calculateInjuryImpact(awayInjuries);
  const homeInjuryImpact = calculateInjuryImpact(homeInjuries);

  return {
    injuries,
    trends,
    isLoadingInjuries,
    isLoadingTrends,
    error,
    awayInjuries,
    homeInjuries,
    awayInjuryImpact,
    homeInjuryImpact,
  };
}
