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
          away_handedness: awayPitcherHand !== "all" ? awayPitcherHand : undefined
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
  }, [selectedSeasons, selectedMonths, ouLineRange, favoriteFilter, homePitcherHand, awayPitcherHand]);

  return (
    <div className="space-y-8">
      {/* Filters UI */}
      <Card className="bg-white border border-info/20 shadow-lg">
        <CardHeader className="pb-6 bg-gradient-to-r from-info/20 via-info/10 to-info/5 border-b border-info/30">
          <CardTitle className="text-xl font-bold text-accent flex items-center gap-3">
            <div className="w-2 h-6 bg-accent rounded-full"></div>
            Filter Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-8 text-foreground">
            <DropdownMultiSelect label="Season" options={AVAILABLE_SEASONS.map(s => ({ value: s, label: s.toString() }))} selected={selectedSeasons} setSelected={setSelectedSeasons} />
            <DropdownMultiSelect label="Month" options={MONTHS} selected={selectedMonths} setSelected={setSelectedMonths} />
            
            {/* O/U Line Range Slider */}
            <div className="space-y-3">
              <div className="font-semibold text-foreground">O/U Line Range</div>
              <div className="w-64">
                <Slider
                  value={ouLineRange}
                  onValueChange={(value: number[]) => setOuLineRange([value[0], value[1]] as [number, number])}
                  max={20}
                  min={0}
                  step={0.5}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span className="bg-muted px-2 py-1 rounded">{ouLineRange[0]}</span>
                  <span className="bg-muted px-2 py-1 rounded">{ouLineRange[1]}</span>
                </div>
              </div>
            </div>

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
      <Card className="bg-white border border-info/20 shadow-lg">
        <CardHeader className="pb-4 bg-gradient-to-r from-info/20 via-info/10 to-info/5 border-b border-info/30">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-bold text-accent flex items-center gap-3">
              <div className="w-2 h-5 bg-accent rounded-full"></div>
              Active Filters
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              className="border-accent/40 text-accent hover:bg-accent/10"
              onClick={() => {
                setSelectedSeasons([2024, 2025]);
                setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
                setOuLineRange([6.5, 12.5]);
                setFavoriteFilter("all");
                setHomePitcherHand("all");
                setAwayPitcherHand("all");
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
              <Badge variant="secondary" className="flex items-center gap-2 bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200">
                Home Pitcher: {homePitcherHand === "right" ? "Right" : "Left"}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-amber-600" 
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
          </div>
        </CardContent>
      </Card>

      {/* Win Rate Summary */}
      <Card className="bg-white border border-info/20 shadow-xl">
        <CardHeader className="pb-6 bg-gradient-to-r from-info/20 via-info/10 to-info/5 border-b border-info/30">
          <CardTitle className="text-2xl font-bold text-accent flex items-center gap-3">
            <div className="w-2 h-8 bg-accent rounded-full"></div>
            Win Rate Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto"></div>
                <div className="text-accent font-medium">Loading win rate data...</div>
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
              {/* Main Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Home Win % */}
                <div className="bg-white border border-info/20 rounded-xl p-6 text-center hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <div className="text-accent text-sm font-semibold uppercase tracking-wide mb-2">Home Win %</div>
                  <div className="text-3xl font-bold text-foreground mb-1">
                    {summary.homeWinPct !== undefined ? `${summary.homeWinPct}%` : '-'}
                  </div>
                  <div className="w-16 h-1 bg-accent rounded-full mx-auto"></div>
                </div>

                {/* Away Win % */}
                <div className="bg-white border border-info/20 rounded-xl p-6 text-center hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <div className="text-accent text-sm font-semibold uppercase tracking-wide mb-2">Away Win %</div>
                  <div className="text-3xl font-bold text-foreground mb-1">
                    {summary.awayWinPct !== undefined ? `${summary.awayWinPct}%` : '-'}
                  </div>
                  <div className="w-16 h-1 bg-accent rounded-full mx-auto"></div>
                </div>

                {/* Home Cover % */}
                <div className="bg-white border border-info/20 rounded-xl p-6 text-center hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <div className="text-accent text-sm font-semibold uppercase tracking-wide mb-2">Home Cover %</div>
                  <div className="text-3xl font-bold text-foreground mb-1">
                    {summary.homeCoverPct !== undefined ? `${summary.homeCoverPct}%` : '-'}
                  </div>
                  <div className="w-16 h-1 bg-accent rounded-full mx-auto"></div>
                </div>

                {/* Away Cover % */}
                <div className="bg-white border border-info/20 rounded-xl p-6 text-center hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <div className="text-accent text-sm font-semibold uppercase tracking-wide mb-2">Away Cover %</div>
                  <div className="text-3xl font-bold text-foreground mb-1">
                    {summary.awayCoverPct !== undefined ? `${summary.awayCoverPct}%` : '-'}
                  </div>
                  <div className="w-16 h-1 bg-accent rounded-full mx-auto"></div>
                </div>
              </div>

              {/* Over/Under Section */}
              <div className="bg-white border border-info/20 rounded-xl p-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-accent mb-2">Over/Under Performance</h3>
                  <div className="w-24 h-0.5 bg-accent rounded-full mx-auto"></div>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                  {/* Over % */}
                  <div className="text-center">
                    <div className="text-accent text-sm font-semibold uppercase tracking-wide mb-3">Over %</div>
                    <div className="text-4xl font-bold text-foreground mb-3">
                      {summary.overPct !== undefined ? `${summary.overPct}%` : '-'}
                    </div>
                    <div className="w-full bg-accent/30 rounded-full h-3">
                      <div 
                        className="bg-accent h-3 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${summary.overPct || 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Under % */}
                  <div className="text-center">
                    <div className="text-accent text-sm font-semibold uppercase tracking-wide mb-3">Under %</div>
                    <div className="text-4xl font-bold text-foreground mb-3">
                      {summary.underPct !== undefined ? `${summary.underPct}%` : '-'}
                    </div>
                    <div className="w-full bg-accent/30 rounded-full h-3">
                      <div 
                        className="bg-accent h-3 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${summary.underPct || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Games */}
              <div className="bg-white border border-info/20 rounded-xl p-6 text-center">
                <div className="text-accent text-sm font-semibold uppercase tracking-wide mb-2">Total Games Analyzed</div>
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
      <Card className="bg-white border border-info/20 shadow-lg">
        <CardHeader className="pb-6 bg-gradient-to-r from-info/20 via-info/10 to-info/5 border-b border-info/30">
          <CardTitle className="text-xl font-bold text-accent flex items-center gap-3">
            <div className="w-2 h-6 bg-accent rounded-full"></div>
            Game Details
            <Badge variant="outline" className="ml-auto text-xs border-accent text-accent bg-white/80">
              {gameRows?.length || 0} games
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto"></div>
                <div className="text-accent font-medium">Loading game details...</div>
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
              <div className="rounded-lg border border-info/10 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-info/10">
                      {GAME_COLUMNS.map(col => (
                        <TableHead key={col.key} className="font-semibold text-muted-foreground text-xs uppercase tracking-wide border-b border-info/20">
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gameRows.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-info/5 transition-colors">
                        {GAME_COLUMNS.map(col => (
                          <TableCell key={col.key} className="text-sm py-3 text-foreground border-b border-info/10">
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
