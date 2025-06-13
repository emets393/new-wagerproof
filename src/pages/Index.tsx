// ✅ Cleaned-up, TypeScript-safe MLB Analytics Dashboard with Dropdowns for Team Names

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const supabase = createClient(
  "https://gnjrklxotmbvnxbnnqgq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTQwMzM5MywiZXhwIjoyMDY0OTc5MzkzfQ.RGi1Br_luWhexvBJJC1AaMSEMHJGl9Li_NUlwiUshsA"
);

const numericFilters = [
  "home_team_number", "away_team_number", "series_game_number", "series_home_wins", "series_away_wins", "series_overs", "series_unders",
  "o_u_line", "home_ml", "home_rl", "home_ml_handle", "home_ml_bets", "home_rl_handle", "home_rl_bets",
  "away_ml", "away_rl", "away_ml_handle", "away_ml_bets", "away_rl_handle", "away_rl_bets",
  "ou_handle_over", "ou_bets_over", "same_division", "same_league", "streak", "away_streak",
  "home_win_pct", "away_win_pct", "home_last_win", "away_last_win", "home_last_runs", "away_last_runs",
  "home_last_runs_allowed", "away_last_runs_allowed", "home_ops_last_3", "away_ops_last_3",
  "home_team_last_3", "away_team_last_3", "season", "month", "day",
  "home_whip", "home_era", "away_whip", "away_era",
  "home_handedness", "away_handedness"
];

const textFilters = [
  "home_pitcher", "away_pitcher"
];

interface Filters {
  [key: string]: string;
}

interface TrainingDataRow {
  ha_winner: number;
  run_line_winner: number;
  ou_result: number;
  [key: string]: any;
}

interface StatsResult {
  home_winner: string;
  away_winner: string;
  home_cover: string;
  away_cover: string;
  over: string;
  under: string;
}

export default function AnalyticsDashboard() {
  const [filters, setFilters] = useState<Filters>({});
  const [appliedFilters, setAppliedFilters] = useState<Filters>({});
  const [homeTeams, setHomeTeams] = useState<string[]>([]);
  const [awayTeams, setAwayTeams] = useState<string[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data: homeData } = await supabase.from('training_data').select('home_team').neq('home_team', '').then(res => res.data);
      const { data: awayData } = await supabase.from('training_data').select('away_team').neq('away_team', '').then(res => res.data);
      setHomeTeams(Array.from(new Set(homeData?.map(d => d.home_team))).sort());
      setAwayTeams(Array.from(new Set(awayData?.map(d => d.away_team))).sort());
    };
    fetchTeams();
  }, []);

  const { data, isLoading, error } = useQuery<TrainingDataRow[]>({
    queryKey: ['training_data', JSON.stringify(appliedFilters)],
    queryFn: async () => {
      let query = supabase.from('training_data').select('*');
      let hasFilters = false;
      for (const [key, value] of Object.entries(appliedFilters)) {
        if (value.trim() === '') continue;
        hasFilters = true;
        if (numericFilters.includes(key)) {
          const num = parseFloat(value);
          if (!isNaN(num)) query = query.eq(key, num);
        } else if (["home_team", "away_team"].includes(key)) {
          query = query.eq(key, value);
        } else if (textFilters.includes(key)) {
          query = query.ilike(key, `%${value}%`);
        } else {
          query = query.eq(key, value);
        }
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return hasFilters ? data ?? [] : [];
    },
  });

  const calculatePercentages = (rows: TrainingDataRow[]): StatsResult | null => {
    const total = rows.length;
    if (total === 0) return null;
    const count = (col: keyof TrainingDataRow, val: number) => rows.filter(r => r[col] === val).length;
    return {
      home_winner: ((count('ha_winner', 1) / total) * 100).toFixed(1),
      away_winner: ((count('ha_winner', 0) / total) * 100).toFixed(1),
      home_cover: ((count('run_line_winner', 1) / total) * 100).toFixed(1),
      away_cover: ((count('run_line_winner', 0) / total) * 100).toFixed(1),
      over: ((count('ou_result', 1) / total) * 100).toFixed(1),
      under: ((count('ou_result', 0) / total) * 100).toFixed(1),
    };
  };

  const stats = data ? calculatePercentages(data) : null;

  const handleChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => setAppliedFilters(filters);
  const clearFilters = () => {
    setFilters({});
    setAppliedFilters({});
  };

  return (
    <div className="p-6 grid gap-6">
      <h1 className="text-2xl font-bold">MLB Betting Analytics</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="flex flex-col space-y-1">
          <Label>Home Team</Label>
          <Select value={filters.home_team || ''} onValueChange={value => handleChange('home_team', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select home team" />
            </SelectTrigger>
            <SelectContent>
              {homeTeams.map(team => (
                <SelectItem key={team} value={team}>{team}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col space-y-1">
          <Label>Away Team</Label>
          <Select value={filters.away_team || ''} onValueChange={value => handleChange('away_team', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select away team" />
            </SelectTrigger>
            <SelectContent>
              {awayTeams.map(team => (
                <SelectItem key={team} value={team}>{team}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {[...textFilters, ...numericFilters].map(key => (
          !["home_team", "away_team"].includes(key) && (
            <div key={key} className="flex flex-col space-y-1">
              <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
              <Input
                type={numericFilters.includes(key) ? 'number' : 'text'}
                value={filters[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={key.replace(/_/g, ' ')}
              />
            </div>
          )
        ))}
      </div>

      <div className="flex gap-4">
        <Button onClick={applyFilters} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Apply Filters'}
        </Button>
        <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {data && <p className="text-sm text-gray-600 mt-2">Total records found: {data.length}</p>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(stats).map(([label, value]) => (
            <Card key={label}>
              <CardContent className="text-center p-4">
                <p className="text-lg capitalize">{label.replace(/_/g, ' ')}</p>
                <p className="text-2xl font-semibold">{value}%</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.length === 0 && !isLoading && (
        <div className="text-center py-8 text-gray-500">
          <p>No records found with the current filters.</p>
          <p className="text-sm mt-2">Try clearing filters or using different values.</p>
        </div>
      )}
    </div>
  );
}


