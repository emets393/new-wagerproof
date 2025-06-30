import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import TeamDisplay from "./TeamDisplay";
import { buildQueryString } from "@/utils/queryParams";
import AdvancedNumericFilter from "./AdvancedNumericFilter";
import FilterSummary from "./FilterSummary";

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
  "is_home_team", "primary_days_between_games", "primary_travel_distance_miles",
  "primary_team_score", "opponent_team_score"
];

interface Filters {
  [key: string]: string;
}

interface DataRow {
  primary_win?: number;
  primary_runline_win?: number;
  ou_result?: number;
  primary_team?: string;
  opponent_team?: string;
  is_home_team?: boolean;
  primary_team_score?: number;
  opponent_team_score?: number;
  day?: number;
  month?: number;
  season?: number;
  o_u_line?: number;
  [key: string]: any;
}

interface StatsResult {
  winPct: string;
  runlinePct: string;
  overPct: string;
  underPct: string;
  total: number;
}

interface TeamStats {
  team: string;
  winPct: string;
  runlinePct: string;
  overPct: string;
  underPct: string;
  total: number;
}

interface GameDisplay {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  ouLine: number;
}

interface MLBTeam {
  short_name?: string;
  full_name?: string;
  [key: string]: any;
}

export default function FilterableWinRates() {
  const [filters, setFilters] = useState<Filters>({});
  const [results, setResults] = useState<DataRow[]>([]);
  const [mlbTeams, setMlbTeams] = useState<MLBTeam[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (column: string, value: string) => {
    setFilters({ ...filters, [column]: value });
  };

  const handleClearFilter = (column: string) => {
    const newFilters = { ...filters };
    delete newFilters[column];
    setFilters(newFilters);
  };

  const applyFilters = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Fetch MLB teams data for logos (simple query)
      const { data: teamsData } = await supabase.from("MLB_Teams").select("*");
      
      if (teamsData) {
        setMlbTeams(teamsData);
      }

      // Handle empty filters gracefully
      if (Object.keys(filters).length === 0 || Object.values(filters).every(value => !value || value.trim() === '')) {
        console.log('No filters applied, skipping edge function request');
        setResults([]);
        return;
      }

      // Build query string from filters
      const queryString = buildQueryString(filters);
      const url = `https://gnjrklxotmbvnxbnnqgq.functions.supabase.co/filter-training-data?${queryString}`;
      
      console.log('Sending GET request to:', url);
      console.log('Filters being sent:', filters);

      // Call the edge function for filtering with GET method and query parameters
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ'
        },
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge function error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Response data:', { data, count: data?.length });
      console.log(`Retrieved ${data?.length || 0} total records for stats calculation`);
      setResults(data || []);
    } catch (error) {
      console.error('Error applying filters:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (): StatsResult => {
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

  const isPitcherSelected = (): boolean => {
    return !!(filters['primary_pitcher'] || filters['opponent_pitcher']);
  };

  const getTeamStats = (): TeamStats[] => {
    const teamMap = new Map<string, DataRow[]>();
    
    // Group by primary team
    results.forEach(row => {
      if (row.primary_team) {
        if (!teamMap.has(row.primary_team)) {
          teamMap.set(row.primary_team, []);
        }
        teamMap.get(row.primary_team)!.push(row);
      }
    });

    return Array.from(teamMap.entries()).map(([team, games]) => {
      const total = games.length;
      const win = games.filter(g => g.primary_win === 1).length;
      const runline = games.filter(g => g.primary_runline_win === 1).length;
      const over = games.filter(g => g.ou_result === 1).length;
      const under = games.filter(g => g.ou_result === 0).length;

      return {
        team,
        winPct: total ? (win / total * 100).toFixed(1) : "0",
        runlinePct: total ? (runline / total * 100).toFixed(1) : "0",
        overPct: total ? (over / total * 100).toFixed(1) : "0",
        underPct: total ? (under / total * 100).toFixed(1) : "0",
        total
      };
    }).sort((a, b) => b.total - a.total);
  };

  const getGameDisplays = (): GameDisplay[] => {
    return results.slice(0, 50).map(row => {
      const homeTeam = row.is_home_team ? row.primary_team : row.opponent_team;
      const awayTeam = row.is_home_team ? row.opponent_team : row.primary_team;
      const homeScore = row.is_home_team ? row.primary_team_score : row.opponent_team_score;
      const awayScore = row.is_home_team ? row.opponent_team_score : row.primary_team_score;
      
      const date = `${row.month || 0}/${row.day || 0}/${row.season || 0}`;
      
      return {
        date,
        homeTeam: homeTeam || '',
        awayTeam: awayTeam || '',
        homeScore: homeScore || 0,
        awayScore: awayScore || 0,
        ouLine: row.o_u_line || 0
      };
    });
  };

  const stats = calculateStats();
  const teamStats = getTeamStats();
  const gameDisplays = getGameDisplays();

  const clearFilters = () => {
    setFilters({});
    setResults([]);
  };

  const getFieldRange = (field: string) => {
    switch (field) {
      case 'o_u_line': return { min: 6, max: 15, step: 0.5 };
      case 'primary_ml': case 'opponent_ml': return { min: -300, max: 300, step: 5 };
      case 'primary_rl': case 'opponent_rl': return { min: -2.5, max: 2.5, step: 0.5 };
      case 'primary_win_pct': case 'opponent_win_pct': return { min: 0, max: 100, step: 1 };
      case 'season': return { min: 2020, max: 2025, step: 1 };
      case 'month': return { min: 1, max: 12, step: 1 };
      case 'day': return { min: 1, max: 31, step: 1 };
      case 'primary_era': case 'opponent_era': return { min: 0, max: 8, step: 0.1 };
      case 'primary_whip': case 'opponent_whip': return { min: 0.8, max: 2, step: 0.05 };
      case 'series_game_number': return { min: 1, max: 7, step: 1 };
      default: return { min: 0, max: 100, step: 1 };
    }
  };

  // Separate numeric and text columns
  const numericColumns = columns.filter(col => 
    !['primary_team', 'opponent_team', 'primary_pitcher', 'opponent_pitcher'].includes(col)
  );
  const textColumns = ['primary_team', 'opponent_team', 'primary_pitcher', 'opponent_pitcher'];

  return (
    <div className="p-4 grid gap-4">
      {/* Filter Summary */}
      <FilterSummary 
        filters={filters}
        onClearFilter={handleClearFilter}
        onClearAll={clearFilters}
      />

      {/* Advanced Numeric Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
            {numericColumns.slice(0, 15).map(col => {
              const range = getFieldRange(col);
              return (
                <AdvancedNumericFilter
                  key={col}
                  label={col.replace(/_/g, ' ')}
                  field={col}
                  value={filters[col] || ''}
                  onChange={handleInputChange}
                  {...range}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Text Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Text Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {textColumns.map(col => (
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
        </CardContent>
      </Card>

      {/* Additional Numeric Filters */}
      {numericColumns.length > 15 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto">
              {numericColumns.slice(15).map(col => {
                const range = getFieldRange(col);
                return (
                  <AdvancedNumericFilter
                    key={col}
                    label={col.replace(/_/g, ' ')}
                    field={col}
                    value={filters[col] || ''}
                    onChange={handleInputChange}
                    {...range}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={applyFilters} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Apply Filters'}
        </Button>
        <Button variant="outline" onClick={clearFilters}>
          Clear All Filters
        </Button>
      </div>

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

      {results.length > 0 && !isPitcherSelected() && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-4">Team Performance Summary</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">Win Rate</TableHead>
                    <TableHead className="text-center">Run Line Cover</TableHead>
                    <TableHead className="text-center">Over Rate</TableHead>
                    <TableHead className="text-center">Under Rate</TableHead>
                    <TableHead className="text-center">Total Games</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamStats.map((team) => (
                    <TableRow key={team.team}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <TeamDisplay team={team.team} isHome={true} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-green-600">
                        {team.winPct}%
                      </TableCell>
                      <TableCell className="text-center font-semibold text-blue-600">
                        {team.runlinePct}%
                      </TableCell>
                      <TableCell className="text-center font-semibold text-orange-600">
                        {team.overPct}%
                      </TableCell>
                      <TableCell className="text-center font-semibold text-purple-600">
                        {team.underPct}%
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {team.total}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && isPitcherSelected() && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-4">Individual Games</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Home Team</TableHead>
                    <TableHead>Away Team</TableHead>
                    <TableHead className="text-center">Home Score</TableHead>
                    <TableHead className="text-center">Away Score</TableHead>
                    <TableHead className="text-center">O/U Line</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gameDisplays.map((game, i) => (
                    <TableRow key={i}>
                      <TableCell>{game.date}</TableCell>
                      <TableCell>
                        <TeamDisplay team={game.homeTeam} isHome={true} />
                      </TableCell>
                      <TableCell>
                        <TeamDisplay team={game.awayTeam} isHome={false} />
                      </TableCell>
                      <TableCell className="text-center">{game.homeScore}</TableCell>
                      <TableCell className="text-center">{game.awayScore}</TableCell>
                      <TableCell className="text-center">{game.ouLine}</TableCell>
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
