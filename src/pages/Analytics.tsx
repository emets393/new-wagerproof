import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, TrendingUp, BarChart3, Calendar } from "lucide-react";
import AnalyticsFilters from "@/components/AnalyticsFilters";
import StatsCard from "@/components/StatsCard";
import AnalyticsTable from "@/components/AnalyticsTable";

export interface AnalyticsFilters {
  homeTeams: string[];
  awayTeams: string[];
  seasons: number[];
  months: number[];
  days: number[];
  homePitchers: string[];
  awayPitchers: string[];
  homeHandedness: number[];
  awayHandedness: number[];
  sameLeague: boolean | null;
  sameDivision: boolean | null;
  seriesGameNumbers: number[];
  dateRange: {
    start: string;
    end: string;
  };
  homeEraRange: {
    min: number | null;
    max: number | null;
  };
  awayEraRange: {
    min: number | null;
    max: number | null;
  };
  homeWhipRange: {
    min: number | null;
    max: number | null;
  };
  awayWhipRange: {
    min: number | null;
    max: number | null;
  };
  homeWinPctRange: {
    min: number | null;
    max: number | null;
  };
  awayWinPctRange: {
    min: number | null;
    max: number | null;
  };
  ouLineRange: {
    min: number | null;
    max: number | null;
  };
}

const Analytics = () => {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    homeTeams: [],
    awayTeams: [],
    seasons: [],
    months: [],
    days: [],
    homePitchers: [],
    awayPitchers: [],
    homeHandedness: [],
    awayHandedness: [],
    sameLeague: null,
    sameDivision: null,
    seriesGameNumbers: [],
    dateRange: {
      start: '',
      end: ''
    },
    homeEraRange: {
      min: null,
      max: null
    },
    awayEraRange: {
      min: null,
      max: null
    },
    homeWhipRange: {
      min: null,
      max: null
    },
    awayWhipRange: {
      min: null,
      max: null
    },
    homeWinPctRange: {
      min: null,
      max: null
    },
    awayWinPctRange: {
      min: null,
      max: null
    },
    ouLineRange: {
      min: null,
      max: null
    }
  });

  // Fetch filter options from training_data
  const { data: filterOptions, isLoading: filtersLoading } = useQuery({
    queryKey: ['training-data-filters'],
    queryFn: async () => {
      console.log('Fetching filter options from training_data');
      
      // First, let's see what data exists
      const { data: sampleData, error: sampleError } = await supabase
        .from('training_data')
        .select('*')
        .limit(5);
      
      console.log('Sample training_data:', sampleData);
      if (sampleError) console.error('Sample data error:', sampleError);

      const { data, error } = await supabase
        .from('training_data')
        .select(`
          home_team,
          away_team,
          season,
          month,
          day,
          home_pitcher,
          away_pitcher,
          home_handedness,
          away_handedness,
          same_league,
          same_division,
          series_game_number
        `);

      if (error) {
        console.error('Error fetching filter options:', error);
        throw error;
      }

      console.log('Filter data fetched:', data?.length, 'records');

      if (!data || data.length === 0) {
        return {
          homeTeams: [],
          awayTeams: [],
          seasons: [],
          months: [],
          days: [],
          homePitchers: [],
          awayPitchers: [],
          homeHandedness: [],
          awayHandedness: [],
          seriesGameNumbers: []
        };
      }

      // Extract unique values for filters, filtering out null/empty values more carefully
      const homeTeams = [...new Set(data.map(d => d.home_team).filter(team => team && typeof team === 'string' && team.trim() !== ''))].sort();
      const awayTeams = [...new Set(data.map(d => d.away_team).filter(team => team && typeof team === 'string' && team.trim() !== ''))].sort();
      const seasons = [...new Set(data.map(d => d.season).filter(s => s !== null && s !== undefined && typeof s === 'number'))].sort();
      const months = [...new Set(data.map(d => d.month).filter(m => m !== null && m !== undefined && typeof m === 'number'))].sort();
      const days = [...new Set(data.map(d => d.day).filter(d => d !== null && d !== undefined && typeof d === 'number'))].sort();
      const homePitchers = [...new Set(data.map(d => d.home_pitcher).filter(p => p && typeof p === 'string' && p.trim() !== ''))].sort();
      const awayPitchers = [...new Set(data.map(d => d.away_pitcher).filter(p => p && typeof p === 'string' && p.trim() !== ''))].sort();
      const homeHandedness = [...new Set(data.map(d => d.home_handedness).filter(h => h !== null && h !== undefined && typeof h === 'number'))].sort();
      const awayHandedness = [...new Set(data.map(d => d.away_handedness).filter(h => h !== null && h !== undefined && typeof h === 'number'))].sort();
      const seriesGameNumbers = [...new Set(data.map(d => d.series_game_number).filter(s => s !== null && s !== undefined && typeof s === 'number'))].sort();

      return {
        homeTeams,
        awayTeams,
        seasons,
        months,
        days,
        homePitchers,
        awayPitchers,
        homeHandedness,
        awayHandedness,
        seriesGameNumbers
      };
    },
  });

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['training-data-analytics', filters],
    queryFn: async () => {
      console.log('Fetching analytics data with filters:', filters);
      
      let query = supabase
        .from('training_data')
        .select('*');

      // Apply filters only if they have values
      if (filters.homeTeams.length > 0) {
        query = query.in('home_team', filters.homeTeams);
      }
      if (filters.awayTeams.length > 0) {
        query = query.in('away_team', filters.awayTeams);
      }
      if (filters.seasons.length > 0) {
        query = query.in('season', filters.seasons);
      }
      if (filters.months.length > 0) {
        query = query.in('month', filters.months);
      }
      if (filters.days.length > 0) {
        query = query.in('day', filters.days);
      }
      if (filters.homePitchers.length > 0) {
        query = query.in('home_pitcher', filters.homePitchers);
      }
      if (filters.awayPitchers.length > 0) {
        query = query.in('away_pitcher', filters.awayPitchers);
      }
      if (filters.homeHandedness.length > 0) {
        query = query.in('home_handedness', filters.homeHandedness);
      }
      if (filters.awayHandedness.length > 0) {
        query = query.in('away_handedness', filters.awayHandedness);
      }
      if (filters.sameLeague !== null) {
        query = query.eq('same_league', filters.sameLeague ? 1 : 0);
      }
      if (filters.sameDivision !== null) {
        query = query.eq('same_division', filters.sameDivision ? 1 : 0);
      }
      if (filters.seriesGameNumbers.length > 0) {
        query = query.in('series_game_number', filters.seriesGameNumbers);
      }

      // Apply range filters
      if (filters.homeEraRange.min !== null) {
        query = query.gte('home_era', filters.homeEraRange.min);
      }
      if (filters.homeEraRange.max !== null) {
        query = query.lte('home_era', filters.homeEraRange.max);
      }
      if (filters.awayEraRange.min !== null) {
        query = query.gte('away_era', filters.awayEraRange.min);
      }
      if (filters.awayEraRange.max !== null) {
        query = query.lte('away_era', filters.awayEraRange.max);
      }
      if (filters.homeWhipRange.min !== null) {
        query = query.gte('home_whip', filters.homeWhipRange.min);
      }
      if (filters.homeWhipRange.max !== null) {
        query = query.lte('home_whip', filters.homeWhipRange.max);
      }
      if (filters.awayWhipRange.min !== null) {
        query = query.gte('away_whip', filters.awayWhipRange.min);
      }
      if (filters.awayWhipRange.max !== null) {
        query = query.lte('away_whip', filters.awayWhipRange.max);
      }
      if (filters.homeWinPctRange.min !== null) {
        query = query.gte('home_win_pct', filters.homeWinPctRange.min);
      }
      if (filters.homeWinPctRange.max !== null) {
        query = query.lte('home_win_pct', filters.homeWinPctRange.max);
      }
      if (filters.awayWinPctRange.min !== null) {
        query = query.gte('away_win_pct', filters.awayWinPctRange.min);
      }
      if (filters.awayWinPctRange.max !== null) {
        query = query.lte('away_win_pct', filters.awayWinPctRange.max);
      }
      if (filters.ouLineRange.min !== null) {
        query = query.gte('o_u_line', filters.ouLineRange.min);
      }
      if (filters.ouLineRange.max !== null) {
        query = query.lte('o_u_line', filters.ouLineRange.max);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching analytics data:', error);
        throw error;
      }

      console.log('Analytics data fetched:', data?.length, 'games');

      if (!data || data.length === 0) {
        return {
          totalGames: 0,
          homeWinPercentage: 0,
          awayWinPercentage: 0,
          overPercentage: 0,
          underPercentage: 0,
          homeRunlineCoverPercentage: 0,
          awayRunlineCoverPercentage: 0,
          teamBreakdown: []
        };
      }

      // Calculate percentages
      const totalGames = data.length;
      const homeWins = data.filter(game => game.ha_winner === 1).length;
      const awayWins = data.filter(game => game.ha_winner === 0).length;
      const overs = data.filter(game => game.ou_result === 1).length;
      const unders = data.filter(game => game.ou_result === 0).length;
      const homeRLCovers = data.filter(game => game.run_line_winner === 1).length;
      const awayRLCovers = data.filter(game => game.run_line_winner === 0).length;

      // Calculate team breakdown
      const teamStats = new Map();
      
      data.forEach(game => {
        // Home team stats
        if (game.home_team && typeof game.home_team === 'string') {
          if (!teamStats.has(game.home_team)) {
            teamStats.set(game.home_team, {
              team: game.home_team,
              homeGames: 0,
              awayGames: 0,
              homeWins: 0,
              awayWins: 0,
              homeRLCovers: 0,
              awayRLCovers: 0,
              overs: 0,
              unders: 0
            });
          }
          
          const homeTeamStat = teamStats.get(game.home_team);
          homeTeamStat.homeGames++;
          if (game.ha_winner === 1) homeTeamStat.homeWins++;
          if (game.run_line_winner === 1) homeTeamStat.homeRLCovers++;
          if (game.ou_result === 1) homeTeamStat.overs++;
          if (game.ou_result === 0) homeTeamStat.unders++;
        }

        // Away team stats
        if (game.away_team && typeof game.away_team === 'string') {
          if (!teamStats.has(game.away_team)) {
            teamStats.set(game.away_team, {
              team: game.away_team,
              homeGames: 0,
              awayGames: 0,
              homeWins: 0,
              awayWins: 0,
              homeRLCovers: 0,
              awayRLCovers: 0,
              overs: 0,
              unders: 0
            });
          }
          
          const awayTeamStat = teamStats.get(game.away_team);
          awayTeamStat.awayGames++;
          if (game.ha_winner === 0) awayTeamStat.awayWins++;
          if (game.run_line_winner === 0) awayTeamStat.awayRLCovers++;
          if (game.ou_result === 1) awayTeamStat.overs++;
          if (game.ou_result === 0) awayTeamStat.unders++;
        }
      });

      const teamBreakdown = Array.from(teamStats.values()).map(team => ({
        team: team.team,
        games: team.homeGames + team.awayGames,
        homeWinPct: team.homeGames > 0 ? (team.homeWins / team.homeGames) * 100 : 0,
        awayWinPct: team.awayGames > 0 ? (team.awayWins / team.awayGames) * 100 : 0,
        homeRLPct: team.homeGames > 0 ? (team.homeRLCovers / team.homeGames) * 100 : 0,
        awayRLPct: team.awayGames > 0 ? (team.awayRLCovers / team.awayGames) * 100 : 0,
        overPct: (team.overs / (team.homeGames + team.awayGames)) * 100
      })).sort((a, b) => b.games - a.games);

      return {
        totalGames,
        homeWinPercentage: totalGames > 0 ? (homeWins / totalGames) * 100 : 0,
        awayWinPercentage: totalGames > 0 ? (awayWins / totalGames) * 100 : 0,
        overPercentage: totalGames > 0 ? (overs / totalGames) * 100 : 0,
        underPercentage: totalGames > 0 ? (unders / totalGames) * 100 : 0,
        homeRunlineCoverPercentage: totalGames > 0 ? (homeRLCovers / totalGames) * 100 : 0,
        awayRunlineCoverPercentage: totalGames > 0 ? (awayRLCovers / totalGames) * 100 : 0,
        teamBreakdown
      };
    },
  });

  const handleFiltersChange = (newFilters: AnalyticsFilters) => {
    console.log('Filters changed:', newFilters);
    setFilters(newFilters);
  };

  if (isLoading || filtersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Loading Analytics...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Games
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">MLB Training Data Analytics</h1>
                <p className="text-muted-foreground">
                  Comprehensive analysis of historical game data and betting outcomes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="mb-8">
          <AnalyticsFilters 
            filters={filters} 
            onFiltersChange={handleFiltersChange}
            filterOptions={filterOptions || {}}
          />
        </div>

        {/* Hero Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Home Win %"
            value={`${analyticsData?.homeWinPercentage.toFixed(1)}%`}
            icon={Trophy}
            gradient="from-emerald-500 to-emerald-600"
            description={`${analyticsData?.totalGames} total games`}
          />
          <StatsCard
            title="Away Win %"
            value={`${analyticsData?.awayWinPercentage.toFixed(1)}%`}
            icon={Trophy}
            gradient="from-blue-500 to-blue-600"
            description="Away team victories"
          />
          <StatsCard
            title="Over Hit Rate"
            value={`${analyticsData?.overPercentage.toFixed(1)}%`}
            icon={TrendingUp}
            gradient="from-purple-500 to-purple-600"
            description="Games going over total"
          />
          <StatsCard
            title="Under Hit Rate"
            value={`${analyticsData?.underPercentage.toFixed(1)}%`}
            icon={BarChart3}
            gradient="from-orange-500 to-orange-600"
            description="Games going under total"
          />
        </div>

        {/* Additional Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <StatsCard
            title="Home Runline Cover %"
            value={`${analyticsData?.homeRunlineCoverPercentage.toFixed(1)}%`}
            icon={Calendar}
            gradient="from-green-500 to-green-600"
            description="Home teams covering runline"
          />
          <StatsCard
            title="Away Runline Cover %"
            value={`${analyticsData?.awayRunlineCoverPercentage.toFixed(1)}%`}
            icon={Calendar}
            gradient="from-red-500 to-red-600"
            description="Away teams covering runline"
          />
        </div>

        {/* Team Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle>Team Performance Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalyticsTable data={analyticsData?.teamBreakdown || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
