
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
    queryFn: async (): Promise<FilterOptions> => {
      console.log("Fetching filter options from training_data table...");
      
      const { data, error } = await supabase
        .from("training_data")
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
          series_game_number
        `)
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

      const uniq = <T extends string | number>(arr: T[]) => Array.from(new Set(arr));

      const options = {
        homeTeams: uniq(data.map(r => r.home_team).filter(Boolean) as string[]).sort(),
        awayTeams: uniq(data.map(r => r.away_team).filter(Boolean) as string[]).sort(),
        seasons: uniq(data.map(r => r.season).filter(n => n != null) as number[]).sort((a, b) => b - a),
        months: uniq(data.map(r => r.month).filter(n => n != null) as number[]).sort((a, b) => a - b),
        days: uniq(data.map(r => r.day).filter(n => n != null) as number[]).sort((a, b) => a - b),
        homePitchers: uniq(data.map(r => r.home_pitcher).filter(Boolean) as string[]).sort(),
        awayPitchers: uniq(data.map(r => r.away_pitcher).filter(Boolean) as string[]).sort(),
        homeHandedness: uniq(data.map(r => r.home_handedness).filter(n => n != null) as number[]).sort(),
        awayHandedness: uniq(data.map(r => r.away_handedness).filter(n => n != null) as number[]).sort(),
        seriesGameNumbers: uniq(data.map(r => r.series_game_number).filter(n => n != null) as number[]).sort(),
      };

      console.log("Processed filter options:", {
        homeTeams: options.homeTeams.length,
        awayTeams: options.awayTeams.length,
        seasons: options.seasons.length,
        months: options.months.length,
      });

      return options;
    },
  });

  // Fetch aggregated stats based on filters
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['analytics-stats', filters],
    queryFn: async (): Promise<Stats> => {
      console.log("Fetching stats with filters:", filters);
      
      let query = supabase.from("training_data").select("*", { count: 'exact' });

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

      const { data, error, count } = await query;

      if (error) {
        console.error("Error fetching stats:", error);
        throw error;
      }

      console.log(`Found ${count} total records`);
      console.log("Sample data:", data?.slice(0, 3));

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

      // Calculate stats from the data
      const total_games = data.length;
      
      // For now, using simple calculations based on available data
      // These will need to be adjusted based on your actual data structure
      let wins = 0;
      let runline_wins = 0;
      let overs = 0;

      data.forEach(game => {
        // These calculations depend on your data structure
        // Adjust based on what columns are actually available
        if (game.home_team_won === true || game.away_team_won === true) {
          wins++;
        }
        if (game.runline_covered === true) {
          runline_wins++;
        }
        if (game.total_over === true) {
          overs++;
        }
      });

      const win_pct = total_games > 0 ? wins / total_games : 0;
      const loss_pct = 1 - win_pct;
      const runline_win_pct = total_games > 0 ? runline_wins / total_games : 0;
      const runline_loss_pct = 1 - runline_win_pct;
      const over_pct = total_games > 0 ? overs / total_games : 0;
      const under_pct = 1 - over_pct;

      return {
        total_games,
        win_pct,
        loss_pct,
        runline_win_pct,
        runline_loss_pct,
        over_pct,
        under_pct,
      };
    },
  });

  // Loading / error states
  if (optionsLoading || statsLoading) {
    return <div className="p-8 text-center">Loading…</div>;
  }
  
  if (optionsError) {
    return <div className="p-8 text-center text-red-500">Error loading filter options: {optionsError.message}</div>;
  }
  
  if (statsError) {
    return <div className="p-8 text-center text-red-500">Error loading stats: {statsError.message}</div>;
  }

  if (!filterOptions) {
    return <div className="p-8 text-center">No filter options available</div>;
  }

  if (!stats) {
    return <div className="p-8 text-center">No stats available</div>;
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
        <AnalyticsFilters filters={filters} filterOptions={filterOptions} onFiltersChange={setFilters} />
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
      </div>
    </div>
  );
}
