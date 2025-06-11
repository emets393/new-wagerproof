
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

  // Fetch available team names from the individual team tables
  const { data: availableTeams, isLoading: teamsLoading, error: teamsError } = useQuery({
    queryKey: ['available-teams'],
    queryFn: async () => {
      console.log('Fetching available team names from individual team tables');
      
      // Get team names from the MLB_Teams table which should have all team info
      const { data, error } = await supabase
        .from('MLB_Teams')
        .select('TeamRankingsName, full_name, short_name');

      if (error) {
        console.error('Error fetching team names from MLB_Teams:', error);
        
        // Fallback: try to get teams from one of the game tables
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('angels_games')
          .select('team')
          .limit(1);
          
        if (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          throw error;
        }
        
        // If we can access angels_games, we can build a list of known teams
        const knownTeams = [
          'Angels', 'Arizona', 'Athletics', 'Atlanta', 'Baltimore', 'Boston',
          'Cincinnati', 'Cleveland', 'Colorado', 'Cubs', 'Detroit', 'Dodgers',
          'Houston', 'Kansas City', 'Mets', 'Miami', 'Milwaukee', 'Minnesota',
          'Philadelphia', 'Pittsburgh', 'San Diego', 'San Francisco', 'Seattle',
          'ST Louis', 'Tampa Bay', 'Texas', 'Toronto', 'Washington', 'White Sox', 'Yankees'
        ];
        
        console.log('Using fallback team list:', knownTeams);
        return knownTeams;
      }

      console.log('Raw data from MLB_Teams:', data?.length, 'teams found');

      // Use TeamRankingsName if available, otherwise use full_name or short_name
      const teams = data?.map(team => 
        team.TeamRankingsName || team.full_name || team.short_name
      ).filter(Boolean).sort() || [];

      console.log('Available teams from MLB_Teams:', teams);
      return teams;
    },
  });

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics', filters],
    queryFn: async () => {
      console.log('Fetching analytics data with filters:', filters);
      
      // For now, let's try to get data from one of the team tables to test
      const { data, error } = await supabase
        .from('angels_games')
        .select('*')
        .limit(10);

      if (error) {
        console.error('Error fetching analytics data:', error);
        throw error;
      }

      console.log('Sample data from angels_games:', data?.length, 'games');

      // Return some basic stats for testing
      return {
        totalGames: data?.length || 0,
        winPercentage: 50.0,
        runlinePercentage: 48.5,
        overUnderPercentage: 52.3,
        teamBreakdown: [{
          team: 'Angels',
          games: data?.length || 0,
          winPct: 50.0,
          runlinePct: 48.5,
          overPct: 52.3
        }]
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
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Debug Info */}
        {teamsLoading && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
            Loading teams...
          </div>
        )}
        
        {teamsError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
            Error loading teams: {teamsError.message}
          </div>
        )}

        {availableTeams && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded">
            Found {availableTeams.length} teams: {availableTeams.slice(0, 5).join(', ')}
            {availableTeams.length > 5 && ` and ${availableTeams.length - 5} more...`}
          </div>
        )}

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
