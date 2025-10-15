console.log("Loaded TOP-LEVEL src/components/FilterableWinRates.tsx");
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

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

const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

const AVAILABLE_SEASONS = [2024, 2025]; // You can update this as needed

// Dropdown multi-select component
const DropdownMultiSelect = ({ label, options, selected, setSelected }: {
  label: string,
  options: { value: number, label: string }[],
  selected: number[],
  setSelected: (vals: number[]) => void
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedLabels = options.filter(opt => selected.includes(opt.value)).map(opt => opt.label);
  const allSelected = selected.length === options.length;
  const displayLabel = allSelected ? label : selectedLabels.length > 0 ? selectedLabels.join(", ") : `Select ${label}`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="border rounded px-3 py-2 min-w-[120px] text-left bg-white shadow-sm hover:border-primary focus:outline-none"
        onClick={() => setOpen(o => !o)}
      >
        <span className={selectedLabels.length === 0 ? "text-gray-400" : ""}>{displayLabel}</span>
        <span className="float-right ml-2">▼</span>
      </button>
              {open && (
          <div className="absolute z-10 mt-1 bg-white border rounded shadow-lg p-2 min-w-[140px] max-h-60 overflow-y-auto">
            {/* Select All option */}
            <label className="flex items-center gap-2 py-1 cursor-pointer border-b border-gray-200 pb-2 mb-1">
              <input
                type="checkbox"
                checked={selected.length === options.length}
                onChange={e => {
                  if (e.target.checked) {
                    setSelected(options.map(opt => opt.value));
                  } else {
                    setSelected([]);
                  }
                }}
              />
              <span className="font-medium text-gray-700">Select All</span>
            </label>
            {options.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelected([...selected, opt.value]);
                    } else {
                      setSelected(selected.filter(v => v !== opt.value));
                    }
                  }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        )}
    </div>
  );
};

// Betting Filters Dropdown Component
const BettingFiltersDropdown = ({ 
  isOpen, 
  onToggle, 
  ouLineRange,
  setOuLineRange,
  ouHandleRange, 
  setOuHandleRange, 
  ouBetsRange, 
  setOuBetsRange,
  homeMlHandleRange,
  setHomeMlHandleRange,
  homeMlBetsRange,
  setHomeMlBetsRange,
  homeRlHandleRange,
  setHomeRlHandleRange,
  homeRlBetsRange,
  setHomeRlBetsRange
}: {
  isOpen: boolean;
  onToggle: () => void;
  ouLineRange: [number, number];
  setOuLineRange: (range: [number, number]) => void;
  ouHandleRange: [number, number];
  setOuHandleRange: (range: [number, number]) => void;
  ouBetsRange: [number, number];
  setOuBetsRange: (range: [number, number]) => void;
  homeMlHandleRange: [number, number];
  setHomeMlHandleRange: (range: [number, number]) => void;
  homeMlBetsRange: [number, number];
  setHomeMlBetsRange: (range: [number, number]) => void;
  homeRlHandleRange: [number, number];
  setHomeRlHandleRange: (range: [number, number]) => void;
  homeRlBetsRange: [number, number];
  setHomeRlBetsRange: (range: [number, number]) => void;
}) => {
  return (
    <div className="relative">
      <button
        type="button"
        className="border rounded px-3 py-2 min-w-[140px] text-left bg-white shadow-sm hover:border-primary focus:outline-none"
        onClick={onToggle}
      >
        <span>Betting Filters</span>
        <span className="float-right ml-2">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 bg-white border rounded shadow-lg p-4 min-w-[300px] max-h-96 overflow-y-auto">
          <div className="space-y-4">
            {/* Over/Under Line Range */}
            <div className="space-y-2">
              <div className="font-semibold text-sm">O/U Line Range</div>
              <Slider
                value={ouLineRange}
                onValueChange={(value: number[]) => setOuLineRange([value[0], value[1]] as [number, number])}
                max={20}
                min={0}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{ouLineRange[0]}</span>
                <span>{ouLineRange[1]}</span>
              </div>
            </div>

            {/* Over/Under Handle Range */}
            <div className="space-y-2">
              <div className="font-semibold text-sm">O/U Handle %</div>
              <Slider
                value={ouHandleRange}
                onValueChange={(value: number[]) => setOuHandleRange([value[0], value[1]] as [number, number])}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{ouHandleRange[0]}%</span>
                <span>{ouHandleRange[1]}%</span>
              </div>
            </div>

            {/* Over/Under Bets Range */}
            <div className="space-y-2">
              <div className="font-semibold text-sm">O/U Bets %</div>
              <Slider
                value={ouBetsRange}
                onValueChange={(value: number[]) => setOuBetsRange([value[0], value[1]] as [number, number])}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{ouBetsRange[0]}%</span>
                <span>{ouBetsRange[1]}%</span>
              </div>
            </div>

            {/* Home Moneyline Handle Range */}
            <div className="space-y-2">
              <div className="font-semibold text-sm">Home ML Handle %</div>
              <Slider
                value={homeMlHandleRange}
                onValueChange={(value: number[]) => setHomeMlHandleRange([value[0], value[1]] as [number, number])}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{homeMlHandleRange[0]}%</span>
                <span>{homeMlHandleRange[1]}%</span>
              </div>
            </div>

            {/* Home Moneyline Bets Range */}
            <div className="space-y-2">
              <div className="font-semibold text-sm">Home ML Bets %</div>
              <Slider
                value={homeMlBetsRange}
                onValueChange={(value: number[]) => setHomeMlBetsRange([value[0], value[1]] as [number, number])}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{homeMlBetsRange[0]}%</span>
                <span>{homeMlBetsRange[1]}%</span>
              </div>
            </div>

            {/* Home Runline Handle Range */}
            <div className="space-y-2">
              <div className="font-semibold text-sm">Home RL Handle %</div>
              <Slider
                value={homeRlHandleRange}
                onValueChange={(value: number[]) => setHomeRlHandleRange([value[0], value[1]] as [number, number])}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{homeRlHandleRange[0]}%</span>
                <span>{homeRlHandleRange[1]}%</span>
              </div>
            </div>

            {/* Home Runline Bets Range */}
            <div className="space-y-2">
              <div className="font-semibold text-sm">Home RL Bets %</div>
              <Slider
                value={homeRlBetsRange}
                onValueChange={(value: number[]) => setHomeRlBetsRange([value[0], value[1]] as [number, number])}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{homeRlBetsRange[0]}%</span>
                <span>{homeRlBetsRange[1]}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Doughnut Chart Component
const DoughnutChart = ({ data, colors, size = 120 }: { 
  data: { name: string; value: number }[], 
  colors: string[], 
  size?: number 
}) => {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {/* 3D Effect - Bottom shadow layer */}
          <Pie
            data={data}
            cx="50%"
            cy="52%"
            innerRadius={size * 0.25}
            outerRadius={size * 0.45}
            startAngle={90}
            endAngle={450}
            dataKey="value"
            stroke="none"
            fill="rgba(0,0,0,0.2)"
          >
            {data.map((entry, index) => (
              <Cell key={`shadow-${index}`} fill="rgba(0,0,0,0.2)" />
            ))}
          </Pie>
          
          {/* Main chart */}
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.25}
            outerRadius={size * 0.45}
            startAngle={90}
            endAngle={450}
            dataKey="value"
            stroke="none"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={colors[index % colors.length]}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                className="drop-shadow-lg"
              />
            ))}
          </Pie>
          
          {/* 3D Effect - Highlight layer */}
          <Pie
            data={data}
            cx="50%"
            cy="48%"
            innerRadius={size * 0.25}
            outerRadius={size * 0.45}
            startAngle={90}
            endAngle={450}
            dataKey="value"
            stroke="none"
            fill="rgba(255,255,255,0.3)"
          >
            {data.map((entry, index) => (
              <Cell key={`highlight-${index}`} fill="rgba(255,255,255,0.3)" />
            ))}
          </Pie>
          
          {/* Inner ring for 3D effect */}
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.2}
            outerRadius={size * 0.25}
            startAngle={90}
            endAngle={450}
            dataKey="value"
            stroke="none"
            fill="rgba(0,0,0,0.1)"
          >
            {data.map((entry, index) => (
              <Cell key={`inner-${index}`} fill="rgba(0,0,0,0.1)" />
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

export default function FilterableWinRates() {
  const [summary, setSummary] = useState(null);
  const [gameRows, setGameRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([2024, 2025]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [ouLineRange, setOuLineRange] = useState<[number, number]>([6.5, 12.5]);
  const [favoriteFilter, setFavoriteFilter] = useState<string>("all");
  const [homePitcherHand, setHomePitcherHand] = useState<string>("all");
  const [awayPitcherHand, setAwayPitcherHand] = useState<string>("all");
  
  // Betting volume filters
  const [ouHandleRange, setOuHandleRange] = useState<[number, number]>([0, 100]);
  const [ouBetsRange, setOuBetsRange] = useState<[number, number]>([0, 100]);
  const [homeMlHandleRange, setHomeMlHandleRange] = useState<[number, number]>([0, 100]);
  const [homeMlBetsRange, setHomeMlBetsRange] = useState<[number, number]>([0, 100]);
  const [homeRlHandleRange, setHomeRlHandleRange] = useState<[number, number]>([0, 100]);
  const [homeRlBetsRange, setHomeRlBetsRange] = useState<[number, number]>([0, 100]);
  const [bettingFiltersOpen, setBettingFiltersOpen] = useState(false);

  // Helper to build filters object
  const buildFilters = () => {
    const filters: Record<string, string> = {};
    if (selectedSeasons.length > 0) {
      filters.season = selectedSeasons.join(',');
    }
    if (selectedMonths.length > 0) {
      filters.month = selectedMonths.join(',');
    }
    return filters;
  };

  // Fetch summary and game details when filters change
  useEffect(() => {
    console.log("Selected seasons:", selectedSeasons);
    console.log("Selected months:", selectedMonths);
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const filters = {
          season: selectedSeasons.length > 0 ? selectedSeasons.join(',') : undefined,
          month: selectedMonths.length > 0 ? selectedMonths.join(',') : undefined,
          ou_line_min: ouLineRange[0],
          ou_line_max: ouLineRange[1],
          team_status: favoriteFilter !== "all" ? favoriteFilter : undefined,
          home_handedness: homePitcherHand !== "all" ? homePitcherHand : undefined,
          away_handedness: awayPitcherHand !== "all" ? awayPitcherHand : undefined,
          ou_handle_min: ouHandleRange[0] / 100,
          ou_handle_max: ouHandleRange[1] / 100,
          ou_bets_min: ouBetsRange[0] / 100,
          ou_bets_max: ouBetsRange[1] / 100,
          home_ml_handle_min: homeMlHandleRange[0] / 100,
          home_ml_handle_max: homeMlHandleRange[1] / 100,
          home_ml_bets_min: homeMlBetsRange[0] / 100,
          home_ml_bets_max: homeMlBetsRange[1] / 100,
          home_rl_handle_min: homeRlHandleRange[0] / 100,
          home_rl_handle_max: homeRlHandleRange[1] / 100,
          home_rl_bets_min: homeRlBetsRange[0] / 100,
          home_rl_bets_max: homeRlBetsRange[1] / 100
        };

        console.log('Frontend: Sending filters to backend:', filters);
        console.log('Frontend: O/U Line range:', ouLineRange);

        const { data, error } = await supabase.functions.invoke('filter-training-data', {
          body: { filters }
        });

        if (error) {
          throw error;
        }

        console.log('Frontend: Received data from backend:', data);
        
        // The backend returns { summary, gameRows }
        if (data && data.summary && data.gameRows) {
          setSummary(data.summary);
          setGameRows(data.gameRows);
        } else {
          setSummary(null);
          setGameRows([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setSummary(null);
        setGameRows([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedSeasons, selectedMonths, ouLineRange, favoriteFilter, homePitcherHand, awayPitcherHand, ouHandleRange, ouBetsRange, homeMlHandleRange, homeMlBetsRange, homeRlHandleRange, homeRlBetsRange]);

  return (
    <div className="space-y-8">
      {/* Filters UI */}
      <Card className="bg-white border-2 border-primary shadow-lg">
        <CardHeader className="pb-6 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 border-b border-primary/30">
          <CardTitle className="text-xl font-bold text-primary flex items-center gap-3">
            <div className="w-2 h-6 bg-primary rounded-full"></div>
            Filter Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-8 text-foreground">
            <DropdownMultiSelect label="Season" options={AVAILABLE_SEASONS.map(s => ({ value: s, label: s.toString() }))} selected={selectedSeasons} setSelected={setSelectedSeasons} />
            <DropdownMultiSelect label="Month" options={MONTHS} selected={selectedMonths} setSelected={setSelectedMonths} />
            <BettingFiltersDropdown
              isOpen={bettingFiltersOpen}
              onToggle={() => setBettingFiltersOpen(!bettingFiltersOpen)}
              ouLineRange={ouLineRange}
              setOuLineRange={setOuLineRange}
              ouHandleRange={ouHandleRange}
              setOuHandleRange={setOuHandleRange}
              ouBetsRange={ouBetsRange}
              setOuBetsRange={setOuBetsRange}
              homeMlHandleRange={homeMlHandleRange}
              setHomeMlHandleRange={setHomeMlHandleRange}
              homeMlBetsRange={homeMlBetsRange}
              setHomeMlBetsRange={setHomeMlBetsRange}
              homeRlHandleRange={homeRlHandleRange}
              setHomeRlHandleRange={setHomeRlHandleRange}
              homeRlBetsRange={homeRlBetsRange}
              setHomeRlBetsRange={setHomeRlBetsRange}
            />

            {/* Favorite Filter */}
            <div className="space-y-3">
              <div className="font-semibold text-foreground">Team Favorite</div>
              <RadioGroup value={favoriteFilter} onValueChange={setFavoriteFilter}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="text-sm">All Games</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="home_favored" id="home_favored" />
                  <Label htmlFor="home_favored" className="text-sm">Home Favorite</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="away_favored" id="away_favored" />
                  <Label htmlFor="away_favored" className="text-sm">Away Favorite</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Home Pitcher Hand */}
            <div className="space-y-3">
              <div className="font-semibold text-foreground">Home Pitcher Hand</div>
              <RadioGroup value={homePitcherHand} onValueChange={setHomePitcherHand}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="home_all" />
                  <Label htmlFor="home_all" className="text-sm">All</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="right" id="home_right" />
                  <Label htmlFor="home_right" className="text-sm">Right</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="left" id="home_left" />
                  <Label htmlFor="home_left" className="text-sm">Left</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Away Pitcher Hand */}
            <div className="space-y-3">
              <div className="font-semibold text-foreground">Away Pitcher Hand</div>
              <RadioGroup value={awayPitcherHand} onValueChange={setAwayPitcherHand}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="away_all" />
                  <Label htmlFor="away_all" className="text-sm">All</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="right" id="away_right" />
                  <Label htmlFor="away_right" className="text-sm">Right</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="left" id="away_left" />
                  <Label htmlFor="away_left" className="text-sm">Left</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Summary */}
      <Card className="bg-white border-2 border-primary shadow-lg">
        <CardHeader className="pb-4 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 border-b border-primary/30">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-bold text-primary flex items-center gap-3">
              <div className="w-2 h-5 bg-primary rounded-full"></div>
              Active Filters
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              className="border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => {
                setSelectedSeasons([2024, 2025]);
                setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
                setOuLineRange([6.5, 12.5]);
                setFavoriteFilter("all");
                setHomePitcherHand("all");
                setAwayPitcherHand("all");
                setOuHandleRange([0, 100]);
                setOuBetsRange([0, 100]);
                setHomeMlHandleRange([0, 100]);
                setHomeMlBetsRange([0, 100]);
                setHomeRlHandleRange([0, 100]);
                setHomeRlBetsRange([0, 100]);
              }}
            >
              Clear All Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {/* Season Filter */}
            {selectedSeasons.length > 0 && selectedSeasons.length < AVAILABLE_SEASONS.length && (
              <Badge variant="secondary" className="flex items-center gap-2 bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">
                Season: {selectedSeasons.join(", ")}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-blue-600" 
                  onClick={() => setSelectedSeasons([2024, 2025])}
                />
              </Badge>
            )}

            {/* Month Filter */}
            {selectedMonths.length > 0 && selectedMonths.length < MONTHS.length && (
              <Badge variant="secondary" className="flex items-center gap-2 bg-green-100 text-green-800 border-green-200 hover:bg-green-200">
                Month: {selectedMonths.map(m => MONTHS.find(month => month.value === m)?.label).join(", ")}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-green-600" 
                  onClick={() => setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                />
              </Badge>
            )}

            {/* O/U Line Filter */}
            {ouLineRange[0] !== 6.5 || ouLineRange[1] !== 12.5 ? (
              <Badge variant="secondary" className="flex items-center gap-2 bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200">
                O/U Line: {ouLineRange[0]} - {ouLineRange[1]}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-purple-600" 
                  onClick={() => setOuLineRange([6.5, 12.5])}
                />
              </Badge>
            ) : null}

            {/* Favorite Filter */}
            {favoriteFilter !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-2 bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200">
                {favoriteFilter === "home_favored" ? "Home Favorite" : "Away Favorite"}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-orange-600" 
                  onClick={() => setFavoriteFilter("all")}
                />
              </Badge>
            )}

            {/* Home Pitcher Hand Filter */}
            {homePitcherHand !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-2 bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200">
                Home Pitcher: {homePitcherHand === "right" ? "Right" : "Left"}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-gray-600" 
                  onClick={() => setHomePitcherHand("all")}
                />
              </Badge>
            )}

            {/* Away Pitcher Hand Filter */}
            {awayPitcherHand !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-2 bg-red-100 text-red-800 border-red-200 hover:bg-red-200">
                Away Pitcher: {awayPitcherHand === "right" ? "Right" : "Left"}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-600" 
                  onClick={() => setAwayPitcherHand("all")}
                />
              </Badge>
            )}

            {/* Betting Volume Filters */}
            {ouHandleRange[0] !== 0 || ouHandleRange[1] !== 100 ? (
              <Badge variant="secondary" className="flex items-center gap-2 bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200">
                O/U Handle: {ouHandleRange[0]}% - {ouHandleRange[1]}%
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-indigo-600" 
                  onClick={() => setOuHandleRange([0, 100])}
                />
              </Badge>
            ) : null}

            {ouBetsRange[0] !== 0 || ouBetsRange[1] !== 100 ? (
              <Badge variant="secondary" className="flex items-center gap-2 bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200">
                O/U Bets: {ouBetsRange[0]}% - {ouBetsRange[1]}%
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-cyan-600" 
                  onClick={() => setOuBetsRange([0, 100])}
                />
              </Badge>
            ) : null}

            {homeMlHandleRange[0] !== 0 || homeMlHandleRange[1] !== 100 ? (
              <Badge variant="secondary" className="flex items-center gap-2 bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-200">
                Home ML Handle: {homeMlHandleRange[0]}% - {homeMlHandleRange[1]}%
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-teal-600" 
                  onClick={() => setHomeMlHandleRange([0, 100])}
                />
              </Badge>
            ) : null}

            {homeMlBetsRange[0] !== 0 || homeMlBetsRange[1] !== 100 ? (
              <Badge variant="secondary" className="flex items-center gap-2 bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200">
                Home ML Bets: {homeMlBetsRange[0]}% - {homeMlBetsRange[1]}%
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-emerald-600" 
                  onClick={() => setHomeMlBetsRange([0, 100])}
                />
              </Badge>
            ) : null}

            {homeRlHandleRange[0] !== 0 || homeRlHandleRange[1] !== 100 ? (
              <Badge variant="secondary" className="flex items-center gap-2 bg-lime-100 text-lime-800 border-lime-200 hover:bg-lime-200">
                Home RL Handle: {homeRlHandleRange[0]}% - {homeRlHandleRange[1]}%
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-lime-600" 
                  onClick={() => setHomeRlHandleRange([0, 100])}
                />
              </Badge>
            ) : null}

            {homeRlBetsRange[0] !== 0 || homeRlBetsRange[1] !== 100 ? (
              <Badge variant="secondary" className="flex items-center gap-2 bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200">
                Home RL Bets: {homeRlBetsRange[0]}% - {homeRlBetsRange[1]}%
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-gray-600" 
                  onClick={() => setHomeRlBetsRange([0, 100])}
                />
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Win Rate Summary */}
      <Card className="bg-white border-2 border-primary shadow-xl">
        <CardHeader className="pb-6 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 border-b border-primary/30">
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-3">
            <div className="w-2 h-8 bg-primary rounded-full"></div>
            Win Rate Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
                <div className="text-primary font-medium">Loading win rate data...</div>
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
                          colors={['#10b981', '#3b82f6']}
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
                      colors={['#10b981', '#3b82f6']}
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
                          colors={['#f59e0b', '#8b5cf6']}
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
                      colors={['#f59e0b', '#8b5cf6']}
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
                          colors={['#ef4444', '#06b6d4']}
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
                      colors={['#ef4444', '#06b6d4']}
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
          ) : (
            <div className="text-center py-12">
              <div className="text-muted-foreground bg-muted/50 border border-muted rounded-lg p-6">
                <div className="text-lg font-semibold mb-2">No Summary Data Available</div>
                <div className="text-sm">Try adjusting your filters to see win rate statistics</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Game Details */}
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
    </div>
  );
}
