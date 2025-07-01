import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import TeamDisplay from "./TeamDisplay";
import { buildQueryString } from "@/utils/queryParams";
import FilterSummary from "./FilterSummary";
import BettingLinesFilters from "./BettingLinesFilters";
import DateFilters from "./DateFilters";
import SituationalFilters from "./SituationalFilters";
import { Sparkles, Play } from "lucide-react";

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

      console.log('Sending filters to edge function:', filters);

      // Call the edge function using Supabase client's invoke method
      const { data, error } = await supabase.functions.invoke('filter-training-data', {
        body: { filters }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Response data:', { data, count: data?.length });
      console.log(`Retrieved ${data?.length || 0} total records for stats calculation`);
      setResults(data || []);
    } catch (error) {
      console.error('Error applying filters:', error);
      console.error('Filter state at time of error:', filters);
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

  const handleClearFilter = (column: string) => {
    const newFilters = { ...filters };
    delete newFilters[column];
    setFilters(newFilters);
  };

  return (
    <div className="p-4 grid gap-6">
      {/* Filter Summary */}
      <FilterSummary 
        filters={filters}
        onClearFilter={handleClearFilter}
        onClearAll={clearFilters}
      />

      {/* Three Filter Sections */}
      <div className="grid gap-6">
        <BettingLinesFilters 
          filters={filters}
          onFilterChange={handleInputChange}
        />
        
        <DateFilters 
          filters={filters}
          onFilterChange={handleInputChange}
        />
        
        <SituationalFilters 
          filters={filters}
          onFilterChange={handleInputChange}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button 
          onClick={applyFilters} 
          disabled={isLoading}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Loading...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Apply Filters
            </>
          )}
        </Button>
        <Button 
          variant="outline" 
          onClick={clearFilters}
          className="border-2 border-gray-300 hover:border-purple-500 hover:text-purple-600 px-6 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Clear All
        </Button>
      </div>

      {/* Results Summary */}
      {results.length > 0 && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Results Summary ({stats.total} records)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white/70 rounded-lg border border-green-200">
                <p className="text-3xl font-bold text-green-600">{stats.winPct}%</p>
                <p className="text-sm text-green-700 font-medium">Win Rate</p>
              </div>
              <div className="text-center p-4 bg-white/70 rounded-lg border border-blue-200">
                <p className="text-3xl font-bold text-blue-600">{stats.runlinePct}%</p>
                <p className="text-sm text-blue-700 font-medium">Run Line Cover</p>
              </div>
              <div className="text-center p-4 bg-white/70 rounded-lg border border-orange-200">
                <p className="text-3xl font-bold text-orange-600">{stats.overPct}%</p>
                <p className="text-sm text-orange-700 font-medium">Over Rate</p>
              </div>
              <div className="text-center p-4 bg-white/70 rounded-lg border border-purple-200">
                <p className="text-3xl font-bold text-purple-600">{stats.underPct}%</p>
                <p className="text-sm text-purple-700 font-medium">Under Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Performance Summary */}
      {results.length > 0 && !isPitcherSelected() && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-500">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Team Performance Summary
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-blue-200">
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
                    <TableRow key={team.team} className="hover:bg-blue-50/50 transition-colors">
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

      {/* Individual Games Table */}
      {results.length > 0 && isPitcherSelected() && (
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-l-4 border-amber-500">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
              Individual Games
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-amber-200">
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
                    <TableRow key={i} className="hover:bg-amber-50/50 transition-colors">
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
                <p className="text-sm text-amber-600 mt-3 text-center font-medium">
                  Showing first 50 results out of {results.length} total records
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results Message */}
      {results.length === 0 && Object.keys(filters).some(key => filters[key]?.trim()) && !isLoading && (
        <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-l-4 border-gray-400">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 font-medium">No results found with the current filters.</p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your filter criteria.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
