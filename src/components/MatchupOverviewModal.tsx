import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { getNBATeamColors } from '@/utils/teamColors';

interface InjuryReport {
  player_name: string;
  avg_pie_season: string | number | null;
  status: string;
  team_id: number;
  team_name: string;
  team_abbr: string;
}

interface GameTrends {
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

interface MatchupOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: number | null;
  gameDate: string;
  awayTeam: string;
  homeTeam: string;
  getTeamLogo: (teamName: string) => string;
}

export function MatchupOverviewModal({
  isOpen,
  onClose,
  gameId,
  gameDate,
  awayTeam,
  homeTeam,
  getTeamLogo,
}: MatchupOverviewModalProps) {
  const [injuryData, setInjuryData] = useState<InjuryReport[]>([]);
  const [trendsData, setTrendsData] = useState<GameTrends | null>(null);
  const [loading, setLoading] = useState(false);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔍 MatchupOverviewModal useEffect triggered');
    console.log('🔍 isOpen:', isOpen);
    console.log('🔍 awayTeam:', awayTeam);
    console.log('🔍 homeTeam:', homeTeam);
    console.log('🔍 gameDate:', gameDate);
    
    const hasTeams = !!(awayTeam && homeTeam);
    const hasDate = !!gameDate;
    const allConditionsMet = isOpen && hasTeams && hasDate;
    
    console.log('🔍 Condition check:');
    console.log('  - isOpen:', isOpen);
    console.log('  - hasTeams:', hasTeams);
    console.log('  - hasDate:', hasDate);
    console.log('  - allConditionsMet:', allConditionsMet);
    
    if (allConditionsMet) {
      console.log('🔍 ✅ Conditions met, calling fetchInjuryData and fetchTrendsData');
      fetchInjuryData();
      fetchTrendsData();
    } else {
      console.log('🔍 ❌ Conditions NOT met, resetting state');
      // Reset state when modal closes
      setInjuryData([]);
      setTrendsData(null);
      setError(null);
    }
  }, [isOpen, awayTeam, homeTeam, gameDate]);

  const fetchInjuryData = async () => {
    console.log('🔍 fetchInjuryData called');
    console.log('🔍 awayTeam:', awayTeam, 'homeTeam:', homeTeam, 'gameDate:', gameDate);
    
    if (!awayTeam || !homeTeam || !gameDate) {
      console.log('🔍 Early return - missing team names or game date');
      return;
    }

    console.log('🔍 Starting fetch...');
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching injury data by team_name and date');
      console.log('🔍 Game Date:', gameDate);
      console.log('🔍 Teams - Away:', awayTeam, 'Home:', homeTeam);

      // Format game_date from nba_input_values_view to match game_date_et format in nba_injury_report
      // game_date from nba_input_values_view should already be in YYYY-MM-DD format
      // Just extract the date part if it includes time, but don't parse as Date object to avoid timezone issues
      let normalizedDate = gameDate;
      
      // Extract just the date part if it includes time
      if (gameDate.includes('T')) {
        normalizedDate = gameDate.split('T')[0];
      } else if (gameDate.includes(' ')) {
        normalizedDate = gameDate.split(' ')[0];
      }
      
      // If it's already in YYYY-MM-DD format, use it as-is (don't parse with Date to avoid timezone shifts)
      // Just validate it looks like YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
        // If it's not in the right format, try to parse it
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

      console.log('🔍 Matching: game_date_et (injury_report) = game_date (nba_input_values_view)');
      console.log('🔍 Matching: team_name (injury_report) = away_team/home_team (nba_input_values_view)');
      console.log('🔍 game_date from nba_input_values_view:', gameDate);
      console.log('🔍 Normalized date for query:', normalizedDate);
      console.log('🔍 Matching team names:', [awayTeam, homeTeam]);

      // Query nba_injury_report:
      // - game_date_et = game_date (from nba_input_values_view)
      // - team_name IN (away_team, home_team) (from nba_input_values_view)
      // - bucket = 'current'
      const { data, error: fetchError } = await collegeFootballSupabase
        .from('nba_injury_report')
        .select('player_name, avg_pie_season, status, team_id, team_name, team_abbr, game_date_et')
        .in('team_name', [awayTeam, homeTeam])
        .eq('game_date_et', normalizedDate)
        .eq('bucket', 'current');

      console.log('🔍 Filtered injury data (team_name + date + bucket=current):', data?.length || 0, data);
      console.log('🔍 Fetch error:', fetchError);

      if (fetchError) {
        console.error('🔍 Error details:', fetchError);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      console.log('🔍 Setting injury data:', data);
      setInjuryData(data || []);
    } catch (err) {
      console.error('🔍 Exception:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch injury data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendsData = async () => {
    if (!awayTeam || !homeTeam || !gameDate) return;

    setTrendsLoading(true);

    try {
      console.log('🔍 Fetching trends data for:', awayTeam, 'vs', homeTeam, 'on', gameDate);

      // Format date to match nba_input_values_view format
      let normalizedDate = gameDate;
      if (gameDate.includes('T')) {
        normalizedDate = gameDate.split('T')[0];
      } else if (gameDate.includes(' ')) {
        normalizedDate = gameDate.split(' ')[0];
      }

      // Query nba_input_values_view for this specific game
      const { data, error: fetchError } = await collegeFootballSupabase
        .from('nba_input_values_view')
        .select('home_ovr_rtg, away_ovr_rtg, home_consistency, away_consistency, home_win_streak, away_win_streak, home_ats_pct, away_ats_pct, home_ats_streak, away_ats_streak, home_last_margin, away_last_margin, home_over_pct, away_over_pct, home_adj_pace_pregame_l3_trend, away_adj_pace_pregame_l3_trend, home_adj_off_rtg_pregame_l3_trend, away_adj_off_rtg_pregame_l3_trend, home_adj_def_rtg_pregame_l3_trend, away_adj_def_rtg_pregame_l3_trend')
        .eq('game_date', normalizedDate)
        .eq('away_team', awayTeam)
        .eq('home_team', homeTeam)
        .maybeSingle();

      console.log('🔍 Trends data fetched:', data);
      console.log('🔍 Trends fetch error:', fetchError);

      if (fetchError) {
        console.error('🔍 Error fetching trends:', fetchError);
      } else {
        setTrendsData(data as GameTrends | null);
      }
    } catch (err) {
      console.error('🔍 Exception fetching trends:', err);
    } finally {
      setTrendsLoading(false);
    }
  };

  // Group injuries by team_name (matching away_team and home_team)
  const awayInjuries = injuryData.filter((injury) => {
    if (!awayTeam || !injury.team_name) return false;
    // Exact match (case-insensitive)
    return injury.team_name.toLowerCase() === awayTeam.toLowerCase();
  });

  const homeInjuries = injuryData.filter((injury) => {
    if (!homeTeam || !injury.team_name) return false;
    // Exact match (case-insensitive)
    return injury.team_name.toLowerCase() === homeTeam.toLowerCase();
  });

  // Calculate cumulative Injury Impact Score (sum of inverse PIE values)
  const calculateInjuryImpact = (injuries: InjuryReport[]): number => {
    if (injuries.length === 0) return 0.0;
    return injuries.reduce((sum, injury) => {
      if (injury.avg_pie_season === null || injury.avg_pie_season === undefined) return sum;
      const pie = typeof injury.avg_pie_season === 'string' 
        ? parseFloat(injury.avg_pie_season) 
        : injury.avg_pie_season;
      return sum + (isNaN(pie) ? 0 : -pie);
    }, 0);
  };

  const awayInjuryImpact = calculateInjuryImpact(awayInjuries);
  const homeInjuryImpact = calculateInjuryImpact(homeInjuries);

  // Helper function to get color for trend values
  const getTrendColor = (
    awayValue: number | null,
    homeValue: number | null,
    metricName: string
  ): { awayColor: string; homeColor: string } => {
    // Over/Under % stays as is (no color conditioning)
    if (metricName === 'Over/Under %') {
      return { awayColor: 'inherit', homeColor: 'inherit' };
    }

    // Defensive Rating Trend: lower is better (green), higher is worse (red)
    if (metricName === 'Defensive Rating Trend (Last 3)') {
      if (awayValue === null || homeValue === null) {
        return { awayColor: 'inherit', homeColor: 'inherit' };
      }
      return {
        awayColor: awayValue < homeValue ? 'green' : awayValue > homeValue ? 'red' : 'inherit',
        homeColor: homeValue < awayValue ? 'green' : homeValue > awayValue ? 'red' : 'inherit',
      };
    }

    // All other metrics: higher is better (green), lower is worse (red)
    if (awayValue === null || homeValue === null) {
      return { awayColor: 'inherit', homeColor: 'inherit' };
    }
    return {
      awayColor: awayValue > homeValue ? 'green' : awayValue < homeValue ? 'red' : 'inherit',
      homeColor: homeValue > awayValue ? 'green' : homeValue < awayValue ? 'red' : 'inherit',
    };
  };

  // Debug logging
  useEffect(() => {
    if (injuryData.length > 0) {
      console.log('🔍 Injury data received:', injuryData);
      console.log('🔍 Away team:', awayTeam, 'Away injuries:', awayInjuries);
      console.log('🔍 Home team:', homeTeam, 'Home injuries:', homeInjuries);
      console.log('🔍 All team_names in injury data:', injuryData.map(i => ({ team_name: i.team_name })));
    }
  }, [injuryData, awayTeam, homeTeam, awayInjuries, homeInjuries]);

  // Format PIE as raw value
  const formatPIE = (pie: string | number | null): string => {
    if (pie === null || pie === undefined) return 'N/A';
    const pieNum = typeof pie === 'string' ? parseFloat(pie) : pie;
    if (isNaN(pieNum)) return 'N/A';
    return pieNum.toFixed(4);
  };

  // Sort by PIE (highest first)
  const sortByPIE = (injuries: InjuryReport[]): InjuryReport[] => {
    return [...injuries].sort((a, b) => {
      const pieA = a.avg_pie_season === null || a.avg_pie_season === undefined 
        ? null 
        : typeof a.avg_pie_season === 'string' 
          ? parseFloat(a.avg_pie_season) 
          : a.avg_pie_season;
      const pieB = b.avg_pie_season === null || b.avg_pie_season === undefined 
        ? null 
        : typeof b.avg_pie_season === 'string' 
          ? parseFloat(b.avg_pie_season) 
          : b.avg_pie_season;
      const valueA = pieA === null || isNaN(pieA) ? -Infinity : pieA;
      const valueB = pieB === null || isNaN(pieB) ? -Infinity : pieB;
      return valueB - valueA;
    });
  };

  const awayTeamColors = getNBATeamColors(awayTeam);
  const homeTeamColors = getNBATeamColors(homeTeam);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Matchup Overview</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-6 mt-4">
            {/* Away Team Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            {/* Home Team Skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="px-3 py-2 bg-muted/50 border-b">
                <div className="flex items-center justify-center">
                  <h3 className="text-xl font-bold text-white">Injury Report</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 p-4">
                {/* Away Team */}
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2 mb-4">
                    <img
                      src={getTeamLogo(awayTeam)}
                      alt={awayTeam}
                      className="w-12 h-12 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <h3 className="text-lg font-semibold text-center">{awayTeam}</h3>
                  </div>
                  {awayInjuries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center">No injuries reported</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      {/* Table Header */}
                      <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                        <div>Player</div>
                        <div>Status</div>
                        <div className="text-right">PIE</div>
                      </div>
                      {/* Table Rows */}
                      <div className="divide-y">
                        {sortByPIE(awayInjuries).map((injury, index) => (
                          <div
                            key={`${injury.player_name}-${index}`}
                            className="grid grid-cols-[1fr_80px_80px] gap-2 px-3 py-2 text-sm hover:bg-muted/30"
                          >
                            <div className="font-medium truncate">{injury.player_name}</div>
                            <div className="text-muted-foreground truncate">{injury.status}</div>
                            <div
                              className="font-semibold text-right"
                              style={{ color: awayTeamColors.primary }}
                            >
                              {formatPIE(injury.avg_pie_season)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Home Team */}
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2 mb-4">
                    <img
                      src={getTeamLogo(homeTeam)}
                      alt={homeTeam}
                      className="w-12 h-12 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <h3 className="text-lg font-semibold text-center">{homeTeam}</h3>
                  </div>
                  {homeInjuries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center">No injuries reported</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      {/* Table Header */}
                      <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                        <div>Player</div>
                        <div>Status</div>
                        <div className="text-right">PIE</div>
                      </div>
                      {/* Table Rows */}
                      <div className="divide-y">
                        {sortByPIE(homeInjuries).map((injury, index) => (
                          <div
                            key={`${injury.player_name}-${index}`}
                            className="grid grid-cols-[1fr_80px_80px] gap-2 px-3 py-2 text-sm hover:bg-muted/30"
                          >
                            <div className="font-medium truncate">{injury.player_name}</div>
                            <div className="text-muted-foreground truncate">{injury.status}</div>
                            <div
                              className="font-semibold text-right"
                              style={{ color: homeTeamColors.primary }}
                            >
                              {formatPIE(injury.avg_pie_season)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Cumulative Injury Impact Scores */}
              <div className="border-t">
                {/* Header */}
                <div className="px-3 py-2 bg-muted/50 border-b">
                  <div className="text-center">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Cumulative Injury Impact Score
                    </h4>
                  </div>
                </div>
                {/* Scores Row */}
                <div className="grid grid-cols-2 gap-6 px-4 py-3 text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <img
                      src={getTeamLogo(awayTeam)}
                      alt={awayTeam}
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <span
                      className="font-semibold text-lg"
                      style={{ 
                        color: awayInjuryImpact < homeInjuryImpact ? 'red' : 
                               awayInjuryImpact > homeInjuryImpact ? 'green' : 
                               'inherit'
                      }}
                    >
                      {awayInjuryImpact.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <img
                      src={getTeamLogo(homeTeam)}
                      alt={homeTeam}
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <span
                      className="font-semibold text-lg"
                      style={{ 
                        color: homeInjuryImpact < awayInjuryImpact ? 'red' : 
                               homeInjuryImpact > awayInjuryImpact ? 'green' : 
                               'inherit'
                      }}
                    >
                      {homeInjuryImpact.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Trends Section */}
        {trendsData && (
          <div className="mt-8 space-y-4">
            <div className="border rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[120px_1fr_120px] gap-2 px-3 py-2 bg-muted/50 border-b">
                <div className="flex items-center justify-center">
                  <img
                    src={getTeamLogo(awayTeam)}
                    alt={awayTeam}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
                <div className="flex items-center justify-center">
                  <h3 className="text-xl font-bold text-white">Recent Trends</h3>
                </div>
                <div className="flex items-center justify-center">
                  <img
                    src={getTeamLogo(homeTeam)}
                    alt={homeTeam}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
              {/* Table Rows */}
              <div className="divide-y">
                {/* Overall Rating */}
                {(() => {
                  const colors = getTrendColor(trendsData.away_ovr_rtg, trendsData.home_ovr_rtg, 'Overall Rating');
                  return (
                    <div className="grid grid-cols-[120px_1fr_120px] gap-2 px-3 py-2 text-sm">
                      <div className="text-center font-bold text-base" style={{ color: colors.awayColor }}>{trendsData.away_ovr_rtg !== null ? trendsData.away_ovr_rtg.toFixed(2) : '-'}</div>
                      <div className="font-bold text-center">Overall Rating</div>
                      <div className="text-center font-bold text-base" style={{ color: colors.homeColor }}>{trendsData.home_ovr_rtg !== null ? trendsData.home_ovr_rtg.toFixed(2) : '-'}</div>
                    </div>
                  );
                })()}
                {/* Consistency Rating */}
                {(() => {
                  const colors = getTrendColor(trendsData.away_consistency, trendsData.home_consistency, 'Consistency Rating');
                  return (
                    <div className="grid grid-cols-[120px_1fr_120px] gap-2 px-3 py-2 text-sm">
                      <div className="text-center font-bold text-base" style={{ color: colors.awayColor }}>{trendsData.away_consistency !== null ? trendsData.away_consistency.toFixed(2) : '-'}</div>
                      <div className="font-bold text-center">Consistency Rating</div>
                      <div className="text-center font-bold text-base" style={{ color: colors.homeColor }}>{trendsData.home_consistency !== null ? trendsData.home_consistency.toFixed(2) : '-'}</div>
                    </div>
                  );
                })()}
                {/* Win Streak */}
                {(() => {
                  const colors = getTrendColor(trendsData.away_win_streak, trendsData.home_win_streak, 'Win Streak');
                  return (
                    <div className="grid grid-cols-[120px_1fr_120px] gap-2 px-3 py-2 text-sm">
                      <div className="text-center font-bold text-base" style={{ color: colors.awayColor }}>{trendsData.away_win_streak !== null ? trendsData.away_win_streak : '-'}</div>
                      <div className="font-bold text-center">Win Streak</div>
                      <div className="text-center font-bold text-base" style={{ color: colors.homeColor }}>{trendsData.home_win_streak !== null ? trendsData.home_win_streak : '-'}</div>
                    </div>
                  );
                })()}
                {/* ATS % */}
                {(() => {
                  const colors = getTrendColor(trendsData.away_ats_pct, trendsData.home_ats_pct, 'ATS %');
                  return (
                    <div className="grid grid-cols-[120px_1fr_120px] gap-2 px-3 py-2 text-sm">
                      <div className="text-center font-bold text-base" style={{ color: colors.awayColor }}>{trendsData.away_ats_pct !== null ? `${(trendsData.away_ats_pct * 100).toFixed(1)}%` : '-'}</div>
                      <div className="font-bold text-center">ATS %</div>
                      <div className="text-center font-bold text-base" style={{ color: colors.homeColor }}>{trendsData.home_ats_pct !== null ? `${(trendsData.home_ats_pct * 100).toFixed(1)}%` : '-'}</div>
                    </div>
                  );
                })()}
                {/* ATS Streak */}
                {(() => {
                  const colors = getTrendColor(trendsData.away_ats_streak, trendsData.home_ats_streak, 'ATS Streak');
                  return (
                    <div className="grid grid-cols-[120px_1fr_120px] gap-2 px-3 py-2 text-sm">
                      <div className="text-center font-bold text-base" style={{ color: colors.awayColor }}>{trendsData.away_ats_streak !== null ? trendsData.away_ats_streak : '-'}</div>
                      <div className="font-bold text-center">ATS Streak</div>
                      <div className="text-center font-bold text-base" style={{ color: colors.homeColor }}>{trendsData.home_ats_streak !== null ? trendsData.home_ats_streak : '-'}</div>
                    </div>
                  );
                })()}
                {/* Last Game Score Margin */}
                {(() => {
                  const colors = getTrendColor(trendsData.away_last_margin, trendsData.home_last_margin, 'Last Game Score Margin');
                  return (
                    <div className="grid grid-cols-[120px_1fr_120px] gap-2 px-3 py-2 text-sm">
                      <div className="text-center font-bold text-base" style={{ color: colors.awayColor }}>{trendsData.away_last_margin !== null ? trendsData.away_last_margin.toFixed(1) : '-'}</div>
                      <div className="font-bold text-center">Last Game Score Margin</div>
                      <div className="text-center font-bold text-base" style={{ color: colors.homeColor }}>{trendsData.home_last_margin !== null ? trendsData.home_last_margin.toFixed(1) : '-'}</div>
                    </div>
                  );
                })()}
                {/* Over/Under % */}
                {(() => {
                  const colors = getTrendColor(trendsData.away_over_pct, trendsData.home_over_pct, 'Over/Under %');
                  return (
                    <div className="grid grid-cols-[120px_1fr_120px] gap-2 px-3 py-2 text-sm">
                      <div className="text-center font-bold text-base" style={{ color: colors.awayColor }}>{trendsData.away_over_pct !== null ? `${(trendsData.away_over_pct * 100).toFixed(1)}%` : '-'}</div>
                      <div className="font-bold text-center">Over/Under %</div>
                      <div className="text-center font-bold text-base" style={{ color: colors.homeColor }}>{trendsData.home_over_pct !== null ? `${(trendsData.home_over_pct * 100).toFixed(1)}%` : '-'}</div>
                    </div>
                  );
                })()}
                {/* Pace Trend Last 3 */}
                {(() => {
                  const colors = getTrendColor(trendsData.away_adj_pace_pregame_l3_trend, trendsData.home_adj_pace_pregame_l3_trend, 'Pace Trend (Last 3)');
                  return (
                    <div className="grid grid-cols-[120px_1fr_120px] gap-2 px-3 py-2 text-sm">
                      <div className="text-center font-bold text-base" style={{ color: colors.awayColor }}>{trendsData.away_adj_pace_pregame_l3_trend !== null ? trendsData.away_adj_pace_pregame_l3_trend.toFixed(2) : '-'}</div>
                      <div className="font-bold text-center">Pace Trend (Last 3)</div>
                      <div className="text-center font-bold text-base" style={{ color: colors.homeColor }}>{trendsData.home_adj_pace_pregame_l3_trend !== null ? trendsData.home_adj_pace_pregame_l3_trend.toFixed(2) : '-'}</div>
                    </div>
                  );
                })()}
                {/* Offensive Rating Trend Last 3 */}
                {(() => {
                  const colors = getTrendColor(trendsData.away_adj_off_rtg_pregame_l3_trend, trendsData.home_adj_off_rtg_pregame_l3_trend, 'Offensive Rating Trend (Last 3)');
                  return (
                    <div className="grid grid-cols-[120px_1fr_120px] gap-2 px-3 py-2 text-sm">
                      <div className="text-center font-bold text-base" style={{ color: colors.awayColor }}>{trendsData.away_adj_off_rtg_pregame_l3_trend !== null ? trendsData.away_adj_off_rtg_pregame_l3_trend.toFixed(2) : '-'}</div>
                      <div className="font-bold text-center">Offensive Rating Trend (Last 3)</div>
                      <div className="text-center font-bold text-base" style={{ color: colors.homeColor }}>{trendsData.home_adj_off_rtg_pregame_l3_trend !== null ? trendsData.home_adj_off_rtg_pregame_l3_trend.toFixed(2) : '-'}</div>
                    </div>
                  );
                })()}
                {/* Defensive Rating Trend Last 3 */}
                {(() => {
                  const colors = getTrendColor(trendsData.away_adj_def_rtg_pregame_l3_trend, trendsData.home_adj_def_rtg_pregame_l3_trend, 'Defensive Rating Trend (Last 3)');
                  return (
                    <div className="grid grid-cols-[120px_1fr_120px] gap-2 px-3 py-2 text-sm">
                      <div className="text-center font-bold text-base" style={{ color: colors.awayColor }}>{trendsData.away_adj_def_rtg_pregame_l3_trend !== null ? trendsData.away_adj_def_rtg_pregame_l3_trend.toFixed(2) : '-'}</div>
                      <div className="font-bold text-center">Defensive Rating Trend (Last 3)</div>
                      <div className="text-center font-bold text-base" style={{ color: colors.homeColor }}>{trendsData.home_adj_def_rtg_pregame_l3_trend !== null ? trendsData.home_adj_def_rtg_pregame_l3_trend.toFixed(2) : '-'}</div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {trendsLoading && (
          <div className="mt-8">
            <Skeleton className="h-64 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

