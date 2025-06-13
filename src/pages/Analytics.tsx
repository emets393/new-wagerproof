import React, { useState, useEffect } from "react";
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

// Your Supabase anon key and function URL
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ";
const FUNCTION_URL = "https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/filter-stats";

export default function Analytics() {
  const [filters, setFilters] = useState<Filters>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Fetch filter dropdown options once
  useEffect(() => {
    async function loadOptions() {
      setOptionsLoading(true);
      try {
        const { data, error } = await supabase
          .from("training_data")
          .select(
            `home_team,away_team,season,month,day,home_pitcher,away_pitcher,home_handedness,away_handedness,series_game_number`
          )
          .limit(1000);
        if (error) throw error;
        const uniq = <T extends string | number>(arr: T[]) => Array.from(new Set(arr));
        setFilterOptions({
          homeTeams: uniq(data.map(r => r.home_team).filter(Boolean) as string[]),
          awayTeams: uniq(data.map(r => r.away_team).filter(Boolean) as string[]),
          seasons: uniq(data.map(r => r.season!).filter(n => n != null)),
          months: uniq(data.map(r => r.month!).filter(n => n != null)),
          days: uniq(data.map(r => r.day!).filter(n => n != null)),
          homePitchers: uniq(data.map(r => r.home_pitcher).filter(Boolean) as string[]),
          awayPitchers: uniq(data.map(r => r.away_pitcher).filter(Boolean) as string[]),
          homeHandedness: uniq(data.map(r => r.home_handedness!).filter(n => n != null)),
          awayHandedness: uniq(data.map(r => r.away_handedness!).filter(n => n != null)),
          seriesGameNumbers: uniq(data.map(r => r.series_game_number!).filter(n => n != null)),
        });
      } catch (e: any) {
        setOptionsError(e.message);
      } finally {
        setOptionsLoading(false);
      }
    }
    loadOptions();
  }, []);

  // Fetch aggregated stats whenever filters change
  useEffect(() => {
    async function loadStats() {
      setStatsLoading(true);
      try {
        const url = new URL(FUNCTION_URL);
        Object.entries(filters).forEach(([key, val]) => {
          if (val != null && val !== "") {
            url.searchParams.set(key, String(val));
          }
        });
        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${ANON_KEY}`,
            apikey: ANON_KEY,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Stats;
        setStats(json);
      } catch (e: any) {
        setStatsError(e.message);
      } finally {
        setStatsLoading(false);
      }
    }
    loadStats();
  }, [filters]);

  // Loading / error states
  if (optionsLoading || statsLoading) {
    return <div className="p-8 text-center">Loading…</div>;
  }
  if (optionsError) {
    return <div className="p-8 text-center text-red-500">Error: {optionsError}</div>;
  }
  if (!filterOptions) {
    return <div className="p-8 text-center">No filter options available</div>;
  }
  if (statsError) {
    return <div className="p-8 text-center text-red-500">Error: {statsError}</div>;
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
          <StatsCard title="Total Games" value={stats!.total_games.toString()} icon={BarChart4} gradient="from-slate-500 to-slate-600" description="Games matching filters" />
          <StatsCard title="Win %" value={`${(stats!.win_pct * 100).toFixed(1)}%`} icon={Trophy} gradient="from-emerald-500 to-emerald-600" description="Home/Away winner rate" />
          <StatsCard title="Run-Line Win %" value={`${(stats!.runline_win_pct * 100).toFixed(1)}%`} icon={TrendingUp} gradient="from-indigo-500 to-indigo-600" description="Covering the run-line" />
          <StatsCard title="Over %" value={`${(stats!.over_pct * 100).toFixed(1)}%`} icon={TrendingUp} gradient="from-purple-500 to-purple-600" description="Games over total" />
          <StatsCard title="Loss %" value={`${(stats!.loss_pct * 100).toFixed(1)}%`} icon={Trophy} gradient="from-red-500 to-red-600" description="Opposite of win%" />
          <StatsCard title="Run-Line Loss %" value={`${(stats!.runline_loss_pct * 100).toFixed(1)}%`} icon={TrendingUp} gradient="from-yellow-500 to-yellow-600" description="Opposite of RL win%" />
          <StatsCard title="Under %" value={`${(stats!.under_pct * 100).toFixed(1)}%`} icon={BarChart3} gradient="from-orange-500 to-orange-600" description="Games under total" />
        </div>
      </div>
    </div>
  );
}



