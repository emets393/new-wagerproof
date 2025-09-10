import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { createClient } from '@supabase/supabase-js';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function NFLAnalytics() {
  const [viewType, setViewType] = useState<"individual" | "game">("individual");
  const [teamStats, setTeamStats] = useState([]);
  const [summary, setSummary] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    season: '',
    week: '',
    start: '',
    ou_vegas_line: '',
    temperature: '',
    wind_speed: '',
    precipitation_type: '',
    game_stadium_dome: '',
    conference_game: '',
    surface: '',
    // Individual team filters
    primary_team__id: '',
    opponent_team_id: '',
    spread_closing: '',
    // Game level filters
    home_team_id: '',
    away_team_id: '',
    home_spread: ''
  });

  // Range filter states
  const [seasonRange, setSeasonRange] = useState([2018, 2025]);
  const [weekRange, setWeekRange] = useState([1, 18]);

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
      
      // Add range filters
      if (seasonRange[0] !== 2018 || seasonRange[1] !== 2025) {
        activeFilters.season = `${seasonRange[0]},${seasonRange[1]}`;
      }
      if (weekRange[0] !== 1 || weekRange[1] !== 18) {
        activeFilters.week = `${weekRange[0]},${weekRange[1]}`;
      }
      
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

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      season: '',
      week: '',
      start: '',
      ou_vegas_line: '',
      temperature: '',
      wind_speed: '',
      precipitation_type: '',
      game_stadium_dome: '',
      conference_game: '',
      surface: '',
      primary_team__id: '',
      opponent_team_id: '',
      spread_closing: '',
      home_team_id: '',
      away_team_id: '',
      home_spread: ''
    });
    setSeasonRange([2018, 2025]);
    setWeekRange([1, 18]);
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
      { name: 'Home Win', value: parseFloat(summary.homeWinPercentage || 0), color: '#0088FE' },
      { name: 'Away Win', value: parseFloat(summary.awayWinPercentage || 0), color: '#00C49F' }
    ];

    const coverData = [
      { name: 'Home Cover', value: parseFloat(summary.homeCoverPercentage || 0), color: '#FFBB28' },
      { name: 'Away Cover', value: parseFloat(summary.awayCoverPercentage || 0), color: '#FF8042' }
    ];

    const ouData = [
      { name: 'Over', value: parseFloat(summary.overPercentage || 0), color: '#0088FE' },
      { name: 'Under', value: parseFloat(summary.underPercentage || 0), color: '#00C49F' }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Win/Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cover/No Cover</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={coverData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                >
                  {coverData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Over/Under</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={ouData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                >
                  {ouData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
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
      
      {/* View Type Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select View Type</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={viewType} onValueChange={(value) => setViewType(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="individual" id="individual" />
              <Label htmlFor="individual">Individual Team Performance</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="game" id="game" />
              <Label htmlFor="game">Game Level Performance</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Common Filters */}
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
                    onMouseDown={(e) => {
                      const slider = e.currentTarget.parentElement;
                      const rect = slider!.getBoundingClientRect();
                      const handleMove = (e: MouseEvent) => {
                        const x = e.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(2018 + percentage * (2025 - 2018));
                        if (value <= seasonRange[1]) {
                          setSeasonRange([value, seasonRange[1]]);
                        }
                      };
                      const handleUp = () => {
                        document.removeEventListener('mousemove', handleMove);
                        document.removeEventListener('mouseup', handleUp);
                      };
                      document.addEventListener('mousemove', handleMove);
                      document.addEventListener('mouseup', handleUp);
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((seasonRange[1] - 2018) / (2025 - 2018)) * 100}%` }}
                    onMouseDown={(e) => {
                      const slider = e.currentTarget.parentElement;
                      const rect = slider!.getBoundingClientRect();
                      const handleMove = (e: MouseEvent) => {
                        const x = e.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(2018 + percentage * (2025 - 2018));
                        if (value >= seasonRange[0]) {
                          setSeasonRange([seasonRange[0], value]);
                        }
                      };
                      const handleUp = () => {
                        document.removeEventListener('mousemove', handleMove);
                        document.removeEventListener('mouseup', handleUp);
                      };
                      document.addEventListener('mousemove', handleMove);
                      document.addEventListener('mouseup', handleUp);
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
                    onMouseDown={(e) => {
                      const slider = e.currentTarget.parentElement;
                      const rect = slider!.getBoundingClientRect();
                      const handleMove = (e: MouseEvent) => {
                        const x = e.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(1 + percentage * (18 - 1));
                        if (value <= weekRange[1]) {
                          setWeekRange([value, weekRange[1]]);
                        }
                      };
                      const handleUp = () => {
                        document.removeEventListener('mousemove', handleMove);
                        document.removeEventListener('mouseup', handleUp);
                      };
                      document.addEventListener('mousemove', handleMove);
                      document.addEventListener('mouseup', handleUp);
                    }}
                  ></div>
                  <div
                    className="absolute top-1/2 w-4 h-4 bg-blue-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 cursor-pointer border-2 border-white shadow-lg"
                    style={{ left: `${((weekRange[1] - 1) / (18 - 1)) * 100}%` }}
                    onMouseDown={(e) => {
                      const slider = e.currentTarget.parentElement;
                      const rect = slider!.getBoundingClientRect();
                      const handleMove = (e: MouseEvent) => {
                        const x = e.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const value = Math.round(1 + percentage * (18 - 1));
                        if (value >= weekRange[0]) {
                          setWeekRange([weekRange[0], value]);
                        }
                      };
                      const handleUp = () => {
                        document.removeEventListener('mousemove', handleMove);
                        document.removeEventListener('mouseup', handleUp);
                      };
                      document.addEventListener('mousemove', handleMove);
                      document.addEventListener('mouseup', handleUp);
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="ou_vegas_line">O/U Line</Label>
              <Input
                id="ou_vegas_line"
                value={filters.ou_vegas_line}
                onChange={(e) => handleFilterChange('ou_vegas_line', e.target.value)}
                placeholder="45.5"
              />
            </div>

            <div>
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                value={filters.temperature}
                onChange={(e) => handleFilterChange('temperature', e.target.value)}
                placeholder="70"
              />
            </div>

            <div>
              <Label htmlFor="wind_speed">Wind Speed</Label>
              <Input
                id="wind_speed"
                value={filters.wind_speed}
                onChange={(e) => handleFilterChange('wind_speed', e.target.value)}
                placeholder="10"
              />
            </div>

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
                  <SelectItem value="sleet">Sleet</SelectItem>
                </SelectContent>
              </Select>
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
              <Label htmlFor="conference_game">Conference Game</Label>
              <Select value={filters.conference_game} onValueChange={(value) => handleFilterChange('conference_game', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select conference game" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
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

            {/* Individual Team Filters */}
            {viewType === "individual" && (
              <>
                <div>
                  <Label htmlFor="primary_team__id">Primary Team ID</Label>
                  <Input
                    id="primary_team__id"
                    value={filters.primary_team__id}
                    onChange={(e) => handleFilterChange('primary_team__id', e.target.value)}
                    placeholder="Team ID"
                  />
                </div>

                <div>
                  <Label htmlFor="opponent_team_id">Opponent Team ID</Label>
                  <Input
                    id="opponent_team_id"
                    value={filters.opponent_team_id}
                    onChange={(e) => handleFilterChange('opponent_team_id', e.target.value)}
                    placeholder="Team ID"
                  />
                </div>

                <div>
                  <Label htmlFor="spread_closing">Spread Closing</Label>
                  <Input
                    id="spread_closing"
                    value={filters.spread_closing}
                    onChange={(e) => handleFilterChange('spread_closing', e.target.value)}
                    placeholder="-3.5"
                  />
                </div>
              </>
            )}

            {/* Game Level Filters */}
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
          </div>

          <div className="flex gap-2 mt-4">
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

      {/* Data Display */}
      {!isLoading && !error && (
        <>
          {viewType === "individual" ? renderIndividualTeamView() : renderGameLevelView()}
        </>
      )}
    </div>
  );
}
