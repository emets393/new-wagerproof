
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
  teams: string[];
  gameLocation: 'all' | 'home' | 'away';
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

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics', filters],
    queryFn: async () => {
      console.log('Fetching analytics data with filters:', filters);
      
      // For now, let's get sample data from one of the team tables
      const { data, error } = await supabase
        .from('angels_games')
        .select('*')
        .limit(100);

      if (error) {
        console.error('Error fetching analytics data:', error);
        throw error;
      }

      // Calculate sample stats
      const totalGames = data.length;
      const wins = data.filter(game => game.win_loss === 'W').length;
      const overs = data.filter(game => game.ou_result === 1).length;
      
      return {
        totalGames,
        winPercentage: totalGames > 0 ? (wins / totalGames) * 100 : 0,
        runlinePercentage: 65.4, // Sample data
        overUnderPercentage: totalGames > 0 ? (overs / totalGames) * 100 : 0,
        teamBreakdown: [
          {
            team: 'Angels',
            games: totalGames,
            winPct: totalGames > 0 ? (wins / totalGames) * 100 : 0,
            runlinePct: 65.4,
            overPct: totalGames > 0 ? (overs / totalGames) * 100 : 0
          }
        ]
      };
    },
  });

  const handleFiltersChange = (newFilters: AnalyticsFilters) => {
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
                <p className="text-muted-foreground">Team performance analysis and betting insights</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="mb-8">
          <AnalyticsFilters filters={filters} onFiltersChange={handleFiltersChange} />
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
