import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { collegeFootballSupabase } from "@/integrations/supabase/college-football-client";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import NFLTeamSelector from './NFLTeamSelector';

// DoughnutChart Component
const DoughnutChart = ({ data, colors, size = 120 }: { 
  data: { name: string; value: number }[], 
  colors: string[], 
  size?: number 
}) => {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.2}
            outerRadius={size * 0.45}
            startAngle={90}
            endAngle={450}
            dataKey="value"
            stroke="none"
            strokeWidth={0}
            style={{
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
            }}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={colors[index % colors.length]}
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Legend Component for Doughnut Charts
const ChartLegend = ({ data, colors }: { 
  data: { name: string; value: number }[], 
  colors: string[] 
}) => {
  return (
    <div className="flex justify-center gap-4 mt-2">
      {data.map((item, index) => (
        <div key={item.name} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: colors[index % colors.length] }}
          ></div>
          <span className="text-xs text-muted-foreground">{item.name}</span>
        </div>
      ))}
    </div>
  );
};

// Simple Dropdown multi-select for string options
const DropdownMultiSelect = ({
  options,
  selectedValues,
  onSelectionChange,
  placeholder,
  className,
}: {
  options: { value: string; label: string }[];
  selectedValues: string[];
  onSelectionChange: (vals: string[]) => void;
  placeholder?: string;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const allSelected = selectedValues.length === options.length;
  const display = selectedValues.length === 0
    ? (placeholder || 'Select')
    : allSelected
      ? 'All selected'
      : options
          .filter(opt => selectedValues.includes(opt.value))
          .map(opt => opt.label)
          .join(', ');

  return (
    <div className={`relative ${className || ''}`} ref={dropdownRef}>
      <button
        type="button"
        className="w-full border rounded-md px-3 py-2 text-sm text-left hover:bg-muted"
        onClick={() => setOpen(prev => !prev)}
      >
        <span className="truncate block">{display}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
          <div className="p-2">
            <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={allSelected}
                onChange={() => {
                  if (allSelected) {
                    onSelectionChange([]);
                  } else {
                    onSelectionChange(options.map(o => o.value));
                  }
                }}
              />
              <span className="text-sm">Select all</span>
            </label>
          </div>
          <div className="py-1">
            {options.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 px-3 py-1 hover:bg-muted cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedValues.includes(opt.value)}
                  onChange={() => toggleValue(opt.value)}
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const GAME_COLUMNS = [
  { key: 'game_date', label: 'Date' },
  { key: 'home_team', label: 'Home Team' },
  { key: 'away_team', label: 'Away Team' },
  { key: 'home_score', label: 'Home Score' },
  { key: 'away_score', label: 'Away Score' },
  { key: 'ou_vegas_line', label: 'O/U Line' },
  { key: 'home_spread', label: 'Home Spread' },
  { key: 'away_spread', label: 'Away Spread' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'wind_speed', label: 'Wind Speed' },
];

const TEAM_COLUMNS = [
  { key: 'game_date', label: 'Date' },
  { key: 'priority_team', label: 'Team' },
  { key: 'opponent_team', label: 'Opponent' },
  { key: 'team_score', label: 'Team Score' },
  { key: 'opp_score', label: 'Opp Score' },
  { key: 'ou_vegas_line', label: 'O/U Line' },
  { key: 'team_spread', label: 'Team Spread' },
  { key: 'opp_spread', label: 'Opp Spread' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'wind_speed', label: 'Wind Speed' },
];

const WEEKS = [
  { value: 1, label: 'Week 1' },
  { value: 2, label: 'Week 2' },
  { value: 3, label: 'Week 3' },
  { value: 4, label: 'Week 4' },
  { value: 5, label: 'Week 5' },
  { value: 6, label: 'Week 6' },
  { value: 7, label: 'Week 7' },
  { value: 8, label: 'Week 8' },
  { value: 9, label: 'Week 9' },
  { value: 10, label: 'Week 10' },
  { value: 11, label: 'Week 11' },
  { value: 12, label: 'Week 12' },
  { value: 13, label: 'Week 13' },
  { value: 14, label: 'Week 14' },
  { value: 15, label: 'Week 15' },
  { value: 16, label: 'Week 16' },
  { value: 17, label: 'Week 17' },
  { value: 18, label: 'Week 18' },
];

const AVAILABLE_SEASONS = [
  { value: 2018, label: '2018' },
  { value: 2019, label: '2019' },
  { value: 2020, label: '2020' },
  { value: 2021, label: '2021' },
  { value: 2022, label: '2022' },
  { value: 2023, label: '2023' },
  { value: 2024, label: '2024' },
  { value: 2025, label: '2025' },
];

const DAY_OPTIONS = [
  { value: 'Sunday', label: 'Sunday' },
  { value: 'Monday', label: 'Monday' },
  { value: 'Tuesday', label: 'Tuesday' },
  { value: 'Wednesday', label: 'Wednesday' },
  { value: 'Thursday', label: 'Thursday' },
  { value: 'Friday', label: 'Friday' },
  { value: 'Saturday', label: 'Saturday' },
];

const START_TIME_OPTIONS = [
  { value: 'Day', label: 'Day' },
  { value: 'Late', label: 'Late' },
  { value: 'Night', label: 'Night' },
];

// Precipitation options (includes None to represent null)
const PRECIP_OPTIONS = [
  { value: 'None', label: 'None' },
  { value: 'Rain', label: 'Rain' },
  { value: 'Snow', label: 'Snow' },
  { value: 'Hail', label: 'Hail' },
];

// Helper function to get day of week from date string (UTC-safe)
const getDayOfWeek = (dateString: string): string => {
  // Ensure we parse as UTC to avoid local timezone shifting the day
  const date = new Date(`${dateString}T00:00:00Z`);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getUTCDay()];
};

// NFL Team Logo Mapping
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

export default function NFLFilterableWinRates() {
  const [summary, setSummary] = useState(null);
  const [gameRows, setGameRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seasonRange, setSeasonRange] = useState<[number, number]>([2018, 2025]);
  const [weekRange, setWeekRange] = useState<[number, number]>([1, 18]);
  const [ouLineRange, setOuLineRange] = useState<[number, number]>([35, 55]);
  const [homeSpreadRange, setHomeSpreadRange] = useState<[number, number]>([-20, 20]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedStartTimes, setSelectedStartTimes] = useState<string[]>([]);
  const [stadiumType, setStadiumType] = useState<string>(''); // '' = All, 'Dome' or 'Open'
  const [selectedPrecipTypes, setSelectedPrecipTypes] = useState<string[]>([]);
  const [temperatureRange, setTemperatureRange] = useState<[number, number]>([-10, 110]);
  const [windSpeedRange, setWindSpeedRange] = useState<[number, number]>([0, 40]);
  const [favoriteFilter, setFavoriteFilter] = useState<string>("all");
  const [viewType, setViewType] = useState<"team" | "game">("team");
  const [selectedHomeTeams, setSelectedHomeTeams] = useState<string[]>([]);
  const [selectedAwayTeams, setSelectedAwayTeams] = useState<string[]>([]);
  const [ouHandleRange, setOuHandleRange] = useState<[number, number]>([0, 100]);
  const [ouBetsRange, setOuBetsRange] = useState<[number, number]>([0, 100]);
  const [homeMlHandleRange, setHomeMlHandleRange] = useState<[number, number]>([0, 100]);
  const [homeMlBetsRange, setHomeMlBetsRange] = useState<[number, number]>([0, 100]);
  const [homeSpreadHandleRange, setHomeSpreadHandleRange] = useState<[number, number]>([0, 100]);
  const [homeSpreadBetsRange, setHomeSpreadBetsRange] = useState<[number, number]>([0, 100]);

  // Fetch data when filters change
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Determine which table to query based on view type
        const tableName = viewType === "game" ? "nfl_training_data" : "v_nfl_training_exploded";
        console.log(`Querying ${tableName} table for ${viewType} view`);
        
        // First, let's check what seasons are available in the database
        const { data: seasonData, error: seasonError } = await collegeFootballSupabase
          .from(tableName)
          .select('season')
          .limit(10000);
        
        if (!seasonError && seasonData) {
          const availableSeasons = [...new Set(seasonData.map(row => row.season))].sort();
          console.log('All available seasons in database:', availableSeasons);
          console.log('Total rows in database:', seasonData.length);
        } else {
          console.error('Error fetching season data:', seasonError);
        }
        
        let query = collegeFootballSupabase
          .from(tableName)
          .select('*')
          .order('game_date', { ascending: false });

        // Apply basic filters
        console.log('Season range:', seasonRange, 'Week range:', weekRange);
        if (seasonRange[0] !== 2018 || seasonRange[1] !== 2025) {
          console.log('Applying season filter:', seasonRange[0], 'to', seasonRange[1]);
          query = query.gte('season', seasonRange[0]).lte('season', seasonRange[1]);
        } else {
          console.log('No season filter applied - using all seasons');
        }
        if (weekRange[0] !== 1 || weekRange[1] !== 18) {
          console.log('Applying week filter:', weekRange[0], 'to', weekRange[1]);
          query = query.gte('week', weekRange[0]).lte('week', weekRange[1]);
        } else {
          console.log('No week filter applied - using all weeks');
        }
        
        // Apply team filters based on view type
        if (viewType === "team") {
          // For individual teams view, use priority_team and opponent_team
          if (selectedHomeTeams.length > 0) {
            query = query.in('priority_team', selectedHomeTeams);
          }
          if (selectedAwayTeams.length > 0) {
            query = query.in('opponent_team', selectedAwayTeams);
          }
        } else {
          // For game level view, use home_team and away_team
          if (selectedHomeTeams.length > 0) {
            query = query.in('home_team', selectedHomeTeams);
          }
          if (selectedAwayTeams.length > 0) {
            query = query.in('away_team', selectedAwayTeams);
          }
        }
        
        if (ouLineRange[0] !== 35 || ouLineRange[1] !== 55) {
          query = query.gte('ou_vegas_line', ouLineRange[0]).lte('ou_vegas_line', ouLineRange[1]);
        }
        
        // Apply home spread filter for game level view
        if (viewType === "game" && (homeSpreadRange[0] !== -20 || homeSpreadRange[1] !== 20)) {
          query = query.gte('home_spread', homeSpreadRange[0]).lte('home_spread', homeSpreadRange[1]);
        }

        const { data: allData, error } = await query.limit(10000);

        if (error) {
          console.error('Frontend: Database error details:', error);
          throw error;
        }

        console.log('Raw data fetched:', allData?.length, 'rows');
        if (allData && allData.length > 0) {
          const uniqueSeasons = [...new Set(allData.map(row => row.season))].sort();
          console.log('Available seasons in data:', uniqueSeasons);
          console.log('Sample data:', allData.slice(0, 3));
          
          // Debug day distribution
          const dayCounts = allData.reduce((acc, game) => {
            const day = getDayOfWeek(game.game_date);
            acc[day] = (acc[day] || 0) + 1;
            return acc;
          }, {});
          console.log('Day distribution in raw data:', dayCounts);
          
          // Debug start time distribution
          const startCounts = allData.reduce((acc, game) => {
            acc[game.start] = (acc[game.start] || 0) + 1;
            return acc;
          }, {});
          console.log('Start time distribution in raw data:', startCounts);
        }

        console.log('Frontend: Received data from database:', allData);
        
        // Process the data
        if (allData && allData.length > 0) {
          let processedData = allData.filter(row => row.ou_result !== null);
          
          // Filter by day of week
          if (selectedDays.length > 0) {
            console.log('Filtering by days:', selectedDays);
            const beforeCount = processedData.length;
            processedData = processedData.filter(game => {
              const dayOfWeek = getDayOfWeek(game.game_date);
              return selectedDays.includes(dayOfWeek);
            });
            console.log(`Day filter: ${beforeCount} -> ${processedData.length} rows`);
          }
          
          // Filter by start time
          if (selectedStartTimes.length > 0) {
            console.log('Filtering by start times:', selectedStartTimes);
            const beforeCount = processedData.length;
            processedData = processedData.filter(game => {
              return selectedStartTimes.includes(game.start);
            });
            console.log(`Start time filter: ${beforeCount} -> ${processedData.length} rows`);
          }

          // Filter by stadium type (dome/open)
          if (stadiumType) {
            const beforeCount = processedData.length;
            const wantDome = stadiumType === 'Dome';
            processedData = processedData.filter(game => {
              // game_stadium_dome is boolean in DB
              return Boolean(game.game_stadium_dome) === wantDome;
            });
            console.log(`Stadium filter (${stadiumType}): ${beforeCount} -> ${processedData.length} rows`);
          }

          // Filter by precipitation type(s)
          if (selectedPrecipTypes.length > 0) {
            const beforeCount = processedData.length;
            const wantsNone = selectedPrecipTypes.includes('None');
            processedData = processedData.filter(game => {
              const val = game.precipitation_type; // could be null
              if (val === null || val === undefined || val === '') {
                return wantsNone;
              }
              return selectedPrecipTypes.includes(String(val));
            });
            console.log(`Precip filter: ${beforeCount} -> ${processedData.length} rows`);
          }

          // Filter by temperature range (exclude nulls only when narrowed)
          if (temperatureRange) {
            const beforeCount = processedData.length;
            const isTempDefault = temperatureRange[0] === -10 && temperatureRange[1] === 110;
            if (!isTempDefault) {
              processedData = processedData.filter(game => {
                const tempVal = game.temperature;
                if (tempVal === null || tempVal === undefined) return false; // exclude nulls when filtering
                const t = Number(tempVal);
                return t >= temperatureRange[0] && t <= temperatureRange[1];
              });
            }
            console.log(`Temperature filter ${temperatureRange[0]}-${temperatureRange[1]} (default=${isTempDefault}): ${beforeCount} -> ${processedData.length} rows`);
          }

          // Filter by wind speed range (exclude nulls only when narrowed)
          if (windSpeedRange) {
            const beforeCount = processedData.length;
            const isWindDefault = windSpeedRange[0] === 0 && windSpeedRange[1] === 40;
            if (!isWindDefault) {
              processedData = processedData.filter(game => {
                const windVal = game.wind_speed;
                if (windVal === null || windVal === undefined) return false; // exclude nulls when filtering
                const w = Number(windVal);
                return w >= windSpeedRange[0] && w <= windSpeedRange[1];
              });
            }
            console.log(`Wind filter ${windSpeedRange[0]}-${windSpeedRange[1]} (default=${isWindDefault}): ${beforeCount} -> ${processedData.length} rows`);
          }
          
          console.log(`Using ${tableName} table with ${processedData.length} rows for ${viewType} view`);

          let summary;
          
          if (viewType === "team") {
            // For individual teams view, calculate team-specific stats
            console.log('Calculating team stats for individual teams view');
            const teamStats = new Map();
            
            processedData.forEach(game => {
              const team = game.priority_team;
              if (!team) return;
              
              if (!teamStats.has(team)) {
                teamStats.set(team, {
                  team: team,
                  totalGames: 0,
                  wins: 0,
                  covers: 0,
                  overs: 0,
                  unders: 0
                });
              }
              
              const stats = teamStats.get(team);
              stats.totalGames++;
              
              if (game.priority_team_won === 1) stats.wins++;
              if (game.priority_team_covered === 1) stats.covers++;
              if (game.ou_result === 1) stats.overs++;
              if (game.ou_result === 0) stats.unders++;
            });
            
            console.log('Team stats map:', teamStats);
            
            // Convert to array and calculate percentages
            const teamStatsArray = Array.from(teamStats.values()).map(stats => ({
              team: stats.team,
              totalGames: stats.totalGames,
              winPct: stats.totalGames > 0 ? +(stats.wins / stats.totalGames * 100).toFixed(1) : 0,
              coverPct: stats.totalGames > 0 ? +(stats.covers / stats.totalGames * 100).toFixed(1) : 0,
              overPct: stats.totalGames > 0 ? +(stats.overs / stats.totalGames * 100).toFixed(1) : 0,
              underPct: stats.totalGames > 0 ? +(stats.unders / stats.totalGames * 100).toFixed(1) : 0
            }));
            
            summary = { teamStats: teamStatsArray };
            console.log('Final team stats array:', teamStatsArray);
          } else {
            // For game level view, calculate overall stats
            const totalGames = processedData.length;
            const homeWins = processedData.filter(game => game.home_score > game.away_score).length;
            const awayWins = processedData.filter(game => game.away_score > game.home_score).length;
            const homeCovers = processedData.filter(game => game.home_away_spread_cover === 1).length;
            const awayCovers = processedData.filter(game => game.home_away_spread_cover === 0).length;
            const overs = processedData.filter(game => game.ou_result === 1).length;
            const unders = processedData.filter(game => game.ou_result === 0).length;

            const overPct = totalGames > 0 ? +(overs / totalGames * 100).toFixed(1) : 0;
            const underPct = +(100.0 - overPct).toFixed(1);
            const homeWinPct = totalGames > 0 ? +(homeWins / totalGames * 100).toFixed(1) : 0;
            const awayWinPct = +(100.0 - homeWinPct).toFixed(1);
            const homeCoverPct = totalGames > 0 ? +(homeCovers / totalGames * 100).toFixed(1) : 0;
            const awayCoverPct = +(100.0 - homeCoverPct).toFixed(1);
            
            summary = {
              homeWinPct,
              awayWinPct,
              homeCoverPct,
              awayCoverPct,
              overPct,
              underPct,
              totalGames
            };
          }

          // Get display columns for table based on view type
          const displayColumns = viewType === "team" ? [
            'game_date', 'priority_team', 'opponent_team', 'team_score', 'opp_score',
            'ou_vegas_line', 'team_spread', 'opp_spread', 'temperature', 'wind_speed',
            'priority_team_won', 'priority_team_covered', 'ou_result'
          ] : [
            'game_date', 'home_team', 'away_team', 'home_score', 'away_score',
            'ou_vegas_line', 'home_spread', 'away_spread', 'temperature', 'wind_speed',
            'home_away_spread_cover', 'ou_result'
          ];
          
          const gameRows = processedData.slice(0, 25).map(row => {
            const obj = {};
            displayColumns.forEach(col => { obj[col] = row[col]; });
            return obj;
          });

          console.log('Setting summary:', summary);
          setSummary(summary);
          setGameRows(gameRows);
        } else {
          console.log('No data received from database');
          setSummary(null);
          setGameRows([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setSummary(null);
        setGameRows([]);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [seasonRange, weekRange, ouLineRange, homeSpreadRange, selectedDays, selectedStartTimes, stadiumType, selectedPrecipTypes, temperatureRange, windSpeedRange, favoriteFilter, viewType, selectedHomeTeams, selectedAwayTeams, ouHandleRange, ouBetsRange, homeMlHandleRange, homeMlBetsRange, homeSpreadHandleRange, homeSpreadBetsRange]);

  console.log('NFLFilterableWinRates render - viewType:', viewType, 'summary:', summary, 'isLoading:', isLoading, 'error:', error);
  
  return (
    <div className="space-y-8">
      {/* Debug Info */}
      <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-4">
        <h3 className="font-bold text-yellow-800">Debug Info</h3>
        <p>View Type: {viewType}</p>
        <p>Loading: {isLoading.toString()}</p>
        <p>Error: {error || 'None'}</p>
        <p>Summary: {summary ? 'Exists' : 'Null'}</p>
        {summary && summary.teamStats && (
          <p>Team Stats Count: {summary.teamStats.length}</p>
        )}
      </div>
      
      {/* Filters UI */}
      <Card className="bg-white border-2 border-primary shadow-lg">
        <CardHeader className="pb-6 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 border-b border-primary/30">
          <CardTitle className="text-xl font-bold text-primary flex items-center gap-3">
            <div className="w-2 h-6 bg-primary rounded-full"></div>
            NFL Filter Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 text-foreground">
            {/* View Type Toggle */}
            <div className="space-y-3">
              <div className="text-sm font-semibold text-primary">View Type</div>
              <RadioGroup 
                value={viewType} 
                onValueChange={(value: "team" | "game") => setViewType(value)}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="team" id="team" />
                  <Label htmlFor="team" className="text-sm font-medium cursor-pointer">
                    Individual Teams
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="game" id="game" />
                  <Label htmlFor="game" className="text-sm font-medium cursor-pointer">
                    Game Level
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Team Selectors */}
            <div className="flex flex-wrap gap-4 items-end">
              {viewType === "team" ? (
                <>
                  <NFLTeamSelector
                    label="Primary Teams"
                    selectedTeams={selectedHomeTeams}
                    onTeamsChange={setSelectedHomeTeams}
                    className="min-w-[200px]"
                  />
                  
                  <NFLTeamSelector
                    label="Opponent Teams"
                    selectedTeams={selectedAwayTeams}
                    onTeamsChange={setSelectedAwayTeams}
                    className="min-w-[200px]"
                  />
                </>
              ) : (
                <>
                  <NFLTeamSelector
                    label="Home Teams"
                    selectedTeams={selectedHomeTeams}
                    onTeamsChange={setSelectedHomeTeams}
                    className="min-w-[200px]"
                  />
                  
                  <NFLTeamSelector
                    label="Away Teams"
                    selectedTeams={selectedAwayTeams}
                    onTeamsChange={setSelectedAwayTeams}
                    className="min-w-[200px]"
                  />
                </>
              )}
            </div>

            {/* Season and Week Range Sliders */}
            <div className="flex flex-wrap gap-6 items-end">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-primary">Season Range</div>
                <Slider
                  value={seasonRange}
                  onValueChange={(value: number[]) => setSeasonRange([value[0], value[1]] as [number, number])}
                  max={2025}
                  min={2018}
                  step={1}
                  className="w-full max-w-xs"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{seasonRange[0]}</span>
                  <span>{seasonRange[1]}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-primary">Week Range</div>
                <Slider
                  value={weekRange}
                  onValueChange={(value: number[]) => setWeekRange([value[0], value[1]] as [number, number])}
                  max={18}
                  min={1}
                  step={1}
                  className="w-full max-w-xs"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{weekRange[0]}</span>
                  <span>{weekRange[1]}</span>
                </div>
              </div>
            </div>

            {/* O/U Line Range */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-primary">O/U Line Range</div>
              <Slider
                value={ouLineRange}
                onValueChange={(value: number[]) => setOuLineRange([value[0], value[1]] as [number, number])}
                max={65}
                min={30}
                step={0.5}
                className="w-full max-w-xs"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{ouLineRange[0]}</span>
                <span>{ouLineRange[1]}</span>
              </div>
            </div>

            {/* Home Spread Range - Only show for game level view */}
            {viewType === "game" && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-primary">Home Spread Range</div>
                <Slider
                  value={homeSpreadRange}
                  onValueChange={(value: number[]) => setHomeSpreadRange([value[0], value[1]] as [number, number])}
                  max={20}
                  min={-20}
                  step={0.5}
                  className="w-full max-w-xs"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{homeSpreadRange[0]}</span>
                  <span>{homeSpreadRange[1]}</span>
                </div>
              </div>
            )}

            {/* Day of Week Filter */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-primary">Day of Week</div>
              <DropdownMultiSelect
                options={DAY_OPTIONS}
                selectedValues={selectedDays}
                onSelectionChange={setSelectedDays}
                placeholder="Select days..."
                className="w-full max-w-xs"
              />
            </div>

            {/* Start Time Filter */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-primary">Start Time</div>
              <DropdownMultiSelect
                options={START_TIME_OPTIONS}
                selectedValues={selectedStartTimes}
                onSelectionChange={setSelectedStartTimes}
                placeholder="Select start times..."
                className="w-full max-w-xs"
              />
            </div>

            {/* Stadium Type Filter */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-primary">Stadium</div>
              <div className="w-full max-w-xs">
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={stadiumType}
                  onChange={(e) => setStadiumType(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="Dome">Dome</option>
                  <option value="Open">Open</option>
                </select>
              </div>
            </div>

            {/* Precipitation Filter */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-primary">Precipitation</div>
              <DropdownMultiSelect
                options={PRECIP_OPTIONS}
                selectedValues={selectedPrecipTypes}
                onSelectionChange={setSelectedPrecipTypes}
                placeholder="Select precipitation types..."
                className="w-full max-w-xs"
              />
            </div>

            {/* Temperature Range */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-primary">Temperature (°F)</div>
              <Slider
                value={temperatureRange}
                onValueChange={(value: number[]) => setTemperatureRange([value[0], value[1]] as [number, number])}
                max={110}
                min={-10}
                step={1}
                className="w-full max-w-xs"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{temperatureRange[0]}°</span>
                <span>{temperatureRange[1]}°</span>
              </div>
            </div>

            {/* Wind Speed Range */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-primary">Wind Speed (mph)</div>
              <Slider
                value={windSpeedRange}
                onValueChange={(value: number[]) => setWindSpeedRange([value[0], value[1]] as [number, number])}
                max={40}
                min={0}
                step={1}
                className="w-full max-w-xs"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{windSpeedRange[0]} mph</span>
                <span>{windSpeedRange[1]} mph</span>
              </div>
            </div>
          </div>

          {/* Active Filters */}
          <div className="mt-6 pt-4 border-t border-primary/20">
            <div className="text-sm font-semibold text-primary mb-3">Active Filters</div>
            <div className="flex flex-wrap gap-2">
              {(seasonRange[0] !== 2018 || seasonRange[1] !== 2025) && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">
                  Seasons: {seasonRange[0]} - {seasonRange[1]}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-blue-600" 
                    onClick={() => setSeasonRange([2018, 2025])}
                  />
                </Badge>
              )}

              {(weekRange[0] !== 1 || weekRange[1] !== 18) && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-green-100 text-green-800 border-green-200 hover:bg-green-200">
                  Weeks: {weekRange[0]} - {weekRange[1]}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-green-600" 
                    onClick={() => setWeekRange([1, 18])}
                  />
                </Badge>
              )}

              {viewType === "game" && (homeSpreadRange[0] !== -20 || homeSpreadRange[1] !== 20) && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200">
                  Home Spread: {homeSpreadRange[0]} - {homeSpreadRange[1]}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-purple-600" 
                    onClick={() => setHomeSpreadRange([-20, 20])}
                  />
                </Badge>
              )}

              {selectedDays.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200">
                  Days: {selectedDays.join(', ')}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-indigo-600" 
                    onClick={() => setSelectedDays([])}
                  />
                </Badge>
              )}

              {selectedStartTimes.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-200">
                  Start Times: {selectedStartTimes.join(', ')}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-teal-600" 
                    onClick={() => setSelectedStartTimes([])}
                  />
                </Badge>
              )}

              {stadiumType && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 hover:bg-fuchsia-200">
                  Stadium: {stadiumType}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-fuchsia-600" 
                    onClick={() => setStadiumType('')}
                  />
                </Badge>
              )}

              {selectedPrecipTypes.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200">
                  Precip: {selectedPrecipTypes.join(', ')}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-sky-600" 
                    onClick={() => setSelectedPrecipTypes([])}
                  />
                </Badge>
              )}

              {(temperatureRange[0] !== -10 || temperatureRange[1] !== 110) && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200">
                  Temp: {temperatureRange[0]}° - {temperatureRange[1]}°
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-rose-600" 
                    onClick={() => setTemperatureRange([-10, 110])}
                  />
                </Badge>
              )}

              {(windSpeedRange[0] !== 0 || windSpeedRange[1] !== 40) && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-lime-100 text-lime-800 border-lime-200 hover:bg-lime-200">
                  Wind: {windSpeedRange[0]} - {windSpeedRange[1]} mph
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-lime-600" 
                    onClick={() => setWindSpeedRange([0, 40])}
                  />
                </Badge>
              )}

              {selectedHomeTeams.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200">
                  {viewType === "team" ? "Primary Teams" : "Home Teams"}: {selectedHomeTeams.length} selected
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-orange-600" 
                    onClick={() => setSelectedHomeTeams([])}
                  />
                </Badge>
              )}

              {selectedAwayTeams.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200">
                  {viewType === "team" ? "Opponent Teams" : "Away Teams"}: {selectedAwayTeams.length} selected
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-amber-600" 
                    onClick={() => setSelectedAwayTeams([])}
                  />
                </Badge>
              )}

              {(ouLineRange[0] !== 35 || ouLineRange[1] !== 55) && (
                <Badge variant="secondary" className="flex items-center gap-2 bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200">
                  O/U Line: {ouLineRange[0]} - {ouLineRange[1]}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-purple-600" 
                    onClick={() => setOuLineRange([35, 55])}
                  />
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Section - Different content based on view type */}
      <Card className="bg-white border-2 border-primary shadow-xl">
        <CardHeader className="pb-6 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 border-b border-primary/30">
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-3">
            <div className="w-2 h-8 bg-primary rounded-full"></div>
            {viewType === "team" ? "Team Performance Summary" : "NFL Win Rate Summary"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
                <div className="text-primary font-medium">Loading {viewType === "team" ? "team performance" : "win rate"} data...</div>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="font-semibold">Error Loading Data</div>
                <div className="text-sm mt-1">{error}</div>
              </div>
            </div>
          ) : summary ? (
            viewType === "team" ? (
              // Team Performance Summary
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-primary mb-2">Team Performance Analytics</h3>
                  <div className="w-32 h-1 bg-primary rounded-full mx-auto"></div>
                </div>
                
                {summary.teamStats && summary.teamStats.length > 0 ? (
                  <div className="overflow-x-auto">
                    <div className="rounded-lg border border-primary/20 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-primary/10">
                            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide border-b border-primary/20 text-left">
                              Team
                            </TableHead>
                            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide border-b border-primary/20 text-center">
                              Win %
                            </TableHead>
                            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide border-b border-primary/20 text-center">
                              Cover %
                            </TableHead>
                            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide border-b border-primary/20 text-center">
                              Over %
                            </TableHead>
                            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide border-b border-primary/20 text-center">
                              Under %
                            </TableHead>
                            <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide border-b border-primary/20 text-center">
                              Games
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.teamStats.map((team, index) => (
                            <TableRow key={team.team} className="hover:bg-primary/5 transition-colors">
                              <TableCell className="text-sm py-4 text-foreground border-b border-primary/10">
                                <div className="flex items-center gap-3">
                                  <img 
                                    src={getNFLTeamLogo(team.team)} 
                                    alt={`${team.team} logo`}
                                    className="h-8 w-8 object-contain"
                                    onError={(e) => {
                                      e.currentTarget.src = '/placeholder.svg';
                                    }}
                                  />
                                  <span className="font-medium text-primary">{team.team}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm py-4 text-foreground border-b border-primary/10 text-center">
                                <span className="text-lg font-bold text-green-600">{team.winPct}%</span>
                              </TableCell>
                              <TableCell className="text-sm py-4 text-foreground border-b border-primary/10 text-center">
                                <span className="text-lg font-bold text-blue-600">{team.coverPct}%</span>
                              </TableCell>
                              <TableCell className="text-sm py-4 text-foreground border-b border-primary/10 text-center">
                                <span className="text-lg font-bold text-red-600">{team.overPct}%</span>
                              </TableCell>
                              <TableCell className="text-sm py-4 text-foreground border-b border-primary/10 text-center">
                                <span className="text-lg font-bold text-cyan-600">{team.underPct}%</span>
                              </TableCell>
                              <TableCell className="text-sm py-4 text-foreground border-b border-primary/10 text-center">
                                <span className="text-sm font-semibold text-gray-600">{team.totalGames}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-muted-foreground bg-muted/50 border border-muted rounded-lg p-6">
                      <div className="text-lg font-semibold mb-2">No Team Data Available</div>
                      <div className="text-sm">Try adjusting your filters to see team performance</div>
                      <div className="text-xs mt-2 text-gray-500">Debug: summary = {JSON.stringify(summary)}</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Game Level Summary (original win rate summary)
              <div className="space-y-8">
                {/* All Doughnut Charts in One Card */}
                <div className="bg-white border-2 border-primary rounded-xl p-6">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-primary mb-2">Performance Analytics</h3>
                    <div className="w-32 h-1 bg-primary rounded-full mx-auto"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Win/Loss Performance */}
                    <div className="text-center">
                      <div className="text-primary text-lg font-semibold mb-4">Win/Loss Performance</div>
                      <div className="flex justify-center mb-4">
                        <div className="relative">
                          <DoughnutChart 
                            data={[
                              { name: 'Home Win', value: summary.homeWinPct || 0 },
                              { name: 'Away Win', value: summary.awayWinPct || 0 }
                            ]}
                            colors={['#22c55e', '#ef4444']}
                            size={140}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-primary font-semibold">Home Win</div>
                          <div className="text-xl font-bold text-foreground">
                            {summary.homeWinPct !== undefined ? `${summary.homeWinPct}%` : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-primary font-semibold">Away Win</div>
                          <div className="text-xl font-bold text-foreground">
                            {summary.awayWinPct !== undefined ? `${summary.awayWinPct}%` : '-'}
                          </div>
                        </div>
                      </div>
                      <ChartLegend 
                        data={[
                          { name: 'Home Win', value: summary.homeWinPct || 0 },
                          { name: 'Away Win', value: summary.awayWinPct || 0 }
                        ]}
                        colors={['#22c55e', '#ef4444']}
                      />
                    </div>

                    {/* Cover Performance */}
                    <div className="text-center">
                      <div className="text-primary text-lg font-semibold mb-4">Cover Performance</div>
                      <div className="flex justify-center mb-4">
                        <div className="relative">
                          <DoughnutChart 
                            data={[
                              { name: 'Home Cover', value: summary.homeCoverPct || 0 },
                              { name: 'Away Cover', value: summary.awayCoverPct || 0 }
                            ]}
                            colors={['#22c55e', '#ef4444']}
                            size={140}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-primary font-semibold">Home Cover</div>
                          <div className="text-xl font-bold text-foreground">
                            {summary.homeCoverPct !== undefined ? `${summary.homeCoverPct}%` : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-primary font-semibold">Away Cover</div>
                          <div className="text-xl font-bold text-foreground">
                            {summary.awayCoverPct !== undefined ? `${summary.awayCoverPct}%` : '-'}
                          </div>
                        </div>
                      </div>
                      <ChartLegend 
                        data={[
                          { name: 'Home Cover', value: summary.homeCoverPct || 0 },
                          { name: 'Away Cover', value: summary.awayCoverPct || 0 }
                        ]}
                        colors={['#22c55e', '#ef4444']}
                      />
                    </div>

                    {/* Over/Under Performance */}
                    <div className="text-center">
                      <div className="text-primary text-lg font-semibold mb-4">Over/Under Performance</div>
                      <div className="flex justify-center mb-4">
                        <div className="relative">
                          <DoughnutChart 
                            data={[
                              { name: 'Over', value: summary.overPct || 0 },
                              { name: 'Under', value: summary.underPct || 0 }
                            ]}
                            colors={['#22c55e', '#ef4444']}
                            size={140}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-primary font-semibold">Over</div>
                          <div className="text-xl font-bold text-foreground">
                            {summary.overPct !== undefined ? `${summary.overPct}%` : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-primary font-semibold">Under</div>
                          <div className="text-xl font-bold text-foreground">
                            {summary.underPct !== undefined ? `${summary.underPct}%` : '-'}
                          </div>
                        </div>
                      </div>
                      <ChartLegend 
                        data={[
                          { name: 'Over', value: summary.overPct || 0 },
                          { name: 'Under', value: summary.underPct || 0 }
                        ]}
                        colors={['#22c55e', '#ef4444']}
                      />
                    </div>
                  </div>
                </div>

                {/* Total Games */}
                <div className="bg-white border-2 border-primary rounded-xl p-6 text-center">
                  <div className="text-primary text-sm font-semibold uppercase tracking-wide mb-2">Total Games Analyzed</div>
                  <div className="text-5xl font-bold text-foreground mb-2">
                    {summary.totalGames !== undefined ? summary.totalGames.toLocaleString() : '-'}
                  </div>
                  <div className="text-muted-foreground text-sm">Based on your current filters</div>
                </div>
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <div className="text-muted-foreground bg-muted/50 border border-muted rounded-lg p-6">
                <div className="text-lg font-semibold mb-2">No Summary Data Available</div>
                <div className="text-sm">Try adjusting your filters to see win rate statistics</div>
                <div className="text-xs mt-2 text-gray-500">Debug: isLoading = {isLoading.toString()}, error = {error || 'none'}, summary = {summary ? 'exists' : 'null'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Game Details - Only show for Game Level view */}
      {viewType === "game" && (
        <Card className="bg-white border-2 border-primary shadow-lg">
          <CardHeader className="pb-6 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 border-b border-primary/30">
            <CardTitle className="text-xl font-bold text-primary flex items-center gap-3">
              <div className="w-2 h-6 bg-primary rounded-full"></div>
              Game Details
              <Badge variant="outline" className="ml-auto text-xs border-primary text-primary bg-white/80">
                {gameRows?.length || 0} games
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
                  <div className="text-primary font-medium">Loading game details...</div>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="text-red-500 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="font-semibold">Error Loading Game Details</div>
                  <div className="text-sm mt-1">{error}</div>
                </div>
              </div>
            ) : gameRows && gameRows.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="rounded-lg border border-primary/20 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/10">
                        {GAME_COLUMNS.map(col => (
                          <TableHead key={col.key} className="font-semibold text-muted-foreground text-xs uppercase tracking-wide border-b border-primary/20">
                            {col.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gameRows.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-primary/5 transition-colors">
                          {GAME_COLUMNS.map(col => (
                            <TableCell key={col.key} className="text-sm py-3 text-foreground border-b border-primary/10">
                              {row[col.key] !== null && row[col.key] !== undefined ? row[col.key] : '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-muted-foreground bg-muted/50 border border-muted rounded-lg p-6">
                  <div className="text-lg font-semibold mb-2">No Game Details Available</div>
                  <div className="text-sm">Try adjusting your filters to see game data</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
