import React, { useState, useEffect } from 'react';
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
import { createClient } from '@supabase/supabase-js';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

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

  const testDatabase = async () => {
    console.log('Testing database tables...');
    
    try {
      const supabase = createClient(
        "https://jpxnjuwglavsjbgbasnl.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo"
      );

      console.log('Supabase client created');

      // Test nfl_team_mapping table
      console.log('Testing nfl_team_mapping table...');
      const { data: teamMapping, error: teamError } = await supabase
        .from('nfl_team_mapping')
        .select('*')
        .limit(5);
      
      console.log('Team mapping result:', { data: teamMapping, error: teamError });

      // Test v_nfl_training_exploded table
      console.log('Testing v_nfl_training_exploded table...');
      const { data: nflData, error: nflError } = await supabase
        .from('v_nfl_training_exploded')
        .select('*')
        .limit(5);
      
      console.log('NFL data result:', { data: nflData, error: nflError });

      // Test nfl_training_data table
      console.log('Testing nfl_training_data table...');
      const { data: trainingData, error: trainingError } = await supabase
        .from('nfl_training_data')
        .select('*')
        .limit(5);
      
      console.log('Training data result:', { data: trainingData, error: trainingError });

    } catch (err) {
      console.error('Database test error:', err);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Filter out empty values and add range filters
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      
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
      
      console.log('Sending API request with filters:', {
        view_type: viewType,
        ...activeFilters
      });
      
      const response = await fetch('https://jpxnjuwglavsjbgbasnl.supabase.co/functions/v1/filter-nfl-training-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo'
        },
        body: JSON.stringify({
          filters: {
            view_type: viewType,
            ...activeFilters
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Fetched data:', data);
      console.log('Team stats length:', data.teamStats?.length);
      console.log('Summary:', data.summary);
      
      if (data.error) {
        console.error('Edge function error:', data.error);
        setError(data.error);
        return;
      }
      
      setTeamStats(data.teamStats || []);
      setSummary(data.summary || {});
      
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

  // Separate effect for filters to avoid infinite loops
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 500); // Debounce filter changes
    
    return () => clearTimeout(timeoutId);
  }, [filters]);

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
    <Card>
      <CardHeader>
        <CardTitle>Individual Team Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {teamStats.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Games</TableHead>
                <TableHead>Win %</TableHead>
                <TableHead>Cover %</TableHead>
                <TableHead>Over %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamStats.map((team, index) => (
                <TableRow key={index}>
                  <TableCell className="flex items-center gap-2">
                    {team.teamLogo && (
                      <img 
                        src={team.teamLogo} 
                        alt={team.teamName}
                        className="w-6 h-6"
                      />
                    )}
                    {team.teamName}
                  </TableCell>
                  <TableCell>{team.games}</TableCell>
                  <TableCell>{team.winPercentage}%</TableCell>
                  <TableCell>{team.coverPercentage}%</TableCell>
                  <TableCell>{team.overPercentage}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p>No team data available</p>
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

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {blocks.map((b, i) => (
          <Card key={i}>
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-base font-semibold text-center tracking-tight">{b.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
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
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-primary mb-4">NFL Analytics</h1>
        <p className="text-lg text-muted-foreground">
          Analyze NFL team and game performance with advanced filtering options. 
        </p>
      </div>
      
      {/* Summary Donuts */}
      <div className="mb-2 text-center text-sm text-muted-foreground">
        Total games: {Number((summary as any)?.totalGames || 0)}
      </div>
      {renderGameLevelView()}

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Schedule Group */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <div className="relative h-8">
                  <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-200 rounded-full transform -translate-y-1/2"></div>
                  <div 
                    className="absolute top-1/2 h-2 bg-blue-500 rounded-full transform -translate-y-1/2"
                    style={{
                      left: `${((seasonRange[0] - 2018) / (2025 - 2018)) * 100}%`,
                      width: `${((seasonRange[1] - seasonRange[0]) / (2025 - 2018)) * 100}%`
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((seasonRange[0] - 2018) / (2025 - 2018)) * 100}%` }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const handleEl = e.currentTarget as HTMLElement;
                      handleEl.setPointerCapture(e.pointerId);
                      const slider = handleEl.parentElement!;
                      const getRect = () => slider.getBoundingClientRect();
                      const onMove = (pe: PointerEvent) => {
                        const rect = getRect();
                        const x = pe.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(2018 + percentage * (2025 - 2018));
                        if (value <= seasonRange[1]) {
                          setSeasonRange([value, seasonRange[1]]);
                        }
                      };
                      const onUp = (pe: PointerEvent) => {
                        handleEl.releasePointerCapture(pe.pointerId);
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((seasonRange[1] - 2018) / (2025 - 2018)) * 100}%` }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const handleEl = e.currentTarget as HTMLElement;
                      handleEl.setPointerCapture(e.pointerId);
                      const slider = handleEl.parentElement!;
                      const getRect = () => slider.getBoundingClientRect();
                      const onMove = (pe: PointerEvent) => {
                        const rect = getRect();
                        const x = pe.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(2018 + percentage * (2025 - 2018));
                        if (value >= seasonRange[0]) {
                          setSeasonRange([seasonRange[0], value]);
                        }
                      };
                      const onUp = (pe: PointerEvent) => {
                        handleEl.releasePointerCapture(pe.pointerId);
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div>
              <Label>Week Range: {weekRange[0]} - {weekRange[1]}</Label>
              <div className="px-2 py-2">
                <div className="relative h-8">
                  <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-200 rounded-full transform -translate-y-1/2"></div>
                  <div 
                    className="absolute top-1/2 h-2 bg-blue-500 rounded-full transform -translate-y-1/2"
                    style={{
                      left: `${((weekRange[0] - 1) / (18 - 1)) * 100}%`,
                      width: `${((weekRange[1] - weekRange[0]) / (18 - 1)) * 100}%`
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((weekRange[0] - 1) / (18 - 1)) * 100}%` }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const handleEl = e.currentTarget as HTMLElement;
                      handleEl.setPointerCapture(e.pointerId);
                      const slider = handleEl.parentElement!;
                      const getRect = () => slider.getBoundingClientRect();
                      const onMove = (pe: PointerEvent) => {
                        const rect = getRect();
                        const x = pe.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(1 + percentage * (18 - 1));
                        if (value <= weekRange[1]) {
                          setWeekRange([value, weekRange[1]]);
                        }
                      };
                      const onUp = (pe: PointerEvent) => {
                        handleEl.releasePointerCapture(pe.pointerId);
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((weekRange[1] - 1) / (18 - 1)) * 100}%` }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const handleEl = e.currentTarget as HTMLElement;
                      handleEl.setPointerCapture(e.pointerId);
                      const slider = handleEl.parentElement!;
                      const getRect = () => slider.getBoundingClientRect();
                      const onMove = (pe: PointerEvent) => {
                        const rect = getRect();
                        const x = pe.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(1 + percentage * (18 - 1));
                        if (value >= weekRange[0]) {
                          setWeekRange([weekRange[0], value]);
                        }
                      };
                      const onUp = (pe: PointerEvent) => {
                        handleEl.releasePointerCapture(pe.pointerId);
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  ></div>
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
        <Card>
          <CardHeader>
            <CardTitle>Betting Lines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {viewType === "individual" && (
              <div>
                <Label>Spread Range: {spreadRange[0]} to {spreadRange[1]}</Label>
                <div className="px-2 py-2">
                  <div className="relative h-8">
                    <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-200 rounded-full transform -translate-y-1/2"></div>
                    <div 
                      className="absolute top-1/2 h-2 bg-blue-500 rounded-full transform -translate-y-1/2"
                      style={{
                        left: `${(spreadRange[0] / 20) * 100}%`,
                        width: `${((spreadRange[1] - spreadRange[0]) / 20) * 100}%`
                      }}
                    ></div>
                    <div
                      className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                      style={{ left: `${(spreadRange[0] / 20) * 100}%` }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        const handleEl = e.currentTarget as HTMLElement;
                        handleEl.setPointerCapture(e.pointerId);
                        const slider = handleEl.parentElement!;
                        const getRect = () => slider.getBoundingClientRect();
                        const onMove = (pe: PointerEvent) => {
                          const rect = getRect();
                          const x = pe.clientX - rect.left;
                          const percentage = Math.max(0, Math.min(1, x / rect.width));
                          const value = Math.round(percentage * 20);
                          if (value <= spreadRange[1]) {
                            setSpreadRange([value, spreadRange[1]]);
                          }
                        };
                        const onUp = (pe: PointerEvent) => {
                          handleEl.releasePointerCapture(pe.pointerId);
                          window.removeEventListener('pointermove', onMove);
                          window.removeEventListener('pointerup', onUp);
                        };
                        window.addEventListener('pointermove', onMove);
                        window.addEventListener('pointerup', onUp);
                      }}
                    ></div>
                    <div
                      className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                      style={{ left: `${(spreadRange[1] / 20) * 100}%` }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        const handleEl = e.currentTarget as HTMLElement;
                        handleEl.setPointerCapture(e.pointerId);
                        const slider = handleEl.parentElement!;
                        const getRect = () => slider.getBoundingClientRect();
                        const onMove = (pe: PointerEvent) => {
                          const rect = getRect();
                          const x = pe.clientX - rect.left;
                          const percentage = Math.max(0, Math.min(1, x / rect.width));
                          const value = Math.round(percentage * 20);
                          if (value >= spreadRange[0]) {
                            setSpreadRange([spreadRange[0], value]);
                          }
                        };
                        const onUp = (pe: PointerEvent) => {
                          handleEl.releasePointerCapture(pe.pointerId);
                          window.removeEventListener('pointermove', onMove);
                          window.removeEventListener('pointerup', onUp);
                        };
                        window.addEventListener('pointermove', onMove);
                        window.addEventListener('pointerup', onUp);
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>O/U Line Range: {ouLineRange[0]} - {ouLineRange[1]}</Label>
              <div className="px-2 py-2">
                <div className="relative h-8">
                  <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-200 rounded-full transform -translate-y-1/2"></div>
                  <div 
                    className="absolute top-1/2 h-2 bg-blue-500 rounded-full transform -translate-y-1/2"
                    style={{
                      left: `${((ouLineRange[0] - 30) / (70 - 30)) * 100}%`,
                      width: `${((ouLineRange[1] - ouLineRange[0]) / (70 - 30)) * 100}%`
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((ouLineRange[0] - 30) / (70 - 30)) * 100}%` }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const handleEl = e.currentTarget as HTMLElement;
                      handleEl.setPointerCapture(e.pointerId);
                      const slider = handleEl.parentElement!;
                      const getRect = () => slider.getBoundingClientRect();
                      const onMove = (pe: PointerEvent) => {
                        const rect = getRect();
                        const x = pe.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(30 + percentage * (70 - 30));
                        if (value <= ouLineRange[1]) {
                          setOuLineRange([value, ouLineRange[1]]);
                        }
                      };
                      const onUp = (pe: PointerEvent) => {
                        handleEl.releasePointerCapture(pe.pointerId);
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((ouLineRange[1] - 30) / (70 - 30)) * 100}%` }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const handleEl = e.currentTarget as HTMLElement;
                      handleEl.setPointerCapture(e.pointerId);
                      const slider = handleEl.parentElement!;
                      const getRect = () => slider.getBoundingClientRect();
                      const onMove = (pe: PointerEvent) => {
                        const rect = getRect();
                        const x = pe.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(30 + percentage * (70 - 30));
                        if (value >= ouLineRange[0]) {
                          setOuLineRange([ouLineRange[0], value]);
                        }
                      };
                      const onUp = (pe: PointerEvent) => {
                        handleEl.releasePointerCapture(pe.pointerId);
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Game Time Conditions Group */}
        <Card>
          <CardHeader>
            <CardTitle>Game Time Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <div className="relative h-8">
                  <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-200 rounded-full transform -translate-y-1/2"></div>
                  <div 
                    className="absolute top-1/2 h-2 bg-blue-500 rounded-full transform -translate-y-1/2"
                    style={{
                      left: `${((windSpeedRange[0] - 0) / (60 - 0)) * 100}%`,
                      width: `${((windSpeedRange[1] - windSpeedRange[0]) / (60 - 0)) * 100}%`
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((windSpeedRange[0] - 0) / (60 - 0)) * 100}%` }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const handleEl = e.currentTarget as HTMLElement;
                      handleEl.setPointerCapture(e.pointerId);
                      const slider = handleEl.parentElement!;
                      const getRect = () => slider.getBoundingClientRect();
                      const onMove = (pe: PointerEvent) => {
                        const rect = getRect();
                        const x = pe.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(0 + percentage * (60 - 0));
                        if (value <= windSpeedRange[1]) {
                          setWindSpeedRange([value, windSpeedRange[1]]);
                        }
                      };
                      const onUp = (pe: PointerEvent) => {
                        handleEl.releasePointerCapture(pe.pointerId);
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((windSpeedRange[1] - 0) / (60 - 0)) * 100}%` }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const handleEl = e.currentTarget as HTMLElement;
                      handleEl.setPointerCapture(e.pointerId);
                      const slider = handleEl.parentElement!;
                      const getRect = () => slider.getBoundingClientRect();
                      const onMove = (pe: PointerEvent) => {
                        const rect = getRect();
                        const x = pe.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(0 + percentage * (60 - 0));
                        if (value >= windSpeedRange[0]) {
                          setWindSpeedRange([windSpeedRange[0], value]);
                        }
                      };
                      const onUp = (pe: PointerEvent) => {
                        handleEl.releasePointerCapture(pe.pointerId);
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div>
              <Label>Temperature Range: {temperatureRange[0]}°F - {temperatureRange[1]}°F</Label>
              <div className="px-2 py-2">
                <div className="relative h-8">
                  <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-200 rounded-full transform -translate-y-1/2"></div>
                  <div 
                    className="absolute top-1/2 h-2 bg-blue-500 rounded-full transform -translate-y-1/2"
                    style={{
                      left: `${((temperatureRange[0] - -20) / (120 - -20)) * 100}%`,
                      width: `${((temperatureRange[1] - temperatureRange[0]) / (120 - -20)) * 100}%`
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((temperatureRange[0] - -20) / (120 - -20)) * 100}%` }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const handleEl = e.currentTarget as HTMLElement;
                      handleEl.setPointerCapture(e.pointerId);
                      const slider = handleEl.parentElement!;
                      const getRect = () => slider.getBoundingClientRect();
                      const onMove = (pe: PointerEvent) => {
                        const rect = getRect();
                        const x = pe.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(-20 + percentage * (120 - -20));
                        if (value <= temperatureRange[1]) {
                          setTemperatureRange([value, temperatureRange[1]]);
                        }
                      };
                      const onUp = (pe: PointerEvent) => {
                        handleEl.releasePointerCapture(pe.pointerId);
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((temperatureRange[1] - -20) / (120 - -20)) * 100}%` }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const handleEl = e.currentTarget as HTMLElement;
                      handleEl.setPointerCapture(e.pointerId);
                      const slider = handleEl.parentElement!;
                      const getRect = () => slider.getBoundingClientRect();
                      const onMove = (pe: PointerEvent) => {
                        const rect = getRect();
                        const x = pe.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(-20 + percentage * (120 - -20));
                        if (value >= temperatureRange[0]) {
                          setTemperatureRange([temperatureRange[0], value]);
                        }
                      };
                      const onUp = (pe: PointerEvent) => {
                        handleEl.releasePointerCapture(pe.pointerId);
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  ></div>
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
        <Card>
          <CardHeader>
            <CardTitle>Select Team(s)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Last Game Results/Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Action Buttons */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button onClick={clearFilters} variant="outline">
              Clear Filters
            </Button>
            <Button onClick={fetchData}>
              Apply Filters
            </Button>
            <Button onClick={() => {
              console.log('Testing edge function...');
              fetchData();
            }} variant="secondary">
              Test Edge Function
            </Button>
            <Button onClick={testDatabase} variant="outline">
              Test Database Tables
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <p>Loading data...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-500">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Team Table (non-deduped) */}
      {!isLoading && !error && renderIndividualTeamView()}
    </div>
  );
}
