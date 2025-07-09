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

const SUMMARY_LABELS = [
  { key: 'homeWinPct', label: 'Home Win %' },
  { key: 'awayWinPct', label: 'Away Win %' },
  { key: 'homeCoverPct', label: 'Home Cover %' },
  { key: 'awayCoverPct', label: 'Away Cover %' },
  { key: 'overPct', label: 'Over %' },
  { key: 'underPct', label: 'Under %' },
  { key: 'totalGames', label: 'Total Games' },
];

const GAME_COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'home_team', label: 'Home Team' },
  { key: 'away_team', label: 'Away Team' },
  { key: 'home_pitcher', label: 'Home Pitcher' },
  { key: 'home_era', label: 'Home ERA' },
  { key: 'home_whip', label: 'Home WHIP' },
  { key: 'away_pitcher', label: 'Away Pitcher' },
  { key: 'away_era', label: 'Away ERA' },
  { key: 'away_whip', label: 'Away WHIP' },
  { key: 'home_score', label: 'Home Score' },
  { key: 'away_score', label: 'Away Score' },
  { key: 'o_u_line', label: 'O/U Line' },
  { key: 'home_rl', label: 'Home RL' },
  { key: 'away_rl', label: 'Away RL' },
  { key: 'home_ml_handle', label: 'Home ML Handle' },
  { key: 'away_ml_handle', label: 'Away ML Handle' },
  { key: 'home_ml_bets', label: 'Home ML Bets' },
  { key: 'away_ml_bets', label: 'Away ML Bets' },
  { key: 'home_rl_handle', label: 'Home RL Handle' },
  { key: 'away_rl_handle', label: 'Away RL Handle' },
  { key: 'home_rl_bets', label: 'Home RL Bets' },
  { key: 'away_rl_bets', label: 'Away RL Bets' },
  { key: 'ou_handle_over', label: 'O/U Handle Over' },
  { key: 'ou_bets_over', label: 'O/U Bets Over' },
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

// Helper: PercentageBar component
const PercentageBar = ({ value }: { value: number }) => {
  let color = '#22c55e'; // green
  if (value < 33.3) color = '#ef4444'; // red
  else if (value < 66.6) color = '#f59e42'; // orange
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 48,
        height: 10,
        background: '#e5e7eb',
        borderRadius: 4,
        overflow: 'hidden',
        marginRight: 4,
      }}>
        <div style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          background: color,
          borderRadius: 4,
          transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ minWidth: 36, display: 'inline-block', textAlign: 'right' }}>{value.toFixed(1)}%</span>
    </div>
  );
};

export default function FilterableWinRates() {
  const [filters, setFilters] = useState<Filters>({});
  const [summary, setSummary] = useState(null);
  const [gameRows, setGameRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mlbTeams, setMlbTeams] = useState<MLBTeam[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [gamesTodayMode, setGamesTodayMode] = useState(false);
  const [todaysGames, setTodaysGames] = useState<DataRow[]>([]);
  const [teamsPlayingToday, setTeamsPlayingToday] = useState<string[]>([]);

  const handleInputChange = (column: string, value: string) => {
    setFilters({ ...filters, [column]: value });
  };

  const applyFilters = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('filter-training-data', {
        body: { filters }
      });
      if (error) throw error;
      
      console.log('=== DEBUG: Backend response ===');
      console.log('Summary:', data.summary);
      console.log('GameRows count:', data.gameRows?.length || 0);
      console.log('First 5 gameRows dates:', data.gameRows?.slice(0, 5).map(g => g.date));
      console.log('Last 5 gameRows dates:', data.gameRows?.slice(-5).map(g => g.date));
      console.log('Sample game object:', data.gameRows?.[0]);
      
      setSummary(data.summary);
      setGameRows(data.gameRows);
    } catch (err) {
      setError('Failed to fetch win rate data.');
      setSummary(null);
      setGameRows([]);
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
        setGameRows([]);
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
      setGameRows(data.gameRows || []);
      setTeamsPlayingToday(data.teamsPlayingToday || []);
      setGamesTodayMode(true);
    } catch (error) {
      console.error('Error applying games today filters:', error);
      setTodaysGames([]);
      setGameRows([]);
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
    gameRows.forEach(row => {
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
    return gameRows.slice(0, 50).map(row => {
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

  // Sort and limit gameRows to 100 most recent by date
  console.log('=== DEBUG: Before sorting ===');
  console.log('Total gameRows:', gameRows.length);
  console.log('First 5 gameRows dates:', gameRows.slice(0, 5).map(g => g.date));
  console.log('Last 5 gameRows dates:', gameRows.slice(-5).map(g => g.date));
  console.log('Sample game object:', gameRows[0]);
  
  const sortedGameRows = [...gameRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 100);
  
  console.log('=== DEBUG: After sorting ===');
  console.log('First 5 sortedGameRows dates:', sortedGameRows.slice(0, 5).map(g => g.date));
  console.log('Last 5 sortedGameRows dates:', sortedGameRows.slice(-5).map(g => g.date));
  console.log('Sample sorted game object:', sortedGameRows[0]);

  const teamStats = getTeamStats();
  const gameDisplays = getGameDisplays();
  const todaysGameDisplays = getTodaysGameDisplays();

  const clearFilters = () => {
    setFilters({});
    setGameRows([]);
    setTodaysGames([]);
    setTeamsPlayingToday([]);
    setGamesTodayMode(false);
  };

  const handleClearFilter = (column: string) => {
    const newFilters = { ...filters };
    delete newFilters[column];
    setFilters(newFilters);
  };

  const formatPercentage = (value: number) => {
    return value !== undefined && value !== null ? `${value.toFixed(1)}%` : '0.0%';
  };

  const calculateHandlePercentage = (handle: number, totalHandle: number) => {
    if (!totalHandle || totalHandle === 0) return 0;
    return (handle / totalHandle) * 100;
  };

  const calculateBetsPercentage = (bets: number, totalBets: number) => {
    if (!totalBets || totalBets === 0) return 0;
    return (bets / totalBets) * 100;
  };

  const renderGameRow = (game: any) => {
    // Calculate totals for percentages
    const totalMLHandle = (game.home_ml_handle || 0) + (game.away_ml_handle || 0);
    const totalMLBets = (game.home_ml_bets || 0) + (game.away_ml_bets || 0);
    const totalRLHandle = (game.home_rl_handle || 0) + (game.away_rl_handle || 0);
    const totalRLBets = (game.home_rl_bets || 0) + (game.away_rl_bets || 0);
    const totalOUHandle = game.ou_handle_over || 0;
    const totalOUBets = game.ou_bets_over || 0;

    // Over/Under percentages (ou_handle_over and ou_bets_over are decimals)
    let overHandlePct = 0, underHandlePct = 0, overBetsPct = 0, underBetsPct = 0;
    if (typeof game.ou_handle_over === 'number') {
      overHandlePct = +(game.ou_handle_over * 100).toFixed(1);
      underHandlePct = +(100.0 - overHandlePct).toFixed(1);
    } else {
      overHandlePct = 0;
      underHandlePct = 0;
    }
    if (typeof game.ou_bets_over === 'number') {
      overBetsPct = +(game.ou_bets_over * 100).toFixed(1);
      underBetsPct = +(100.0 - overBetsPct).toFixed(1);
    } else {
      overBetsPct = 0;
      underBetsPct = 0;
    }

    return (
      <TableRow key={game.unique_id}>
        <TableCell className="font-medium">{game.date}</TableCell>
        <TableCell>{game.home_team}</TableCell>
        <TableCell>{game.away_team}</TableCell>
        <TableCell>
          <div className="text-sm">{game.home_pitcher}</div>
        </TableCell>
        <TableCell>
          <div className="text-sm">{game.away_pitcher}</div>
        </TableCell>
        <TableCell className="text-center">{game.home_score}</TableCell>
        <TableCell className="text-center">{game.away_score}</TableCell>
        <TableCell className="text-center">{game.o_u_line}</TableCell>
        <TableCell>
          <div className="text-xs space-y-1">
            <div>H Handle: <PercentageBar value={calculateHandlePercentage(game.home_ml_handle, totalMLHandle)} /></div>
            <div>A Bet: <PercentageBar value={calculateBetsPercentage(game.away_ml_bets, totalMLBets)} /></div>
            <div>A Handle: <PercentageBar value={calculateHandlePercentage(game.away_ml_handle, totalMLHandle)} /></div>
            <div>H Bet: <PercentageBar value={calculateBetsPercentage(game.home_ml_bets, totalMLBets)} /></div>
          </div>
        </TableCell>
        <TableCell>
          <div className="text-xs space-y-1">
            <div>H Handle: <PercentageBar value={calculateHandlePercentage(game.home_rl_handle, totalRLHandle)} /></div>
            <div>A Bet: <PercentageBar value={calculateBetsPercentage(game.away_rl_bets, totalRLBets)} /></div>
            <div>A Handle: <PercentageBar value={calculateHandlePercentage(game.away_rl_handle, totalRLHandle)} /></div>
            <div>H Bet: <PercentageBar value={calculateBetsPercentage(game.home_rl_bets, totalRLBets)} /></div>
          </div>
        </TableCell>
        <TableCell>
          <div className="text-xs space-y-1">
            <div>O Handle: <PercentageBar value={overHandlePct} /></div>
            <div>U Bet: <PercentageBar value={underBetsPct} /></div>
            <div>U Handle: <PercentageBar value={underHandlePct} /></div>
            <div>O Bet: <PercentageBar value={overBetsPct} /></div>
          </div>
        </TableCell>
      </TableRow>
    );
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
          {isLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
      {gameRows.length > 0 && !isPitcherSelected() && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-500">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {gamesTodayMode 
                ? `Historical Performance for Teams Playing Today (${gameRows.length} records)` 
                : `Team Performance Summary (${gameRows.length} records)`}
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

      {/* Game Details */}
      <Card>
        <CardHeader>
          <CardTitle>Game Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : gameRows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Home Team</TableHead>
                    <TableHead>Away Team</TableHead>
                    <TableHead>Home Pitcher</TableHead>
                    <TableHead>Away Pitcher</TableHead>
                    <TableHead className="text-center">Home Score</TableHead>
                    <TableHead className="text-center">Away Score</TableHead>
                    <TableHead className="text-center">O/U Line</TableHead>
                    <TableHead className="text-center">Moneyline</TableHead>
                    <TableHead className="text-center">Runline</TableHead>
                    <TableHead className="text-center">Over/Under</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedGameRows.map(renderGameRow)}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div>No games found for these filters.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
