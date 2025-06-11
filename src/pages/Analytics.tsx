
import { useState } from "react";
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

  // Simple test query to check if we can access training_data
  const { data: testData } = useQuery({
    queryKey: ['test-training-data-access'],
    queryFn: async () => {
      console.log('Testing direct access to training_data');
      
      // Try different approaches to access the data
      const approaches = [
        // Approach 1: Direct select all
        () => supabase.from('training_data').select('*').limit(5),
        // Approach 2: Count query
        () => supabase.from('training_data').select('*', { count: 'exact', head: true }),
        // Approach 3: Select specific columns that we know exist
        () => supabase.from('training_data').select('home_team, away_team, ha_winner').limit(5)
      ];
      
      for (let i = 0; i < approaches.length; i++) {
        console.log(`Trying approach ${i + 1}`);
        const { data, error, count } = await approaches[i]();
        console.log(`Approach ${i + 1} result:`, { data, error, count });
        
        if (!error && (data || count !== null)) {
          return { data, error, count, approach: i + 1 };
        }
      }
      
      return { data: null, error: 'All approaches failed', count: 0, approach: 0 };
    },
  });

  // Get filter options only if we can access the data
  const { data: filterOptions, isLoading: filtersLoading } = useQuery({
    queryKey: ['training-data-filter-options'],
    queryFn: async () => {
      console.log('Fetching filter options from training_data');
      
      const { data, error } = await supabase
        .from('training_data')
        .select('home_team, away_team, season, month, day, home_pitcher, away_pitcher, home_handedness, away_handedness, series_game_number')
        .limit(1000); // Limit for performance

      if (error) {
        console.error('Error fetching filter options:', error);
        throw error;
      }

      console.log('Filter data sample:', data?.slice(0, 3));

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

      // Extract unique values safely
      const getUniqueValues = (field: string, isNumeric = false) => {
        const values = data
          .map(item => item[field])
          .filter(val => val !== null && val !== undefined && val !== '')
          .filter(val => isNumeric ? !isNaN(Number(val)) : true);
        
        const unique = [...new Set(values)];
        return isNumeric ? unique.map(Number).sort((a, b) => a - b) : unique.sort();
      };

      const result = {
        homeTeams: getUniqueValues('home_team'),
        awayTeams: getUniqueValues('away_team'),
        seasons: getUniqueValues('season', true),
        months: getUniqueValues('month', true),
        days: getUniqueValues('day', true),
        homePitchers: getUniqueValues('home_pitcher'),
        awayPitchers: getUniqueValues('away_pitcher'),
        homeHandedness: getUniqueValues('home_handedness', true),
        awayHandedness: getUniqueValues('away_handedness', true),
        seriesGameNumbers: getUniqueValues('series_game_number', true)
      };

      console.log('Processed filter options:', result);
      return result;
    },
    enabled: !!testData?.data, // Only run if test query succeeded
  });

  // Get analytics data with filters applied
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['training-data-analytics', filters],
    queryFn: async () => {
      console.log('Fetching analytics data with filters:', filters);
      
      let query = supabase.from('training_data').select('*');

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

      // Calculate statistics
      const totalGames = data.length;
      const homeWins = data.filter(game => game.ha_winner === 1).length;
      const awayWins = data.filter(game => game.ha_winner === 0).length;
      const overs = data.filter(game => game.ou_result === 1).length;
      const unders = data.filter(game => game.ou_result === 0).length;
      const homeRLCovers = data.filter(game => game.run_line_winner === 1).length;
      const awayRLCovers = data.filter(game => game.run_line_winner === 0).length;

      // Team breakdown
      const teamStats = new Map();
      
      data.forEach(game => {
        [
          { team: game.home_team, isHome: true },
          { team: game.away_team, isHome: false }
        ].forEach(({ team, isHome }) => {
          if (!team) return;
          
          if (!teamStats.has(team)) {
            teamStats.set(team, {
              team,
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
          
          const stats = teamStats.get(team);
          
          if (isHome) {
            stats.homeGames++;
            if (game.ha_winner === 1) stats.homeWins++;
            if (game.run_line_winner === 1) stats.homeRLCovers++;
          } else {
            stats.awayGames++;
            if (game.ha_winner === 0) stats.awayWins++;
            if (game.run_line_winner === 0) stats.awayRLCovers++;
          }
          
          if (game.ou_result === 1) stats.overs++;
          if (game.ou_result === 0) stats.unders++;
        });
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
    enabled: !!testData?.data, // Only run if test query succeeded
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
          {testData && (
            <div className="text-muted-foreground">
              <p>Test query approach {testData.approach} succeeded</p>
              <p>Found {testData.count || testData.data?.length || 0} records</p>
            </div>
          )}
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
        {/* Debug info */}
        {testData && (
          <div className="mb-4 p-4 bg-muted rounded-lg">
            <p className="text-sm">
              Debug: Test approach {testData.approach} - Found {testData.count || testData.data?.length || 0} records
            </p>
            {testData.error && <p className="text-sm text-red-500">Error: {testData.error}</p>}
          </div>
        )}

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
