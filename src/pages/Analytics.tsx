
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
  teams: string[];
  gameLocation: 'all' | 'home' | 'away';
  season: string;
  dateRange: {
    start: string;
    end: string;
  };
  gameContext: {
    divisionalOnly: boolean;
    leagueOnly: boolean;
    playoffOnly: boolean;
  };
  performance: {
    minStreak: number;
    maxStreak: number;
  };
}

const Analytics = () => {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    teams: [],
    gameLocation: 'all',
    season: 'all',
    dateRange: {
      start: '',
      end: ''
    },
    gameContext: {
      divisionalOnly: false,
      leagueOnly: false,
      playoffOnly: false
    },
    performance: {
      minStreak: -10,
      maxStreak: 10
    }
  });

  // Fetch available team names from the database
  const { data: availableTeams } = useQuery({
    queryKey: ['available-teams'],
    queryFn: async () => {
      console.log('Fetching available team names from database');
      
      const { data, error } = await supabase
        .from('training_data')
        .select('home_team, away_team');

      if (error) {
        console.error('Error fetching team names:', error);
        throw error;
      }

      console.log('Raw data for teams:', data?.length, 'games found');

      // Extract unique team names
      const teamSet = new Set<string>();
      data?.forEach(game => {
        if (game.home_team) teamSet.add(game.home_team);
        if (game.away_team) teamSet.add(game.away_team);
      });

      const teams = Array.from(teamSet).sort();
      console.log('Available teams:', teams);
      return teams;
    },
  });

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics', filters],
    queryFn: async () => {
      console.log('Fetching analytics data with filters:', filters);
      
      // Get today's date for exclusion
      const today = new Date().toISOString().split('T')[0];
      
      // Start with base query - exclude today's games
      let query = supabase
        .from('training_data')
        .select('*')
        .lt('date', today);

      // Apply season filter
      if (filters.season !== 'all') {
        query = query.eq('season', parseInt(filters.season));
      }

      // Apply date range filters
      if (filters.dateRange.start) {
        query = query.gte('date', filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        query = query.lte('date', filters.dateRange.end);
      }

      console.log('Executing query with filters');
      
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching analytics data:', error);
        throw error;
      }

      console.log('Raw data retrieved:', data?.length, 'games');

      // Process the data to calculate team stats
      const teamStats = new Map();
      const overallStats = {
        totalGames: 0,
        totalWins: 0,
        totalRlCovers: 0,
        totalOvers: 0
      };

      data?.forEach(game => {
        // Process home team
        const homeTeam = game.home_team;
        const awayTeam = game.away_team;

        // Apply team filter
        const shouldIncludeHome = filters.teams.length === 0 || filters.teams.includes(homeTeam);
        const shouldIncludeAway = filters.teams.length === 0 || filters.teams.includes(awayTeam);

        // Apply location filter and process home team stats
        if ((filters.gameLocation === 'all' || filters.gameLocation === 'home') && shouldIncludeHome) {
          if (!teamStats.has(homeTeam)) {
            teamStats.set(homeTeam, { games: 0, wins: 0, rlCovers: 0, overs: 0 });
          }
          const homeStats = teamStats.get(homeTeam);
          homeStats.games++;
          if (game.ha_winner === 1) homeStats.wins++;
          if (game.run_line_winner === 1) homeStats.rlCovers++;
          if (game.ou_result === 1) homeStats.overs++;

          overallStats.totalGames++;
          if (game.ha_winner === 1) overallStats.totalWins++;
          if (game.run_line_winner === 1) overallStats.totalRlCovers++;
          if (game.ou_result === 1) overallStats.totalOvers++;
        }

        // Apply location filter and process away team stats
        if ((filters.gameLocation === 'all' || filters.gameLocation === 'away') && shouldIncludeAway) {
          if (!teamStats.has(awayTeam)) {
            teamStats.set(awayTeam, { games: 0, wins: 0, rlCovers: 0, overs: 0 });
          }
          const awayStats = teamStats.get(awayTeam);
          awayStats.games++;
          if (game.ha_winner === 0) awayStats.wins++;
          if (game.run_line_winner === 0) awayStats.rlCovers++;
          if (game.ou_result === 1) awayStats.overs++;

          // Only count in overall if we didn't already count it for home team
          if (filters.gameLocation === 'away' || !shouldIncludeHome) {
            overallStats.totalGames++;
            if (game.ha_winner === 0) overallStats.totalWins++;
            if (game.run_line_winner === 0) overallStats.totalRlCovers++;
            if (game.ou_result === 1) overallStats.totalOvers++;
          }
        }
      });

      // Convert team stats to array and calculate percentages
      const teamBreakdown = Array.from(teamStats.entries()).map(([team, stats]) => ({
        team,
        games: stats.games,
        winPct: stats.games > 0 ? (stats.wins / stats.games) * 100 : 0,
        runlinePct: stats.games > 0 ? (stats.rlCovers / stats.games) * 100 : 0,
        overPct: stats.games > 0 ? (stats.overs / stats.games) * 100 : 0
      })).sort((a, b) => b.games - a.games);

      // Calculate overall percentages
      const winPercentage = overallStats.totalGames > 0 ? (overallStats.totalWins / overallStats.totalGames) * 100 : 0;
      const runlinePercentage = overallStats.totalGames > 0 ? (overallStats.totalRlCovers / overallStats.totalGames) * 100 : 0;
      const overUnderPercentage = overallStats.totalGames > 0 ? (overallStats.totalOvers / overallStats.totalGames) * 100 : 0;

      console.log('Calculated stats:', {
        totalGames: overallStats.totalGames,
        winPercentage,
        runlinePercentage,
        overUnderPercentage,
        teamCount: teamBreakdown.length
      });

      return {
        totalGames: overallStats.totalGames,
        winPercentage,
        runlinePercentage,
        overUnderPercentage,
        teamBreakdown
      };
    },
  });

  const handleFiltersChange = (newFilters: AnalyticsFilters) => {
    console.log('Filters changed:', newFilters);
    setFilters(newFilters);
  };

  if (isLoading) {
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
                <h1 className="text-2xl font-bold">MLB Analytics Dashboard</h1>
                <p className="text-muted-foreground">
                  Team performance analysis and betting insights
                  {filters.season !== 'all' && ` • ${filters.season} Season`}
                  <span className="text-xs"> (Excludes today's games)</span>
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
            availableTeams={availableTeams || []}
          />
        </div>

        {/* Hero Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Win Percentage"
            value={`${analyticsData?.winPercentage.toFixed(1)}%`}
            icon={Trophy}
            gradient="from-emerald-500 to-emerald-600"
            description={`${analyticsData?.totalGames} total games`}
          />
          <StatsCard
            title="Runline Cover %"
            value={`${analyticsData?.runlinePercentage.toFixed(1)}%`}
            icon={TrendingUp}
            gradient="from-blue-500 to-blue-600"
            description="Above/below spread"
          />
          <StatsCard
            title="Over/Under Hit Rate"
            value={`${analyticsData?.overUnderPercentage.toFixed(1)}%`}
            icon={BarChart3}
            gradient="from-purple-500 to-purple-600"
            description="Total prediction accuracy"
          />
          <StatsCard
            title="Total Games"
            value={analyticsData?.totalGames.toString() || "0"}
            icon={Calendar}
            gradient="from-orange-500 to-orange-600"
            description="Matching your filters"
          />
        </div>

        {/* Analytics Table */}
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
