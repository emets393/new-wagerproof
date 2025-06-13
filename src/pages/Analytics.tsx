// src/pages/Analytics.tsx
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, TrendingUp, BarChart3 } from "lucide-react";
import AnalyticsFilters, {
  AnalyticsFilters as FiltersShape,
} from "@/components/AnalyticsFilters";
import StatsCard from "@/components/StatsCard";

// ─── Replace with your actual anon key ──────────────────────────────────────────
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ";
// ─── And your deployed function URL ───────────────────────────────────────────
const FUNCTION_URL =
  "https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/filter-stats";

// Initialize your filters state shape however you like
const initialFilters: FiltersShape = {
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
  dateRange: { start: "", end: "" },
  homeEraRange: { min: null, max: null },
  awayEraRange: { min: null, max: null },
  homeWhipRange: { min: null, max: null },
  awayWhipRange: { min: null, max: null },
  homeWinPctRange: { min: null, max: null },
  awayWinPctRange: { min: null, max: null },
  ouLineRange: { min: null, max: null },
};

export default function Analytics() {
  const [filters, setFilters] = useState<FiltersShape>(initialFilters);

  // Pull down your filter‐dropdown options from supabase directly
  const {
    data: filterOptions,
    isLoading: filtersLoading,
    error: filtersError,
  } = useQuery(
    ["filter-options"],
    async () => {
      const { data, error } = await supabase
        .from("training_data")
        .select(
          "home_team,away_team,season,month,day,home_pitcher,away_pitcher,home_handedness,away_handedness,series_game_number"
        )
        .limit(1000);
      if (error) throw error;
      // Extract unique values
      const uniq = <T extends (string | number)[]>(arr: T) =>
        Array.from(new Set(arr)).sort();
      return {
        homeTeams: uniq(data.map((r) => r.home_team).filter(Boolean) as string[]),
        awayTeams: uniq(data.map((r) => r.away_team).filter(Boolean) as string[]),
        seasons: uniq(data.map((r) => r.season).filter((n): n is number => !!n)),
        months: uniq(data.map((r) => r.month).filter((n): n is number => !!n)),
        days: uniq(data.map((r) => r.day).filter((n): n is number => !!n)),
        homePitchers: uniq(data.map((r) => r.home_pitcher).filter(Boolean) as string[]),
        awayPitchers: uniq(data.map((r) => r.away_pitcher).filter(Boolean) as string[]),
        homeHandedness: uniq(
          data.map((r) => r.home_handedness).filter((n): n is number => n != null)
        ),
        awayHandedness: uniq(
          data.map((r) => r.away_handedness).filter((n): n is number => n != null)
        ),
        seriesGameNumbers: uniq(
          data.map((r) => r.series_game_number).filter((n): n is number => n != null)
        ),
      };
    },
    { staleTime: 5 * 60 * 1000 }
  );

  // Call your Edge Function to get the aggregated metrics
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery(
    ["filter-stats", filters],
    async () => {
      const url = new URL(FUNCTION_URL);
      Object.entries(filters as Record<string, any>).forEach(([k, v]) => {
        // Only include set filters (arrays must have length)
        if (
          v != null &&
          v !== "" &&
          (!(Array.isArray(v)) || (Array.isArray(v) && v.length > 0))
        ) {
          url.searchParams.set(k, String(v));
        }
      });

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${ANON_KEY}`,
          apikey: ANON_KEY,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{
        total_games: number;
        win_pct: number;
        loss_pct: number;
        runline_win_pct: number;
        runline_loss_pct: number;
        over_pct: number;
        under_pct: number;
      }>;
    },
    {
      enabled: !!filterOptions,      // don’t run until options are loaded
      keepPreviousData: true,        // so UI doesn’t flash
      staleTime: 2 * 60 * 1000,
    }
  );

  // Loading / error states
  if (filtersLoading || statsLoading)
    return <div className="p-8 text-center">Loading…</div>;
  if (filtersError || statsError)
    return (
      <div className="p-8 text-center text-red-500">
        Error: {(filtersError || statsError)?.message}
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-card/50 px-6 py-4 backdrop-blur-sm">
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
              Filter across any dimension and see real‐time win%, run‐line%, over/under%
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Filters */}
        <AnalyticsFilters
          filters={filters}
          filterOptions={filterOptions!}
          onFiltersChange={setFilters}
        />

        {/* Stats Cards */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Games"
            value={stats.total_games.toString()}
            icon={BarChart3}
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

