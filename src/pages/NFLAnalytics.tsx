import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

// Color coding helper function
const getColorClass = (value1: any, value2: any) => {
  const v1 = parseFloat(value1 || 0);
  const v2 = parseFloat(value2 || 0);
  
  if (v1 > v2) return 'text-green-600 dark:text-green-400';
  if (v1 < v2) return 'text-red-600 dark:text-red-400';
  return 'text-yellow-600 dark:text-yellow-400'; // Equal values (around 50%)
};

// NFL team logo helper (matches NFL page mapping)
const getNFLTeamLogo = (teamName: string): string => {
  const logoMap: { [key: string]: string } = {
    'Arizona': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
    'Atlanta': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
    'Baltimore': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
    'Buffalo': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
    'Carolina': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
    'Chicago': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
    'Cincinnati': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
    'Cleveland': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
    'Dallas': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
    'Denver': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
    'Detroit': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
    'Green Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
    'Houston': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
    'Indianapolis': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
    'Jacksonville': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
    'Kansas City': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
    'Las Vegas': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
    'Los Angeles Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
    'Los Angeles Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
    'LA Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
    'LA Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
    'Miami': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
    'Minnesota': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
    'New England': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
    'New Orleans': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
    'NY Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
    'NY Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
    'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
    'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
    'San Francisco': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
    'Seattle': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
    'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
    'Tennessee': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
    'Washington': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
  };
  return logoMap[teamName] || '/placeholder.svg';
};

interface NFLTeam {
  city_and_name: string;
  team_name: string;
  team_id: string;
}

export default function NFLAnalytics() {
  const [viewType, setViewType] = useState<"individual" | "game">("individual");
  const [teamStats, setTeamStats] = useState([]);
  const [summary, setSummary] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nflTeams, setNflTeams] = useState<NFLTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamSort, setTeamSort] = useState<{ key: 'teamName' | 'games' | 'winPercentage' | 'coverPercentage' | 'overPercentage'; asc: boolean }>({ key: 'teamName', asc: true });
  
  // Filter states
  const [filters, setFilters] = useState({
    season: '',
    week: '',
    start: '',
    day: '',
    ou_vegas_line: '',
    temperature: '',
    wind_speed: '',
    precipitation_type: '',
    game_stadium_dome: '',
    conference_game: '',
    surface: '',
    // Individual team filters
    priority_team_id: [] as string[],
    opponent_team_id: [] as string[],
    is_home: '',
    spread_closing: '',
    // Game level filters
    home_team_id: '',
    away_team_id: '',
    home_spread: '',
    // Boolean filters
    team_last_spread: '',
    team_last_ou: '',
    team_last_ml: '',
    opponent_last_spread: '',
    opponent_last_ou: '',
    opponent_last_ml: '',
    // Home/Away last game filters
    team_consecutive_home_away: '',
    opponent_consecutive_home_away: ''
  });

  // Range filter states
  const [seasonRange, setSeasonRange] = useState([2018, 2025]);
  const [weekRange, setWeekRange] = useState([1, 18]);
  const [ouLineRange, setOuLineRange] = useState<[number, number]>([35, 60]);
  const [temperatureRange, setTemperatureRange] = useState<[number, number]>([-10, 110]);
  const [windSpeedRange, setWindSpeedRange] = useState<[number, number]>([0, 40]);
  const [spreadRange, setSpreadRange] = useState<[number, number]>([0, 20]);

  // Removed test utilities and buttons (streamlined UI)

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Filter out empty values and add range filters
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      
      // Normalize boolean-like filters
      if (typeof activeFilters.is_home === 'string') {
        if (activeFilters.is_home.toLowerCase() === 'true') activeFilters.is_home = 'true';
        else if (activeFilters.is_home.toLowerCase() === 'false') activeFilters.is_home = 'false';
      }

      console.log('Sending filters to backend:', activeFilters);
      
      // Add range filters
      if (seasonRange[0] !== 2018 || seasonRange[1] !== 2025) {
        activeFilters.season = `${seasonRange[0]},${seasonRange[1]}`;
      }
      if (weekRange[0] !== 1 || weekRange[1] !== 18) {
        activeFilters.week = `${weekRange[0]},${weekRange[1]}`;
      }
      if (ouLineRange[0] !== 35 || ouLineRange[1] !== 60) {
        activeFilters.ou_vegas_line = `${ouLineRange[0]},${ouLineRange[1]}`;
      }
      if (temperatureRange[0] !== -10 || temperatureRange[1] !== 110) {
        activeFilters.temperature = `${temperatureRange[0]},${temperatureRange[1]}`;
      }
      if (windSpeedRange[0] !== 0 || windSpeedRange[1] !== 40) {
        activeFilters.wind_speed = `${windSpeedRange[0]},${windSpeedRange[1]}`;
      }
      if (spreadRange[0] !== 0 || spreadRange[1] !== 20) {
        activeFilters.spread_closing = `${spreadRange[0]},${spreadRange[1]}`;
      }
      
      console.log('Building client-side analytics with filters:', { view_type: viewType, ...activeFilters });

      // Client-side query of v_nfl_training_exploded to ensure local changes reflect immediately
      let q = collegeFootballSupabase
        .from('v_nfl_training_exploded')
        .select('*');

      if (activeFilters.priority_team_id && activeFilters.priority_team_id.length > 0) {
        if (Array.isArray(activeFilters.priority_team_id)) q = q.in('priority_team_id', activeFilters.priority_team_id);
        else q = q.eq('priority_team_id', activeFilters.priority_team_id);
      }
      if (activeFilters.opponent_team_id && activeFilters.opponent_team_id.length > 0) {
        if (Array.isArray(activeFilters.opponent_team_id)) q = q.in('opponent_team_id', activeFilters.opponent_team_id);
        else q = q.eq('opponent_team_id', activeFilters.opponent_team_id);
      }
      if (activeFilters.season) {
        if (String(activeFilters.season).includes(',')) {
          const [minS, maxS] = String(activeFilters.season).split(',').map(Number);
          q = q.gte('season', minS).lte('season', maxS);
        } else q = q.eq('season', activeFilters.season);
      }
      if (activeFilters.week) {
        if (String(activeFilters.week).includes(',')) {
          const [minW, maxW] = String(activeFilters.week).split(',').map(Number);
          q = q.gte('week', minW).lte('week', maxW);
        } else q = q.eq('week', activeFilters.week);
      }
      if (activeFilters.start) q = q.eq('start', activeFilters.start);
      if (activeFilters.ou_vegas_line) {
        if (String(activeFilters.ou_vegas_line).includes(',')) {
          const [minOu, maxOu] = String(activeFilters.ou_vegas_line).split(',').map(Number);
          q = q.gte('ou_vegas_line', minOu).lte('ou_vegas_line', maxOu);
        } else q = q.eq('ou_vegas_line', Number(activeFilters.ou_vegas_line));
      }
      if (activeFilters.spread_closing) {
        if (String(activeFilters.spread_closing).includes(',')) {
          const [minSp, maxSp] = String(activeFilters.spread_closing).split(',').map(Number);
          q = q.gte('spread_closing', minSp).lte('spread_closing', maxSp);
        } else q = q.eq('spread_closing', Number(activeFilters.spread_closing));
      }
      if (activeFilters.surface) q = q.ilike('surface', `%${String(activeFilters.surface)}%`);
      if (activeFilters.game_stadium_dome) q = q.eq('game_stadium_dome', activeFilters.game_stadium_dome);
      if (activeFilters.temperature) {
        if (String(activeFilters.temperature).includes(',')) {
          const [minT, maxT] = String(activeFilters.temperature).split(',').map(Number);
          q = q.gte('temperature', minT).lte('temperature', maxT);
        } else q = q.eq('temperature', Number(activeFilters.temperature));
      }
      if (activeFilters.precipitation_type) q = q.ilike('precipitation_type', `%${String(activeFilters.precipitation_type)}%`);
      if (activeFilters.wind_speed) {
        if (String(activeFilters.wind_speed).includes(',')) {
          const [minWS, maxWS] = String(activeFilters.wind_speed).split(',').map(Number);
          q = q.gte('wind_speed', minWS).lte('wind_speed', maxWS);
        } else q = q.eq('wind_speed', Number(activeFilters.wind_speed));
      }
      if (activeFilters.conference_game) q = q.eq('conference_game', String(activeFilters.conference_game) === 'true');
      for (const k of ['team_last_spread','team_last_ou','team_last_ml','opponent_last_spread','opponent_last_ou','opponent_last_ml'] as const) {
        const v = (activeFilters as any)[k];
        if (v !== undefined && v !== '') q = q.eq(k, Number(v));
      }
      if (activeFilters.is_home !== undefined && activeFilters.is_home !== '') {
        const wantHome = String(activeFilters.is_home).toLowerCase() === 'true' || String(activeFilters.is_home) === '1' || String(activeFilters.is_home).toLowerCase() === 'home';
        q = q.or(wantHome ? 'is_home.eq.true,is_home.eq.1,original_side.eq.home' : 'is_home.eq.false,is_home.eq.0,original_side.eq.away');
      }

      const { data: rows, error: rowsError } = await q;

      if (rowsError) {
        console.error('Supabase query error:', rowsError);
        throw rowsError;
      }

      const list = rows || [];

      // Apply Day of Week filter client-side (derive from game_date)
      const dayFilter = (filters.day || '').toString().toLowerCase();
      const validDays = new Set(['sunday','monday','tuesday','wednesday','thursday','friday','saturday']);
      const getDayNameUTC = (dateString: string) => {
        try {
          if (!dateString) return null;
          // Treat as UTC midnight to avoid TZ skew
          const dt = new Date(`${dateString}T00:00:00Z`);
          if (isNaN(dt.getTime())) return null;
          const names = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
          return names[dt.getUTCDay()];
        } catch {
          return null;
        }
      };
      const dayFiltered = dayFilter && validDays.has(dayFilter)
        ? list.filter((row: any) => {
            const d = getDayNameUTC(row.game_date || row.date || (row.start && row.start.split(' ')[0]) || '');
            return d ? d === dayFilter : true;
          })
        : list;

      // Build team map
      const teamMapLocal = new Map<string, any>();
      const idToTeam = new Map<string, any>();
      nflTeams.forEach(t => idToTeam.set(t.team_id, t));
      dayFiltered.forEach((row: any) => {
        const teamId = row.priority_team_id;
        if (!teamMapLocal.has(teamId)) {
          const tInfo = idToTeam.get(teamId);
          teamMapLocal.set(teamId, {
            teamId,
            teamName: tInfo?.city_and_name || row.priority_team || teamId,
            teamLogo: getNFLTeamLogo(tInfo?.team_name || row.priority_team || ''),
            games: 0,
            wins: 0,
            covers: 0,
            overs: 0,
          });
        }
        const tm = teamMapLocal.get(teamId);
        tm.games += 1;
        if (row.priority_team_won === 1) tm.wins += 1;
        if (row.priority_team_covered === 1) tm.covers += 1;
        if (row.ou_result === 1) tm.overs += 1;
      });

      const builtTeamStats = Array.from(teamMapLocal.values()).map((tm: any) => ({
        teamId: tm.teamId,
        teamName: tm.teamName,
        teamLogo: tm.teamLogo,
        games: tm.games,
        winPercentage: tm.games > 0 ? (tm.wins / tm.games * 100).toFixed(1) : 0,
        coverPercentage: tm.games > 0 ? (tm.covers / tm.games * 100).toFixed(1) : 0,
        overPercentage: tm.games > 0 ? (tm.overs / tm.games * 100).toFixed(1) : 0,
      }));

      // Donut summary (dedupe by unique_id)
      const uniqueMap = new Map<string, any>();
      dayFiltered.forEach((row: any) => {
        const id = String(row.unique_id ?? `${row.game_id ?? ''}-${row.start ?? row.game_date ?? ''}`);
        if (!uniqueMap.has(id)) uniqueMap.set(id, row);
      });
      const games = Array.from(uniqueMap.values());
      const totalGames = games.length;
      const homeWins = games.filter((r: any) => r.home_away_ml === 1).length;
      const homeCovers = games.filter((r: any) => r.home_away_spread_cover === 1).length;
      const favoriteCovers = games.filter((r: any) => r.favorite_covered === 1).length;
      const overs = games.filter((r: any) => r.ou_result === 1).length;

      const builtSummary = {
        totalGames,
        homeWinPercentage: totalGames ? (homeWins / totalGames * 100).toFixed(1) : 0,
        awayWinPercentage: totalGames ? ((totalGames - homeWins) / totalGames * 100).toFixed(1) : 0,
        homeCoverPercentage: totalGames ? (homeCovers / totalGames * 100).toFixed(1) : 0,
        awayCoverPercentage: totalGames ? ((totalGames - homeCovers) / totalGames * 100).toFixed(1) : 0,
        favoriteCoverPercentage: totalGames ? (favoriteCovers / totalGames * 100).toFixed(1) : 0,
        underdogCoverPercentage: totalGames ? ((totalGames - favoriteCovers) / totalGames * 100).toFixed(1) : 0,
        overPercentage: totalGames ? (overs / totalGames * 100).toFixed(1) : 0,
        underPercentage: totalGames ? ((totalGames - overs) / totalGames * 100).toFixed(1) : 0,
      } as any;

      setTeamStats(builtTeamStats);
      setSummary(builtSummary);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [viewType]);

  // Apply filters instantly on change (including range sliders) with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters, seasonRange, weekRange, ouLineRange, temperatureRange, windSpeedRange, spreadRange]);

  // Fetch NFL teams for dropdowns
  useEffect(() => {
    const fetchNFLTeams = async () => {
      try {
        setTeamsLoading(true);
        const { data, error } = await collegeFootballSupabase
          .from('nfl_team_mapping')
          .select('city_and_name, team_name, team_id')
          .order('team_name');
        
        if (error) {
          console.error('Error fetching NFL teams:', error);
          setError(`NFL teams error: ${error.message}`);
          return;
        }
        
        // Deduplicate teams by team_id and prefer current team names
        const teamMap = new Map<string, NFLTeam>();
        
        (data || []).forEach((team: NFLTeam) => {
          const existingTeam = teamMap.get(team.team_id);
          
          // If no existing team or if current team name is more recent (contains "Las Vegas" vs "Oakland")
          if (!existingTeam || 
              (team.city_and_name.includes('Las Vegas') && existingTeam.city_and_name.includes('Oakland'))) {
            teamMap.set(team.team_id, team);
          }
        });
        
        const uniqueTeams = Array.from(teamMap.values());
        setNflTeams(uniqueTeams);
      } catch (error) {
        console.error('Error in fetchNFLTeams:', error);
        setError(`NFL teams error: ${error.message}`);
      } finally {
        setTeamsLoading(false);
      }
    };

    fetchNFLTeams();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    // Convert "any" back to empty string for filtering
    const filterValue = value === "any" ? "" : value;
    console.log('Filter change:', key, 'value:', value, 'filterValue:', filterValue);
    console.log('Current filters before update:', filters);
    setFilters(prev => {
      const newFilters = { ...prev, [key]: filterValue };
      console.log('New filters after update:', newFilters);
      return newFilters;
    });
  };

  const handleMultiSelectChange = (key: string, values: string[]) => {
    console.log('Multi-select change:', key, 'values:', values);
    setFilters(prev => {
      const newFilters = { ...prev, [key]: values };
      console.log('New filters after multi-select update:', newFilters);
      return newFilters;
    });
  };

  const clearFilters = () => {
    setFilters({
      season: '',
      week: '',
      start: '',
      day: '',
      ou_vegas_line: '',
      temperature: '',
      wind_speed: '',
      precipitation_type: '',
      game_stadium_dome: '',
      conference_game: '',
      surface: '',
      priority_team_id: [] as string[],
      opponent_team_id: [] as string[],
      is_home: '',
      spread_closing: '',
      home_team_id: '',
      away_team_id: '',
      home_spread: '',
      team_last_spread: '',
      team_last_ou: '',
      team_last_ml: '',
      opponent_last_spread: '',
      opponent_last_ou: '',
      opponent_last_ml: '',
      team_consecutive_home_away: '',
      opponent_consecutive_home_away: ''
    });
    setSeasonRange([2018, 2025]);
    setWeekRange([1, 18]);
    setOuLineRange([35, 60]);
    setTemperatureRange([-10, 110]);
    setWindSpeedRange([0, 40]);
    setSpreadRange([0, 20]);
  };

  const renderIndividualTeamView = () => (
    <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg">Individual Team Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {teamStats.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">
                    <button
                      className="flex items-center gap-1 hover:underline"
                      onClick={() => setTeamSort(prev => ({ key: 'teamName', asc: prev.key === 'teamName' ? !prev.asc : true }))}
                    >
                      Team {teamSort.key === 'teamName' ? (teamSort.asc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3"/>}
                    </button>
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    <button
                      className="flex items-center gap-1 hover:underline"
                      onClick={() => setTeamSort(prev => ({ key: 'games', asc: prev.key === 'games' ? !prev.asc : true }))}
                    >
                      Games {teamSort.key === 'games' ? (teamSort.asc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3"/>}
                    </button>
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    <button
                      className="flex items-center gap-1 hover:underline"
                      onClick={() => setTeamSort(prev => ({ key: 'winPercentage', asc: prev.key === 'winPercentage' ? !prev.asc : true }))}
                    >
                      Win % {teamSort.key === 'winPercentage' ? (teamSort.asc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3"/>}
                    </button>
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    <button
                      className="flex items-center gap-1 hover:underline"
                      onClick={() => setTeamSort(prev => ({ key: 'coverPercentage', asc: prev.key === 'coverPercentage' ? !prev.asc : true }))}
                    >
                      Cover % {teamSort.key === 'coverPercentage' ? (teamSort.asc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3"/>}
                    </button>
                  </TableHead>
                  <TableHead className="text-xs sm:text-sm">
                    <button
                      className="flex items-center gap-1 hover:underline"
                      onClick={() => setTeamSort(prev => ({ key: 'overPercentage', asc: prev.key === 'overPercentage' ? !prev.asc : true }))}
                    >
                      Over % {teamSort.key === 'overPercentage' ? (teamSort.asc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3"/>}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...teamStats].sort((a: any, b: any) => {
                  const k = teamSort.key;
                  let av: any = a[k];
                  let bv: any = b[k];
                  if (k === 'teamName') {
                    av = String(av || '').toLowerCase();
                    bv = String(bv || '').toLowerCase();
                  } else {
                    av = parseFloat(av ?? 0);
                    bv = parseFloat(bv ?? 0);
                  }
                  const cmp = av < bv ? -1 : av > bv ? 1 : 0;
                  return teamSort.asc ? cmp : -cmp;
                }).map((team: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="flex items-center gap-2 text-xs sm:text-sm">
                      {team.teamLogo && (
                        <img 
                          src={team.teamLogo} 
                          alt={team.teamName}
                          className="w-4 h-4 sm:w-6 sm:h-6"
                        />
                      )}
                      {team.teamName}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">{team.games}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{team.winPercentage}%</TableCell>
                    <TableCell className="text-xs sm:text-sm">{team.coverPercentage}%</TableCell>
                    <TableCell className="text-xs sm:text-sm">{team.overPercentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-xs sm:text-sm">No team data available</p>
        )}
      </CardContent>
    </Card>
  );

  const renderGameLevelView = () => {
    const chartData = [
      { name: 'Home Win', value: parseFloat(summary.homeWinPercentage || 0), color: '#16a34a' },
      { name: 'Away Win', value: parseFloat(summary.awayWinPercentage || 0), color: '#dc2626' }
    ];

    const coverData = [
      { name: 'Home Cover', value: parseFloat(summary.homeCoverPercentage || 0), color: '#16a34a' },
      { name: 'Away Cover', value: parseFloat(summary.awayCoverPercentage || 0), color: '#dc2626' }
    ];

    const favDogCover = [
      { name: 'Favorite', value: parseFloat(summary.favoriteCoverPercentage || 0), color: '#16a34a' },
      { name: 'Dog', value: parseFloat(summary.underdogCoverPercentage || 0), color: '#dc2626' }
    ];

    const ouData = [
      { name: 'Over', value: parseFloat(summary.overPercentage || 0), color: '#16a34a' },
      { name: 'Under', value: parseFloat(summary.underPercentage || 0), color: '#dc2626' }
    ];

    const blocks = [
      { title: 'Win/Loss', data: chartData },
      { title: 'Home/Away Cover', data: coverData },
      { title: 'Favorite/Underdog Cover', data: favDogCover },
      { title: 'Over/Under', data: ouData },
    ];

    const pct = (v: any) => `${Number(parseFloat(v || 0)).toFixed(0)}%`;

    return (
      <>
        {/* Mobile: compact summary card replacing donuts */}
        <div className="block sm:hidden sticky top-0 z-10 bg-background border-b pb-2 mb-4">
          <Card className="shadow-sm bg-slate-50 dark:bg-muted/20 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Container 1: Home/Away Win */}
                <div className="bg-card border border-border rounded-md p-2">
                  <div className="text-[11px] text-muted-foreground mb-1">Wins</div>
                  <div className="flex justify-between">
                    <div>
                      <div className="text-[10px] text-muted-foreground/70">Home</div>
                      <div className={`font-bold ${getColorClass(summary.homeWinPercentage, summary.awayWinPercentage)}`}>
                        {pct(summary.homeWinPercentage)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground/70">Away</div>
                      <div className={`font-bold ${getColorClass(summary.awayWinPercentage, summary.homeWinPercentage)}`}>
                        {pct(summary.awayWinPercentage)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Container 2: Home/Away Cover */}
                <div className="bg-card border border-border rounded-md p-2">
                  <div className="text-[11px] text-muted-foreground mb-1">Covers</div>
                  <div className="flex justify-between">
                    <div>
                      <div className="text-[10px] text-muted-foreground/70">Home</div>
                      <div className={`font-bold ${getColorClass(summary.homeCoverPercentage, summary.awayCoverPercentage)}`}>
                        {pct(summary.homeCoverPercentage)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground/70">Away</div>
                      <div className={`font-bold ${getColorClass(summary.awayCoverPercentage, summary.homeCoverPercentage)}`}>
                        {pct(summary.awayCoverPercentage)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Container 3: Favorite/Underdog Cover */}
                <div className="bg-card border border-border rounded-md p-2">
                  <div className="text-[11px] text-muted-foreground mb-1">Fav/Dog</div>
                  <div className="flex justify-between">
                    <div>
                      <div className="text-[10px] text-muted-foreground/70">Fav</div>
                      <div className={`font-bold ${getColorClass(summary.favoriteCoverPercentage, summary.underdogCoverPercentage)}`}>
                        {pct(summary.favoriteCoverPercentage)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground/70">Dog</div>
                      <div className={`font-bold ${getColorClass(summary.underdogCoverPercentage, summary.favoriteCoverPercentage)}`}>
                        {pct(summary.underdogCoverPercentage)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Container 4: Over/Under */}
                <div className="bg-card border border-border rounded-md p-2">
                  <div className="text-[11px] text-muted-foreground mb-1">O/U</div>
                  <div className="flex justify-between">
                    <div>
                      <div className="text-[10px] text-muted-foreground/70">Over</div>
                      <div className={`font-bold ${getColorClass(summary.overPercentage, summary.underPercentage)}`}>
                        {pct(summary.overPercentage)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground/70">Under</div>
                      <div className={`font-bold ${getColorClass(summary.underPercentage, summary.overPercentage)}`}>
                        {pct(summary.underPercentage)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {blocks.map((b, i) => (
            <Card key={i} className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-sm sm:text-base font-semibold text-center tracking-tight">{b.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <defs>
                      <linearGradient id={`gradGreen-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#16a34a" />
                      </linearGradient>
                      <linearGradient id={`gradRed-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f87171" />
                        <stop offset="100%" stopColor="#dc2626" />
                      </linearGradient>
                      <filter id={`shadow-${i}`} x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.25" />
                      </filter>
                    </defs>
                    <Pie
                      data={b.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      startAngle={90}
                      endAngle={450}
                      paddingAngle={1}
                      cornerRadius={6}
                      stroke="#0b0b0b"
                      strokeWidth={0.8}
                      dataKey="value"
                      label={({ value }) => `${(value as number).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {b.data.map((_, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={`url(#${idx === 0 ? `gradGreen-${i}` : `gradRed-${i}`})`}
                          filter={`url(#shadow-${i})`}
                        />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .slider::-webkit-slider-thumb {
            appearance: none;
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .slider::-moz-range-thumb {
            height: 20px;
            width: 20px;
            border-radius: 50%;
            background: #3b82f6;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .slider::-webkit-slider-track {
            height: 8px;
            border-radius: 4px;
          }
          .slider::-moz-range-track {
            height: 8px;
            border-radius: 4px;
          }
        `
      }} />
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      
      {/* Main Layout: Results Left, Filters Right */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Results (2/3 width) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Summary Donuts */}
          {renderGameLevelView()}

          {/* Loading State */}
          {isLoading && (
            <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
              <CardContent className="text-center py-8">
                <p>Loading data...</p>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
              <CardContent className="text-center py-8">
                <p className="text-destructive">Error: {error}</p>
              </CardContent>
            </Card>
          )}

          {/* Team Table */}
          {!isLoading && !error && renderIndividualTeamView()}
        </div>

        {/* Right Column: Filters (1/3 width) */}
        <div className="space-y-4">
          <div className="sticky top-4 space-y-4">
            
                {/* Action Buttons and Total Games */}
                <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button onClick={clearFilters} className="text-white text-xs sm:text-sm">
                        Clear Filters
                      </Button>
                      <div className="px-3 py-2 bg-slate-100 dark:bg-muted/40 rounded-md border border-border text-center shadow-sm">
                        <div className="text-[11px] text-muted-foreground mb-1">Total Games</div>
                        <div className="font-bold text-foreground text-lg">{summary.totalGames}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

            {/* Filters */}
            <div className="space-y-4">
        {/* Schedule Group */}
        <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="day">Day of Week</Label>
              <Select value={filters.day || 'any'} onValueChange={(value) => handleFilterChange('day', value === 'any' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Any day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="thursday">Thursday</SelectItem>
                  <SelectItem value="saturday">Saturday</SelectItem>
                  <SelectItem value="friday">Friday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Season Range: {seasonRange[0]} - {seasonRange[1]}</Label>
              <div className="px-2 py-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground w-12">Min:</span>
                  <input
                    type="range"
                    min="2018"
                    max="2025"
                    value={seasonRange[0]}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value <= seasonRange[1]) {
                        setSeasonRange([value, seasonRange[1]]);
                      }
                    }}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs text-muted-foreground w-8">{seasonRange[0]}</span>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-xs text-muted-foreground w-12">Max:</span>
                  <input
                    type="range"
                    min="2018"
                    max="2025"
                    value={seasonRange[1]}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= seasonRange[0]) {
                        setSeasonRange([seasonRange[0], value]);
                      }
                    }}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs text-muted-foreground w-8">{seasonRange[1]}</span>
                </div>
              </div>
            </div>
            
            <div>
              <Label>Week Range: {weekRange[0]} - {weekRange[1]}</Label>
              <div className="px-2 py-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground w-12">Min:</span>
                  <input
                    type="range"
                    min="1"
                    max="18"
                    value={weekRange[0]}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value <= weekRange[1]) {
                        setWeekRange([value, weekRange[1]]);
                      }
                    }}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs text-muted-foreground w-8">{weekRange[0]}</span>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-xs text-muted-foreground w-12">Max:</span>
                  <input
                    type="range"
                    min="1"
                    max="18"
                    value={weekRange[1]}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= weekRange[0]) {
                        setWeekRange([weekRange[0], value]);
                      }
                    }}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs text-muted-foreground w-8">{weekRange[1]}</span>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="start">Start Time</Label>
              <Select value={filters.start || 'any'} onValueChange={(value) => handleFilterChange('start', value === 'any' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Any start time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="Day">Day</SelectItem>
                  <SelectItem value="Late">Late</SelectItem>
                  <SelectItem value="Night">Night</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Betting Lines Group */}
        <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Betting Lines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {viewType === "individual" && (
              <div>
                <Label>Spread Range: {spreadRange[0]} to {spreadRange[1]}</Label>
                <div className="px-2 py-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground w-12">Min:</span>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={spreadRange[0]}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (value <= spreadRange[1]) {
                          setSpreadRange([value, spreadRange[1]]);
                        }
                      }}
                      className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                    />
                    <span className="text-xs text-muted-foreground w-8">{spreadRange[0]}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-xs text-muted-foreground w-12">Max:</span>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={spreadRange[1]}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (value >= spreadRange[0]) {
                          setSpreadRange([spreadRange[0], value]);
                        }
                      }}
                      className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                    />
                    <span className="text-xs text-muted-foreground w-8">{spreadRange[1]}</span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>O/U Line Range: {ouLineRange[0]} - {ouLineRange[1]}</Label>
              <div className="px-2 py-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground w-12">Min:</span>
                  <input
                    type="range"
                    min="30"
                    max="70"
                    value={ouLineRange[0]}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value <= ouLineRange[1]) {
                        setOuLineRange([value, ouLineRange[1]]);
                      }
                    }}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs text-muted-foreground w-8">{ouLineRange[0]}</span>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-xs text-muted-foreground w-12">Max:</span>
                  <input
                    type="range"
                    min="30"
                    max="70"
                    value={ouLineRange[1]}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= ouLineRange[0]) {
                        setOuLineRange([ouLineRange[0], value]);
                      }
                    }}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs text-muted-foreground w-8">{ouLineRange[1]}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Game Time Conditions Group */}
        <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Game Time Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="precipitation_type">Precipitation</Label>
              <Select value={filters.precipitation_type} onValueChange={(value) => handleFilterChange('precipitation_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select precipitation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="rain">Rain</SelectItem>
                  <SelectItem value="snow">Snow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Wind Speed Range: {windSpeedRange[0]} mph - {windSpeedRange[1]} mph</Label>
              <div className="px-2 py-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground w-12">Min:</span>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={windSpeedRange[0]}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value <= windSpeedRange[1]) {
                        setWindSpeedRange([value, windSpeedRange[1]]);
                      }
                    }}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs text-muted-foreground w-8">{windSpeedRange[0]}</span>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-xs text-muted-foreground w-12">Max:</span>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={windSpeedRange[1]}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= windSpeedRange[0]) {
                        setWindSpeedRange([windSpeedRange[0], value]);
                      }
                    }}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs text-muted-foreground w-8">{windSpeedRange[1]}</span>
                </div>
              </div>
            </div>

            <div>
              <Label>Temperature Range: {temperatureRange[0]}°F - {temperatureRange[1]}°F</Label>
              <div className="px-2 py-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground w-12">Min:</span>
                  <input
                    type="range"
                    min="-20"
                    max="120"
                    value={temperatureRange[0]}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value <= temperatureRange[1]) {
                        setTemperatureRange([value, temperatureRange[1]]);
                      }
                    }}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs text-muted-foreground w-8">{temperatureRange[0]}°</span>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-xs text-muted-foreground w-12">Max:</span>
                  <input
                    type="range"
                    min="-20"
                    max="120"
                    value={temperatureRange[1]}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value >= temperatureRange[0]) {
                        setTemperatureRange([temperatureRange[0], value]);
                      }
                    }}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs text-muted-foreground w-8">{temperatureRange[1]}°</span>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="game_stadium_dome">Stadium Type</Label>
              <Select value={filters.game_stadium_dome} onValueChange={(value) => handleFilterChange('game_stadium_dome', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stadium type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Dome</SelectItem>
                  <SelectItem value="false">Outdoor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="surface">Surface</Label>
              <Select value={filters.surface} onValueChange={(value) => handleFilterChange('surface', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select surface" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grass">Grass</SelectItem>
                  <SelectItem value="turf">Turf</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Select Team(s) Group */}
        <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Select Team(s)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {viewType === "individual" && (
              <>
                <div>
                  <Label htmlFor="priority_team_id">Primary Teams</Label>
                  <Select 
                    value={filters.priority_team_id.length > 0 ? "multiple" : "any"} 
                    onValueChange={(value) => {
                      if (value === "any") {
                        handleMultiSelectChange('priority_team_id', []);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary teams...">
                        {filters.priority_team_id.length === 0 
                          ? "Any" 
                          : `${filters.priority_team_id.length} team${filters.priority_team_id.length === 1 ? '' : 's'} selected`
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <div className="px-2 py-1 border-b">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMultiSelectChange('priority_team_id', nflTeams.map(t => t.team_id));
                            }}
                          >
                            Select All
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMultiSelectChange('priority_team_id', []);
                            }}
                          >
                            Clear All
                          </Button>
                        </div>
                      </div>
                      {teamsLoading ? (
                        <SelectItem value="loading" disabled>Loading teams...</SelectItem>
                      ) : (
                        nflTeams?.map((team) => (
                          <div key={`primary-${team.team_id}`} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent">
                            <Checkbox
                              id={`primary-${team.team_id}`}
                              checked={filters.priority_team_id.includes(team.team_id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  handleMultiSelectChange('priority_team_id', [...filters.priority_team_id, team.team_id]);
                                } else {
                                  handleMultiSelectChange('priority_team_id', filters.priority_team_id.filter(id => id !== team.team_id));
                                }
                              }}
                            />
                            <Label htmlFor={`primary-${team.team_id}`} className="text-sm cursor-pointer flex-1">
                              {team.city_and_name}
                            </Label>
                          </div>
                        )) || []
                      )}
                    </SelectContent>
                  </Select>
                  {filters.priority_team_id.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-muted-foreground mb-1">Selected teams:</div>
                      <div className="flex flex-wrap gap-1">
                        {filters.priority_team_id.map(teamId => {
                          const team = nflTeams.find(t => t.team_id === teamId);
                          return (
                            <Badge key={teamId} variant="secondary" className="text-xs">
                              {team?.city_and_name || teamId}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="opponent_team_id">Opponent Teams</Label>
                  <Select 
                    value={filters.opponent_team_id.length > 0 ? "multiple" : "any"} 
                    onValueChange={(value) => {
                      if (value === "any") {
                        handleMultiSelectChange('opponent_team_id', []);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select opponent teams...">
                        {filters.opponent_team_id.length === 0 
                          ? "Any" 
                          : `${filters.opponent_team_id.length} team${filters.opponent_team_id.length === 1 ? '' : 's'} selected`
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <div className="px-2 py-1 border-b">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMultiSelectChange('opponent_team_id', nflTeams.map(t => t.team_id));
                            }}
                          >
                            Select All
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMultiSelectChange('opponent_team_id', []);
                            }}
                          >
                            Clear All
                          </Button>
                        </div>
                      </div>
                      {teamsLoading ? (
                        <SelectItem value="loading" disabled>Loading teams...</SelectItem>
                      ) : (
                        nflTeams?.map((team) => (
                          <div key={`opponent-${team.team_id}`} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent">
                            <Checkbox
                              id={`opponent-${team.team_id}`}
                              checked={filters.opponent_team_id.includes(team.team_id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  handleMultiSelectChange('opponent_team_id', [...filters.opponent_team_id, team.team_id]);
                                } else {
                                  handleMultiSelectChange('opponent_team_id', filters.opponent_team_id.filter(id => id !== team.team_id));
                                }
                              }}
                            />
                            <Label htmlFor={`opponent-${team.team_id}`} className="text-sm cursor-pointer flex-1">
                              {team.city_and_name}
                            </Label>
                          </div>
                        )) || []
                      )}
                    </SelectContent>
                  </Select>
                  {filters.opponent_team_id.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-muted-foreground mb-1">Selected teams:</div>
                      <div className="flex flex-wrap gap-1">
                        {filters.opponent_team_id.map(teamId => {
                          const team = nflTeams.find(t => t.team_id === teamId);
                          return (
                            <Badge key={teamId} variant="secondary" className="text-xs">
                              {team?.city_and_name || teamId}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

              {/* Primary Team Side filter using is_home */}
              <div>
                <Label htmlFor="primary_team_side">Primary Team Side</Label>
                <Select value={filters.is_home || 'any'} onValueChange={(value) => handleFilterChange('is_home', value === 'any' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="true">Home</SelectItem>
                    <SelectItem value="false">Away</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              </>
            )}

            <div>
              <Label htmlFor="conference_game">Divisional Game</Label>
              <Select value={filters.conference_game} onValueChange={(value) => handleFilterChange('conference_game', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select divisional game" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Game Level Filters for Team Selection */}
            {viewType === "game" && (
              <>
                <div>
                  <Label htmlFor="home_team_id">Home Team ID</Label>
                  <Input
                    id="home_team_id"
                    value={filters.home_team_id}
                    onChange={(e) => handleFilterChange('home_team_id', e.target.value)}
                    placeholder="Team ID"
                  />
                </div>

                <div>
                  <Label htmlFor="away_team_id">Away Team ID</Label>
                  <Input
                    id="away_team_id"
                    value={filters.away_team_id}
                    onChange={(e) => handleFilterChange('away_team_id', e.target.value)}
                    placeholder="Team ID"
                  />
                </div>

                <div>
                  <Label htmlFor="home_spread">Home Spread</Label>
                  <Input
                    id="home_spread"
                    value={filters.home_spread}
                    onChange={(e) => handleFilterChange('home_spread', e.target.value)}
                    placeholder="-3.5"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Last Game Results/Conditions Group */}
        {viewType === "individual" && (
          <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Last Game Results/Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="team_last_spread">Team Last Spread</Label>
                  <Select value={filters.team_last_spread || "any"} onValueChange={(value) => handleFilterChange('team_last_spread', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="1">Covered</SelectItem>
                      <SelectItem value="0">Didn't Cover</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="team_last_ou">Team Last Over/Under</Label>
                  <Select value={filters.team_last_ou || "any"} onValueChange={(value) => handleFilterChange('team_last_ou', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="1">Over</SelectItem>
                      <SelectItem value="0">Under</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="team_last_ml">Team Last Money Line</Label>
                  <Select value={filters.team_last_ml || "any"} onValueChange={(value) => handleFilterChange('team_last_ml', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="1">Won</SelectItem>
                      <SelectItem value="0">Loss</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="opponent_last_spread">Opponent Last Spread</Label>
                  <Select value={filters.opponent_last_spread || "any"} onValueChange={(value) => handleFilterChange('opponent_last_spread', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="1">Covered</SelectItem>
                      <SelectItem value="0">Didn't Cover</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="opponent_last_ou">Opponent Last Over/Under</Label>
                  <Select value={filters.opponent_last_ou || "any"} onValueChange={(value) => handleFilterChange('opponent_last_ou', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="1">Over</SelectItem>
                      <SelectItem value="0">Under</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="opponent_last_ml">Opponent Last Money Line</Label>
                  <Select value={filters.opponent_last_ml || "any"} onValueChange={(value) => handleFilterChange('opponent_last_ml', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="1">Won</SelectItem>
                      <SelectItem value="0">Loss</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="team_consecutive_home_away">Primary Team Last Game (Home/Away)</Label>
                  <Select value={filters.team_consecutive_home_away || "any"} onValueChange={(value) => handleFilterChange('team_consecutive_home_away', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="away">Away</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="opponent_consecutive_home_away">Opponent Team Last Game (Home/Away)</Label>
                  <Select value={filters.opponent_consecutive_home_away || "any"} onValueChange={(value) => handleFilterChange('opponent_consecutive_home_away', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="away">Away</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
