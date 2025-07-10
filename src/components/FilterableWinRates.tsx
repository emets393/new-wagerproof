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
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-8">
            <DropdownMultiSelect label="Season" options={AVAILABLE_SEASONS.map(s => ({ value: s, label: s.toString() }))} selected={selectedSeasons} setSelected={setSelectedSeasons} />
            <DropdownMultiSelect label="Month" options={MONTHS} selected={selectedMonths} setSelected={setSelectedMonths} />
            
            {/* O/U Line Range Slider */}
            <div className="space-y-2">
              <div className="font-semibold">O/U Line Range</div>
              <div className="w-64">
                <Slider
                  value={ouLineRange}
                  onValueChange={(value: number[]) => setOuLineRange([value[0], value[1]] as [number, number])}
                  max={20}
                  min={0}
                  step={0.5}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-600 mt-1">
                  <span>{ouLineRange[0]}</span>
                  <span>{ouLineRange[1]}</span>
                </div>
              </div>
            </div>

            {/* Favorite Filter */}
            <div className="space-y-2">
              <div className="font-semibold">Team Favorite</div>
              <RadioGroup value={favoriteFilter} onValueChange={setFavoriteFilter}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">All Games</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="home_favored" id="home_favored" />
                  <Label htmlFor="home_favored">Home Favorite</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="away_favored" id="away_favored" />
                  <Label htmlFor="away_favored">Away Favorite</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Home Pitcher Hand */}
            <div className="space-y-2">
              <div className="font-semibold">Home Pitcher Hand</div>
              <RadioGroup value={homePitcherHand} onValueChange={setHomePitcherHand}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="home_all" />
                  <Label htmlFor="home_all">All</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="right" id="home_right" />
                  <Label htmlFor="home_right">Right</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="left" id="home_left" />
                  <Label htmlFor="home_left">Left</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Away Pitcher Hand */}
            <div className="space-y-2">
              <div className="font-semibold">Away Pitcher Hand</div>
              <RadioGroup value={awayPitcherHand} onValueChange={setAwayPitcherHand}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="away_all" />
                  <Label htmlFor="away_all">All</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="right" id="away_right" />
                  <Label htmlFor="away_right">Right</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="left" id="away_left" />
                  <Label htmlFor="away_left">Left</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Summary */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Active Filters</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
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
          <div className="flex flex-wrap gap-2">
            {/* Season Filter */}
            {selectedSeasons.length > 0 && selectedSeasons.length < AVAILABLE_SEASONS.length && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Season: {selectedSeasons.join(", ")}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-500" 
                  onClick={() => setSelectedSeasons([2024, 2025])}
                />
              </Badge>
            )}

            {/* Month Filter */}
            {selectedMonths.length > 0 && selectedMonths.length < MONTHS.length && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Month: {selectedMonths.map(m => MONTHS.find(month => month.value === m)?.label).join(", ")}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-500" 
                  onClick={() => setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                />
              </Badge>
            )}

            {/* O/U Line Filter */}
            {ouLineRange[0] !== 6.5 || ouLineRange[1] !== 12.5 ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                O/U Line: {ouLineRange[0]} - {ouLineRange[1]}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-500" 
                  onClick={() => setOuLineRange([6.5, 12.5])}
                />
              </Badge>
            ) : null}

            {/* Favorite Filter */}
            {favoriteFilter !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {favoriteFilter === "home_favored" ? "Home Favorite" : "Away Favorite"}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-500" 
                  onClick={() => setFavoriteFilter("all")}
                />
              </Badge>
            )}

            {/* Home Pitcher Hand Filter */}
            {homePitcherHand !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Home Pitcher: {homePitcherHand === "right" ? "Right" : "Left"}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-500" 
                  onClick={() => setHomePitcherHand("all")}
                />
              </Badge>
            )}

            {/* Away Pitcher Hand Filter */}
            {awayPitcherHand !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Away Pitcher: {awayPitcherHand === "right" ? "Right" : "Left"}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-red-500" 
                  onClick={() => setAwayPitcherHand("all")}
                />
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Win Rate Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Win Rate Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : error ? (
            <div className="text-red-500">{error}</div>
          ) : summary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {SUMMARY_LABELS.map(({ key, label }) => (
                <div key={key} className="flex flex-col items-center">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-lg font-bold">
                    {summary[key] !== undefined ? summary[key] : '-'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div>No summary data available.</div>
          )}
        </CardContent>
      </Card>
      {/* Game Details */}
      <Card>
        <CardHeader>
          <CardTitle>Game Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : error ? (
            <div className="text-red-500">{error}</div>
          ) : gameRows && gameRows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {GAME_COLUMNS.map(col => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gameRows.map((row, idx) => (
                    <TableRow key={idx}>
                      {GAME_COLUMNS.map(col => (
                        <TableCell key={col.key}>{row[col.key]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div>No game details available.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
