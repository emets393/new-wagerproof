
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const numericFilters = [
  "series_game_number", "series_home_wins", "series_away_wins", "series_overs", "series_unders",
  "o_u_line", "home_ml", "home_rl", "home_ml_handle", "home_ml_bets", "home_rl_handle", "home_rl_bets",
  "away_ml", "away_rl", "away_ml_handle", "away_ml_bets", "away_rl_handle", "away_rl_bets",
  "ou_handle_over", "ou_bets_over", "same_division", "same_league", "streak", "away_streak",
  "home_win_pct", "away_win_pct", "home_last_win", "away_last_win", "home_last_runs", "away_last_runs",
  "home_last_runs_allowed", "away_last_runs_allowed", "home_ops_last_3", "away_ops_last_3",
  "home_team_last_3", "away_team_last_3", "season", "month",
  "home_whip", "home_era", "away_whip", "away_era",
  "home_handedness", "away_handedness"
];

const textFilters = ["home_team", "away_team", "home_pitcher", "away_pitcher"];

export default function Analytics() {
  const [filters, setFilters] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['training_data', filters],
    queryFn: async () => {
      let query = supabase.from('training_data').select('*');
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '') query = query.eq(key, value);
      });
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const calculatePercentages = (rows) => {
    const total = rows.length;
    const count = (col, val) => rows.filter(r => r[col] === val).length;
    return total === 0 ? null : {
      home_winner: (count('ha_winner', 1) / total * 100).toFixed(1),
      away_winner: (count('ha_winner', 0) / total * 100).toFixed(1),
      home_cover: (count('run_line_winner', 1) / total * 100).toFixed(1),
      away_cover: (count('run_line_winner', 0) / total * 100).toFixed(1),
      over: (count('ou_result', 1) / total * 100).toFixed(1),
      under: (count('ou_result', 0) / total * 100).toFixed(1),
    };
  };

  const stats = data ? calculatePercentages(data) : null;

  const handleChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 grid gap-6">
      <h1 className="text-2xl font-bold">MLB Betting Analytics</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[...textFilters, ...numericFilters].map(key => (
          <div key={key} className="flex flex-col space-y-1">
            <Label className="capitalize">{key.replaceAll('_', ' ')}</Label>
            <Input
              type={numericFilters.includes(key) ? 'number' : 'text'}
              value={filters[key] || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={key.replaceAll('_', ' ')}
            />
          </div>
        ))}
      </div>

      {isLoading && <p>Loading...</p>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(stats).map(([label, value]) => (
            <Card key={label}>
              <CardContent className="text-center p-4">
                <p className="text-lg capitalize">{label.replaceAll('_', ' ')}</p>
                <p className="text-2xl font-semibold">{value}%</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">Total records: {data.length}</p>
        </div>
      )}
    </div>
  );
}
