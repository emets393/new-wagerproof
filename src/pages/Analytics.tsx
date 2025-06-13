
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, TrendingUp, BarChart3, BarChart4 } from "lucide-react";
import AnalyticsFilters from "@/components/AnalyticsFilters";
import StatsCard from "@/components/StatsCard";

// Define your filter state shape
interface Filters {
  home_team?: string;
  away_team?: string;
  series_game_number?: number;
  home_pitcher?: string;
  away_pitcher?: string;
  home_handedness?: number;
  away_handedness?: number;
  season?: number;
  month?: number;
  day?: number;
  era_min?: number;
}

// Shape of dropdown options
interface FilterOptions {
  homeTeams: string[];
  awayTeams: string[];
  seasons: number[];
  months: number[];
  days: number[];
  homePitchers: string[];
  awayPitchers: string[];
  homeHandedness: number[];
  awayHandedness: number[];
  seriesGameNumbers: number[];
}

// Shape of the aggregated stats
interface Stats {
  total_games: number;
  win_pct: number;
  loss_pct: number;
  runline_win_pct: number;
  runline_loss_pct: number;
  over_pct: number;
  under_pct: number;
}

export default function Analytics() {
  const [filters, setFilters] = useState<Filters>({});

  // Fetch filter dropdown options
  const { data: filterOptions, isLoading: optionsLoading, error: optionsError } = useQuery({
    queryKey: ['analytics-filter-options'],
    queryFn: async () => {
      console.log("Fetching filter options from training_data table...");
      
      const { data, error } = await supabase
        .from("training_data")
        .select("home_team,away_team,season,month,day,home_pitcher,away_pitcher,home_handedness,away_handedness,series_game_number")
        .limit(1000);
      
      if (error) {
        console.error("Error fetching filter options:", error);
        throw error;
      }
      
      console.log("Raw filter data:", data?.slice(0, 5));
      
      if (!data || data.length === 0) {
        console.warn("No data found in training_data table");
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
          seriesGameNumbers: [],
        };
      }

      const uniq = <T extends string | number>(arr: T[]) => Array.from(new Set(arr.filter(Boolean)));
      
      const options = {
        homeTeams: uniq(data.map(r => r.home_team).filter(Boolean)),
        awayTeams: uniq(data.map(r => r.away_team).filter(Boolean)),
        seasons: uniq(data.map(r => r.season).filter(s => s != null)),
        months: uniq(data.map(r => r.month).filter(m => m != null)),
        days: uniq(data.map(r => r.day).filter(d => d != null)),
        homePitchers: uniq(data.map(r => r.home_pitcher).filter(Boolean)),
        awayPitchers: uniq(data.map(r => r.away_pitcher).filter(Boolean)),
        homeHandedness: uniq(data.map(r => r.home_handedness).filter(h => h != null)),
        awayHandedness: uniq(data.map(r => r.away_handedness).filter(h => h != null)),
        seriesGameNumbers: uniq(data.map(r => r.series_game_number).filter(g => g != null)),
      };
      
      console.log("Processed filter options:", {
        homeTeamsCount: options.homeTeams.length,
        awayTeamsCount: options.awayTeams.length,
        seasonsCount: options.seasons.length
      });
      
      return options;
    }
  });

  // Fetch aggregated stats
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['analytics-stats', filters],
    queryFn: async () => {
      console.log("Fetching stats with filters:", filters);
      
      let query = supabase.from("training_data").select("*");
      
      // Apply filters
      if (filters.home_team) {
        query = query.eq('home_team', filters.home_team);
      }
      if (filters.away_team) {
        query = query.eq('away_team', filters.away_team);
      }
      if (filters.season) {
        query = query.eq('season', filters.season);
      }
      if (filters.month) {
        query = query.eq('month', filters.month);
      }
      if (filters.day) {
        query = query.eq('day', filters.day);
      }
      if (filters.home_pitcher) {
        query = query.eq('home_pitcher', filters.home_pitcher);
      }
      if (filters.away_pitcher) {
        query = query.eq('away_pitcher', filters.away_pitcher);
      }
      if (filters.series_game_number) {
        query = query.eq('series_game_number', filters.series_game_number);
      }
      if (filters.home_handedness !== undefined) {
        query = query.eq('home_handedness', filters.home_handedness);
      }
      if (filters.away_handedness !== undefined) {
        query = query.eq('away_handedness', filters.away_handedness);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching training data:", error);
        throw error;
      }
      
      console.log(`Found ${data?.length || 0} total records`);
      
      if (!data || data.length === 0) {
        return {
          total_games: 0,
          win_pct: 0,
          loss_pct: 0,
          runline_win_pct: 0,
          runline_loss_pct: 0,
          over_pct: 0,
          under_pct: 0,
        };
      }

      // Calculate stats based on available data
      const total_games = data.length;
      
      // For win percentage, check if we have home_last_win and away_last_win
      const home_wins = data.filter(game => game.home_last_win === 1).length;
      const away_wins = data.filter(game => game.away_last_win === 1).length;
      const total_wins = home_wins + away_wins;
      const win_pct = total_games > 0 ? total_wins / total_games : 0;
      const loss_pct = 1 - win_pct;
      
      // For over/under, check if total_score vs o_u_line exists
      let over_count = 0;
      let under_count = 0;
      
      data.forEach(game => {
        if (game.total_score && game.o_u_line) {
          if (game.total_score > game.o_u_line) {
            over_count++;
          } else if (game.total_score < game.o_u_line) {
            under_count++;
          }
        }
      });
      
      const over_pct = total_games > 0 ? over_count / total_games : 0;
      const under_pct = total_games > 0 ? under_count / total_games : 0;
      
      // For runline, calculate based on home_runs vs away_runs with spread
      let rl_wins = 0;
      
      data.forEach(game => {
        if (game.home_runs !== null && game.away_runs !== null && game.home_rl) {
          const home_with_rl = game.home_runs + game.home_rl;
          if (home_with_rl > game.away_runs) {
            rl_wins++;
          }
        }
      });
      
      const runline_win_pct = total_games > 0 ? rl_wins / total_games : 0;
      const runline_loss_pct = 1 - runline_win_pct;

      const calculatedStats = {
        total_games,
        win_pct,
        loss_pct,
        runline_win_pct,
        runline_loss_pct,
        over_pct,
        under_pct,
      };
      
      console.log("Calculated stats:", calculatedStats);
      return calculatedStats;
    }
  });

  // Loading state
  if (optionsLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 border-b bg-card/50 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Games
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">MLB Training Data Analytics</h1>
              <p className="text-muted-foreground">Loading analytics data...</p>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (optionsError || statsError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 border-b bg-card/50 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Games
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">MLB Training Data Analytics</h1>
              <p className="text-muted-foreground">Error loading data</p>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="text-center text-red-500">
            <p>Error: {optionsError?.message || statsError?.message}</p>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!filterOptions) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 border-b bg-card/50 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Games
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">MLB Training Data Analytics</h1>
              <p className="text-muted-foreground">No training data available</p>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="text-center">
            <p>No training data found. Please check your database setup.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-card/50 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Games
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">MLB Training Data Analytics</h1>
            <p className="text-muted-foreground">Filter any dimension and get real‐time metrics</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <AnalyticsFilters 
          filters={filters} 
          filterOptions={filterOptions} 
          onFiltersChange={setFilters} 
        />
        
        {stats && (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard 
              title="Total Games" 
              value={stats.total_games.toString()} 
              icon={BarChart4} 
              gradient="from-slate-500 to-slate-600" 
              description="Games matching filters" 
            />
            <StatsCard 
              title="Win %" 
              value={`${(stats.win_pct * 100).toFixed(1)}%`} 
              icon={Trophy} 
              gradient="from-emerald-500 to-emerald-600" 
              description="Home/Away winner rate" 
            />
            <StatsCard 
              title="Run-Line Win %" 
              value={`${(stats.runline_win_pct * 100).toFixed(1)}%`} 
              icon={TrendingUp} 
              gradient="from-indigo-500 to-indigo-600" 
              description="Covering the run-line" 
            />
            <StatsCard 
              title="Over %" 
              value={`${(stats.over_pct * 100).toFixed(1)}%`} 
              icon={TrendingUp} 
              gradient="from-purple-500 to-purple-600" 
              description="Games over total" 
            />
            <StatsCard 
              title="Loss %" 
              value={`${(stats.loss_pct * 100).toFixed(1)}%`} 
              icon={Trophy} 
              gradient="from-red-500 to-red-600" 
              description="Opposite of win%" 
            />
            <StatsCard 
              title="Run-Line Loss %" 
              value={`${(stats.runline_loss_pct * 100).toFixed(1)}%`} 
              icon={TrendingUp} 
              gradient="from-yellow-500 to-yellow-600" 
              description="Opposite of RL win%" 
            />
            <StatsCard 
              title="Under %" 
              value={`${(stats.under_pct * 100).toFixed(1)}%`} 
              icon={BarChart3} 
              gradient="from-orange-500 to-orange-600" 
              description="Games under total" 
            />
          </div>
        )}
      </div>
    </div>
  );
}
