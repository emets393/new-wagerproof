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
import { Sparkles, Play, ChevronUp, ChevronDown, Calendar } from "lucide-react";

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

type SortColumn = 'team' | 'winPct' | 'runlinePct' | 'overPct' | 'underPct' | 'total';
type SortDirection = 'asc' | 'desc';

export default function FilterableWinRates() {
  const [filters, setFilters] = useState<Filters>({});
  const [results, setResults] = useState<DataRow[]>([]);
  const [mlbTeams, setMlbTeams] = useState<MLBTeam[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [gamesTodayMode, setGamesTodayMode] = useState(false);
  const [todaysGames, setTodaysGames] = useState<DataRow[]>([]);
  const [teamsPlayingToday, setTeamsPlayingToday] = useState<string[]>([]);

  const handleInputChange = (column: string, value: string) => {
    setFilters({ ...filters, [column]: value });
  };

  const applyFilters = async (): Promise<void> => {
    setIsLoading(true);
    setGamesTodayMode(false); // Reset to historical mode
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

  const applyGamesTodayFilters = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Fetch MLB teams data for logos (simple query)
      const { data: teamsData } = await supabase.from("MLB_Teams").select("*");
      
      if (teamsData) {
        setMlbTeams(teamsData);
      }

      // Handle empty filters gracefully
      if (Object.keys(filters).length === 0 || Object.values(filters).every(value => !value || value.trim() === '')) {
        console.log('No filters applied, skipping games today request');
        setTodaysGames([]);
        setResults([]);
        setTeamsPlayingToday([]);
        setGamesTodayMode(true);
        return;
      }

      console.log('Sending filters to games today edge function:', filters);

      // Call the games today edge function
      const { data, error } = await supabase.functions.invoke('games-today-filtered', {
        body: { filters }
      });

      if (error) {
        console.error('Games today edge function error:', error);
        throw error;
      }

      console.log('Games today response:', data);
      setTodaysGames(data.todaysGames || []);
      setResults(data.historicalData || []);
      setTeamsPlayingToday(data.teamsPlayingToday || []);
      setGamesTodayMode(true);
    } catch (error) {
      console.error('Error applying games today filters:', error);
      setTodaysGames([]);
      setResults([]);
      setTeamsPlayingToday([]);
      setGamesTodayMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  const isPitcherSelected = (): boolean => {
    return !!(filters['primary_pitcher'] || filters['opponent_pitcher']);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ChevronUp className="w-4 h-4 opacity-30" />;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
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

    const teamStats = Array.from(teamMap.entries()).map(([team, games]) => {
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
    });

    // Sort based on current sort column and direction
    return teamStats.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortColumn) {
        case 'team':
          aValue = a.team;
          bValue = b.team;
          break;
        case 'winPct':
          aValue = parseFloat(a.winPct);
          bValue = parseFloat(b.winPct);
          break;
        case 'runlinePct':
          aValue = parseFloat(a.runlinePct);
          bValue = parseFloat(b.runlinePct);
          break;
        case 'overPct':
          aValue = parseFloat(a.overPct);
          bValue = parseFloat(b.overPct);
          break;
        case 'underPct':
          aValue = parseFloat(a.underPct);
          bValue = parseFloat(b.underPct);
          break;
        case 'total':
          aValue = a.total;
          bValue = b.total;
          break;
        default:
          aValue = a.total;
          bValue = b.total;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? 
          aValue.localeCompare(bValue) : 
          bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc' ? 
          (aValue as number) - (bValue as number) : 
          (bValue as number) - (aValue as number);
      }
    });
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

  const getTodaysGameDisplays = (): GameDisplay[] => {
    return todaysGames.map(row => {
      const homeTeam = row.is_home_team ? row.primary_team : row.opponent_team;
      const awayTeam = row.is_home_team ? row.opponent_team : row.primary_team;
      
      const date = `${row.month || 0}/${row.day || 0}/${row.season || 0}`;
      
      return {
        date,
        homeTeam: homeTeam || '',
        awayTeam: awayTeam || '',
        homeScore: 0, // No scores for future games
        awayScore: 0, // No scores for future games
        ouLine: row.o_u_line || 0
      };
    });
  };

  const teamStats = getTeamStats();
  const gameDisplays = getGameDisplays();
  const todaysGameDisplays = getTodaysGameDisplays();

  const clearFilters = () => {
    setFilters({});
    setResults([]);
    setTodaysGames([]);
    setTeamsPlayingToday([]);
    setGamesTodayMode(false);
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
      <div className="flex gap-3 flex-wrap">
        <Button 
          onClick={applyFilters} 
          disabled={isLoading}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
        >
          {isLoading && !gamesTodayMode ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Loading...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Historical Analysis
            </>
          )}
        </Button>
        
        <Button 
          onClick={applyGamesTodayFilters} 
          disabled={isLoading}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
        >
          {isLoading && gamesTodayMode ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Loading...
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4" />
              Games Today
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

      {/* Today's Games Section - only show in games today mode */}
      {gamesTodayMode && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Games Today Matching Filters ({todaysGames.length} games)
            </h3>
            {todaysGames.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-green-200">
                      <TableHead>Home Team</TableHead>
                      <TableHead>Away Team</TableHead>
                      <TableHead className="text-center">O/U Line</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaysGameDisplays.map((game, i) => (
                      <TableRow key={i} className="hover:bg-green-50/50 transition-colors">
                        <TableCell>
                          <TeamDisplay team={game.homeTeam} isHome={true} />
                        </TableCell>
                        <TableCell>
                          <TeamDisplay team={game.awayTeam} isHome={false} />
                        </TableCell>
                        <TableCell className="text-center">{game.ouLine}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-green-600 font-medium">No games today match the current filters.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team Performance Summary with Sorting */}
      {results.length > 0 && !isPitcherSelected() && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-500">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {gamesTodayMode 
                ? `Historical Performance for Teams Playing Today (${results.length} records)` 
                : `Team Performance Summary (${results.length} records)`}
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-blue-200">
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        className="font-medium text-left p-0 h-auto hover:text-blue-600 transition-colors"
                        onClick={() => handleSort('team')}
                      >
                        Team {getSortIcon('team')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">
                      <Button 
                        variant="ghost" 
                        className="font-medium text-center p-0 h-auto hover:text-green-600 transition-colors"
                        onClick={() => handleSort('winPct')}
                      >
                        Win Rate {getSortIcon('winPct')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">
                      <Button 
                        variant="ghost" 
                        className="font-medium text-center p-0 h-auto hover:text-blue-600 transition-colors"
                        onClick={() => handleSort('runlinePct')}
                      >
                        Run Line Cover {getSortIcon('runlinePct')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">
                      <Button 
                        variant="ghost" 
                        className="font-medium text-center p-0 h-auto hover:text-orange-600 transition-colors"
                        onClick={() => handleSort('overPct')}
                      >
                        Over Rate {getSortIcon('overPct')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">
                      <Button 
                        variant="ghost" 
                        className="font-medium text-center p-0 h-auto hover:text-purple-600 transition-colors"
                        onClick={() => handleSort('underPct')}
                      >
                        Under Rate {getSortIcon('underPct')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center">
                      <Button 
                        variant="ghost" 
                        className="font-medium text-center p-0 h-auto hover:text-gray-600 transition-colors"
                        onClick={() => handleSort('total')}
                      >
                        Total Games {getSortIcon('total')}
                      </Button>
                    </TableHead>
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
              {gamesTodayMode ? 'Historical Games for Teams Playing Today' : 'Individual Games'}
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
      {((results.length === 0 && Object.keys(filters).some(key => filters[key]?.trim()) && !isLoading) || 
        (gamesTodayMode && todaysGames.length === 0 && results.length === 0 && !isLoading)) && (
        <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-l-4 border-gray-400">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 font-medium">
              {gamesTodayMode 
                ? "No games today match the current filters, or no historical data found for those teams." 
                : "No results found with the current filters."}
            </p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your filter criteria.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
