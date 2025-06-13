// ✅ Final working version: Dropdowns + ilike + real filters

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import {
  Card, CardContent,
  Input, Label, Button,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui";

const supabase = createClient(
  "https://gnjrklxotmbvnxbnnqgq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
);

const numericFilters = [/* your numeric keys (same as before) */];
const textFilters = ["home_pitcher", "away_pitcher"];

interface Filters {
  [key: string]: string;
}

interface TrainingDataRow {
  ha_winner: number;
  run_line_winner: number;
  ou_result: number;
  [key: string]: any;
}

export default function AnalyticsDashboard() {
  const [filters, setFilters] = useState<Filters>({});
  const [appliedFilters, setAppliedFilters] = useState<Filters>({});
  const [homeTeams, setHomeTeams] = useState<string[]>([]);
  const [awayTeams, setAwayTeams] = useState<string[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data: homeData } = await supabase.from('training_data').select('home_team');
      const { data: awayData } = await supabase.from('training_data').select('away_team');
      setHomeTeams(Array.from(new Set(homeData?.map(r => r.home_team?.trim()).filter(Boolean))).sort());
      setAwayTeams(Array.from(new Set(awayData?.map(r => r.away_team?.trim()).filter(Boolean))).sort());
    };
    fetchTeams();
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['training_data', JSON.stringify(appliedFilters)],
    queryFn: async (): Promise<TrainingDataRow[]> => {
      let query = supabase.from('training_data').select('*');
      let hasFilters = false;

      for (const [key, value] of Object.entries(appliedFilters)) {
        const val = value.trim();
        if (!val) continue;
        hasFilters = true;

        if (numericFilters.includes(key)) {
          const num = parseFloat(val);
          if (!isNaN(num)) query = query.eq(key, num);
        } else if (["home_team", "away_team"].includes(key)) {
          query = query.ilike(key, val); // ✅ FIXED: case-insensitive matching
        } else if (textFilters.includes(key)) {
          query = query.ilike(key, `%${val}%`);
        } else {
          query = query.eq(key, val);
        }
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return hasFilters ? data ?? [] : [];
    },
  });

  const applyFilters = () => setAppliedFilters(filters);
  const clearFilters = () => { setFilters({}); setAppliedFilters({}); };
  const handleChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const calculatePercentages = (rows: TrainingDataRow[]) => {
    const total = rows.length;
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

  return (
    <div className="p-6 grid gap-6">
      <h1 className="text-2xl font-bold">MLB Betting Analytics</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="flex flex-col space-y-1">
          <Label>Home Team</Label>
          <Select value={filters.home_team || ''} onValueChange={v => handleChange("home_team", v.trim())}>
            <SelectTrigger><SelectValue placeholder="Select home team" /></SelectTrigger>
            <SelectContent>
              {homeTeams.map(team => (
                <SelectItem key={team} value={team}>{team}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col space-y-1">
          <Label>Away Team</Label>
          <Select value={filters.away_team || ''} onValueChange={v => handleChange("away_team", v.trim())}>
            <SelectTrigger><SelectValue placeholder="Select away team" /></SelectTrigger>
            <SelectContent>
              {awayTeams.map(team => (
                <SelectItem key={team} value={team}>{team}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {[...textFilters, ...numericFilters].map(key => (
          <div key={key} className="flex flex-col space-y-1">
            <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
            <Input
              type={numericFilters.includes(key) ? "number" : "text"}
              value={filters[key] || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={key.replace(/_/g, ' ')}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <Button onClick={applyFilters} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Apply Filters'}
        </Button>
        <Button variant="outline" onClick={clearFilters}>Clear</Button>
      </div>

      {data && <p className="text-sm mt-4">Total records found: {data.length}</p>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          {Object.entries(stats).map(([label, value]) => (
            <Card key={label}>
              <CardContent className="text-center p-4">
                <p className="capitalize">{label.replace(/_/g, ' ')}</p>
                <p className="text-2xl font-bold">{value}%</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


