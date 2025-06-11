
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsFilters as AnalyticsFiltersType } from "@/pages/Analytics";

interface FilterOptions {
  homeTeams?: string[];
  awayTeams?: string[];
  seasons?: number[];
  months?: number[];
  days?: number[];
  homePitchers?: string[];
  awayPitchers?: string[];
  homeHandedness?: string[];
  awayHandedness?: string[];
  seriesGameNumbers?: number[];
}

interface AnalyticsFiltersProps {
  filters: AnalyticsFiltersType;
  onFiltersChange: (filters: AnalyticsFiltersType) => void;
  filterOptions: FilterOptions;
}

const AnalyticsFilters = ({ filters, onFiltersChange, filterOptions }: AnalyticsFiltersProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilters = (updates: Partial<AnalyticsFiltersType>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.homeTeams.length > 0) count++;
    if (filters.awayTeams.length > 0) count++;
    if (filters.seasons.length > 0) count++;
    if (filters.months.length > 0) count++;
    if (filters.days.length > 0) count++;
    if (filters.homePitchers.length > 0) count++;
    if (filters.awayPitchers.length > 0) count++;
    if (filters.homeHandedness.length > 0) count++;
    if (filters.awayHandedness.length > 0) count++;
    if (filters.sameLeague !== null) count++;
    if (filters.sameDivision !== null) count++;
    if (filters.seriesGameNumbers.length > 0) count++;
    return count;
  };

  const clearAllFilters = () => {
    onFiltersChange({
      homeTeams: [],
      awayTeams: [],
      seasons: [],
      months: [],
      days: [],
      homePitchers: [],
      awayPitchers: [],
      homeHandedness: [],
      awayHandedness: [],
      sameLeague: null,
      sameDivision: null,
      seriesGameNumbers: [],
      dateRange: { start: '', end: '' },
      homeEraRange: { min: null, max: null },
      awayEraRange: { min: null, max: null },
      homeWhipRange: { min: null, max: null },
      awayWhipRange: { min: null, max: null },
      homeWinPctRange: { min: null, max: null },
      awayWinPctRange: { min: null, max: null },
      ouLineRange: { min: null, max: null }
    });
  };

  const addToFilter = (filterKey: keyof AnalyticsFiltersType, value: string | number) => {
    const currentFilter = filters[filterKey] as any[];
    if (!currentFilter.includes(value)) {
      updateFilters({ [filterKey]: [...currentFilter, value] });
    }
  };

  const removeFromFilter = (filterKey: keyof AnalyticsFiltersType, value: string | number) => {
    const currentFilter = filters[filterKey] as any[];
    updateFilters({ [filterKey]: currentFilter.filter(item => item !== value) });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <CardTitle>Filters</CardTitle>
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary">{getActiveFilterCount()} active</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getActiveFilterCount() > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showAdvanced ? 'Less' : 'More'} Filters
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Home Teams */}
          <div className="space-y-2">
            <Label>Home Teams</Label>
            <Select onValueChange={(value) => addToFilter('homeTeams', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select home teams..." />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.homeTeams?.filter(team => !filters.homeTeams.includes(team)).map((team) => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.homeTeams.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {filters.homeTeams.map((team) => (
                  <Badge key={team} variant="secondary" className="text-xs">
                    {team}
                    <button
                      onClick={() => removeFromFilter('homeTeams', team)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Away Teams */}
          <div className="space-y-2">
            <Label>Away Teams</Label>
            <Select onValueChange={(value) => addToFilter('awayTeams', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select away teams..." />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.awayTeams?.filter(team => !filters.awayTeams.includes(team)).map((team) => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.awayTeams.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {filters.awayTeams.map((team) => (
                  <Badge key={team} variant="secondary" className="text-xs">
                    {team}
                    <button
                      onClick={() => removeFromFilter('awayTeams', team)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Seasons */}
          <div className="space-y-2">
            <Label>Seasons</Label>
            <Select onValueChange={(value) => addToFilter('seasons', parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select seasons..." />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.seasons?.filter(season => !filters.seasons.includes(season)).map((season) => (
                  <SelectItem key={season} value={season.toString()}>{season}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.seasons.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {filters.seasons.map((season) => (
                  <Badge key={season} variant="secondary" className="text-xs">
                    {season}
                    <button
                      onClick={() => removeFromFilter('seasons', season)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Same League */}
          <div className="space-y-2">
            <Label>Same League</Label>
            <Select value={filters.sameLeague === null ? '' : filters.sameLeague.toString()} 
                    onValueChange={(value) => updateFilters({ sameLeague: value === '' ? null : value === 'true' })}>
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any</SelectItem>
                <SelectItem value="true">Same League</SelectItem>
                <SelectItem value="false">Different League</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-6 border-t pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Months */}
              <div className="space-y-2">
                <Label>Months</Label>
                <Select onValueChange={(value) => addToFilter('months', parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select months..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOptions.months?.filter(month => !filters.months.includes(month)).map((month) => (
                      <SelectItem key={month} value={month.toString()}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filters.months.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {filters.months.map((month) => (
                      <Badge key={month} variant="secondary" className="text-xs">
                        {month}
                        <button
                          onClick={() => removeFromFilter('months', month)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Home Handedness */}
              <div className="space-y-2">
                <Label>Home Pitcher Hand</Label>
                <Select onValueChange={(value) => addToFilter('homeHandedness', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select handedness..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOptions.homeHandedness?.filter(hand => !filters.homeHandedness.includes(hand)).map((hand) => (
                      <SelectItem key={hand} value={hand}>{hand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filters.homeHandedness.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {filters.homeHandedness.map((hand) => (
                      <Badge key={hand} variant="secondary" className="text-xs">
                        {hand}
                        <button
                          onClick={() => removeFromFilter('homeHandedness', hand)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Away Handedness */}
              <div className="space-y-2">
                <Label>Away Pitcher Hand</Label>
                <Select onValueChange={(value) => addToFilter('awayHandedness', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select handedness..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOptions.awayHandedness?.filter(hand => !filters.awayHandedness.includes(hand)).map((hand) => (
                      <SelectItem key={hand} value={hand}>{hand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filters.awayHandedness.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {filters.awayHandedness.map((hand) => (
                      <Badge key={hand} variant="secondary" className="text-xs">
                        {hand}
                        <button
                          onClick={() => removeFromFilter('awayHandedness', hand)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Range Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Home ERA Range */}
              <div className="space-y-2">
                <Label>Home ERA Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Min ERA"
                    value={filters.homeEraRange.min || ''}
                    onChange={(e) => updateFilters({ 
                      homeEraRange: { 
                        ...filters.homeEraRange, 
                        min: e.target.value ? parseFloat(e.target.value) : null 
                      } 
                    })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Max ERA"
                    value={filters.homeEraRange.max || ''}
                    onChange={(e) => updateFilters({ 
                      homeEraRange: { 
                        ...filters.homeEraRange, 
                        max: e.target.value ? parseFloat(e.target.value) : null 
                      } 
                    })}
                  />
                </div>
              </div>

              {/* Away ERA Range */}
              <div className="space-y-2">
                <Label>Away ERA Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Min ERA"
                    value={filters.awayEraRange.min || ''}
                    onChange={(e) => updateFilters({ 
                      awayEraRange: { 
                        ...filters.awayEraRange, 
                        min: e.target.value ? parseFloat(e.target.value) : null 
                      } 
                    })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Max ERA"
                    value={filters.awayEraRange.max || ''}
                    onChange={(e) => updateFilters({ 
                      awayEraRange: { 
                        ...filters.awayEraRange, 
                        max: e.target.value ? parseFloat(e.target.value) : null 
                      } 
                    })}
                  />
                </div>
              </div>

              {/* O/U Line Range */}
              <div className="space-y-2">
                <Label>Over/Under Line Range</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="Min Line"
                    value={filters.ouLineRange.min || ''}
                    onChange={(e) => updateFilters({ 
                      ouLineRange: { 
                        ...filters.ouLineRange, 
                        min: e.target.value ? parseFloat(e.target.value) : null 
                      } 
                    })}
                  />
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="Max Line"
                    value={filters.ouLineRange.max || ''}
                    onChange={(e) => updateFilters({ 
                      ouLineRange: { 
                        ...filters.ouLineRange, 
                        max: e.target.value ? parseFloat(e.target.value) : null 
                      } 
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsFilters;
