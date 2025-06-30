
import { useState } from 'react';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Home, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface Filters {
  [key: string]: string;
}

export default function Analytics() {
  const [filters, setFilters] = useState<Filters>({});
  const [appliedFilters, setAppliedFilters] = useState<Filters>({});

  const { data, isLoading, error }: UseQueryResult<any[], Error> = useQuery({
    queryKey: ['training_data', appliedFilters],
    queryFn: async () => {
      console.log('Fetching with applied filters:', appliedFilters);
      let query = supabase.from('training_data').select('*');
      
      Object.entries(appliedFilters).forEach(([key, value]) => {
        const stringValue = String(value);
        if (stringValue !== '' && stringValue !== 'undefined') {
          console.log(`Applying filter: ${key} = ${stringValue}`);
          
          if (numericFilters.includes(key)) {
            const numericValue = parseFloat(stringValue);
            if (!isNaN(numericValue)) {
              query = query.eq(key, numericValue);
            }
          } else {
            query = query.eq(key, stringValue);
          }
        }
      });
      
      const { data, error } = await query;
      console.log('Query result:', { data, error, count: data?.length });
      
      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message);
      }
      return data || [];
    },
  });

  const calculatePercentages = (rows: any[]) => {
    const total = rows.length;
    if (total === 0) return null;
    
    const count = (col: string, val: number) => 
      rows.filter(r => r[col] === val).length;
    
    return {
      home_winner: (count('ha_winner', 1) / total * 100).toFixed(1),
      away_winner: (count('ha_winner', 0) / total * 100).toFixed(1),
      home_cover: (count('run_line_winner', 1) / total * 100).toFixed(1),
      away_cover: (count('run_line_winner', 0) / total * 100).toFixed(1),
      over: (count('ou_result', 1) / total * 100).toFixed(1),
      under: (count('ou_result', 0) / total * 100).toFixed(1),
    };
  };

  const stats = data ? calculatePercentages(data) : null;

  const handleChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    console.log('Applying filters:', filters);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters({});
    setAppliedFilters({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            MLB Betting Analytics
          </h1>
          
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Today's Games
              </Button>
            </Link>
            <Link to="/win-rates">
              <Button variant="outline" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Win Rates
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[...textFilters, ...numericFilters].map(key => (
              <div key={key} className="flex flex-col space-y-1">
                <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
                <Input
                  type={numericFilters.includes(key) ? 'number' : 'text'}
                  value={filters[key] || ''}
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
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Error:</strong> {error.message}
            </div>
          )}

          {data && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">Total records found: {data.length}</p>
            </div>
          )}

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

          {data && data.length > 0 && !isLoading && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Training Data Sample</CardTitle>
                <CardDescription>A preview of the first 10 records matching your filters.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Home Team</TableHead>
                        <TableHead>Away Team</TableHead>
                        <TableHead className="text-center">Winner (ML)</TableHead>
                        <TableHead className="text-center">Winner (RL)</TableHead>
                        <TableHead className="text-center">O/U Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.slice(0, 10).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.home_team}</TableCell>
                          <TableCell>{row.away_team}</TableCell>
                          <TableCell className="text-center">{row.ha_winner === 1 ? 'Home' : 'Away'}</TableCell>
                          <TableCell className="text-center">{row.run_line_winner === 1 ? 'Home' : 'Away'}</TableCell>
                          <TableCell className="text-center">{row.ou_result === 1 ? 'Over' : 'Under'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {data && data.length === 0 && !isLoading && (
            <div className="text-center py-8 text-gray-500">
              <p>No records found with the current filters.</p>
              <p className="text-sm mt-2">Try clearing filters or using different values.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
