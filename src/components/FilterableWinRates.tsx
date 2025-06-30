
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const columns = [
  "season", "month", "day", "series_game_number", "o_u_line",
  "primary_team", "primary_ml", "primary_rl", "primary_ml_handle", "primary_ml_bets",
  "primary_rl_handle", "primary_rl_bets", "primary_win_pct", "primary_last_win",
  "primary_last_runs", "primary_last_runs_allowed", "primary_ops_last_3", "primary_team_last_3",
  "primary_pitcher", "primary_pitcher_id", "primary_whip", "primary_era", "primary_handedness",
  "primary_division_number", "primary_league_number", "primary_streak", "opponent_team",
  "opponent_ml", "opponent_rl", "opponent_ml_handle", "opponent_ml_bets", "opponent_rl_handle",
  "opponent_rl_bets", "opponent_win_pct", "opponent_last_win", "opponent_last_runs",
  "opponent_last_runs_allowed", "opponent_ops_last_3", "opponent_team_last_3",
  "opponent_pitcher", "opponent_pitcher_id", "opponent_whip", "opponent_era",
  "opponent_handedness", "opponent_division_number", "opponent_league_number",
  "opponent_streak", "primary_win", "primary_runline_win", "start_time_minutes",
  "same_division", "same_league", "series_primary_wins", "series_opponent_wins",
  "series_overs", "series_unders", "ou_handle_over", "ou_bets_over",
  "is_home_team", "primary_days_between_games", "primary_travel_distance_miles"
];

interface Filters {
  [key: string]: string;
}

interface DataRow {
  [key: string]: any;
  primary_win?: number;
  primary_runline_win?: number;
  ou_result?: number;
}

export default function FilterableWinRates() {
  const [filters, setFilters] = useState<Filters>({});
  const [results, setResults] = useState<DataRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (column: string, value: string) => {
    setFilters({ ...filters, [column]: value });
  };

  const applyFilters = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from("training_data_team_view_enhanced").select("*");
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          // Use ilike for text searches, eq for exact matches on numbers
          const trimmedValue = value.trim();
          if (!isNaN(Number(trimmedValue)) && trimmedValue !== '') {
            query = query.eq(key, Number(trimmedValue));
          } else {
            query = query.ilike(key, `%${trimmedValue}%`);
          }
        }
      });
      
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching data:', error);
      } else {
        setResults(data || []);
      }
    } catch (error) {
      console.error('Error applying filters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = () => {
    const total = results.length;
    const win = results.filter(r => r.primary_win === 1).length;
    const runline = results.filter(r => r.primary_runline_win === 1).length;
    const over = results.filter(r => r.ou_result === 1).length;
    const under = results.filter(r => r.ou_result === 0).length;
    
    return {
      winPct: total ? (win / total * 100).toFixed(1) : "0",
      runlinePct: total ? (runline / total * 100).toFixed(1) : "0",
      overPct: total ? (over / total * 100).toFixed(1) : "0",
      underPct: total ? (under / total * 100).toFixed(1) : "0",
      total
    };
  };

  const stats = calculateStats();

  const clearFilters = () => {
    setFilters({});
    setResults([]);
  };

  return (
    <div className="p-4 grid gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto">
            {columns.map(col => (
              <div key={col}>
                <Label className="text-sm font-medium">{col.replace(/_/g, ' ')}</Label>
                <Input 
                  value={filters[col] || ""} 
                  onChange={e => handleInputChange(col, e.target.value)}
                  placeholder={`Filter ${col}`}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={applyFilters} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Apply Filters'}
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-4">Results Summary ({stats.total} records)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.winPct}%</p>
                <p className="text-sm text-gray-600">Win Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.runlinePct}%</p>
                <p className="text-sm text-gray-600">Run Line Cover</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{stats.overPct}%</p>
                <p className="text-sm text-gray-600">Over Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.underPct}%</p>
                <p className="text-sm text-gray-600">Under Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.slice(0, 10).map(col => (
                      <TableHead key={col} className="min-w-[120px]">
                        {col.replace(/_/g, ' ')}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      {columns.slice(0, 10).map(col => (
                        <TableCell key={col} className="text-sm">
                          {row[col]?.toString() || ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {results.length > 50 && (
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Showing first 50 results out of {results.length} total records
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {results.length === 0 && Object.keys(filters).some(key => filters[key]?.trim()) && !isLoading && (
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-gray-600">No results found with the current filters.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
