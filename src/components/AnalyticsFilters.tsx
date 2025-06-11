
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  homeHandedness?: number[];
  awayHandedness?: number[];
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
    if (filters.sameLeague !== null) count++;
    if (filters.sameDivision !== null) count++;
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

  // Helper function to safely validate options for SelectItem
  const getValidSelectOptions = (options: any[], currentlySelected: any[]) => {
    if (!Array.isArray(options)) {
      return [];
    }
    
    return options.filter(option => {
      // Filter out null, undefined, empty strings
      if (option === null || option === undefined || option === '') {
        return false;
      }
      
      // Filter out already selected items
      if (currentlySelected.includes(option)) {
        return false;
      }
      
      return true;
    });
  };

  // Check if we have any filter data
  const hasFilterData = filterOptions && (
    (filterOptions.homeTeams && filterOptions.homeTeams.length > 0) ||
    (filterOptions.awayTeams && filterOptions.awayTeams.length > 0) ||
    (filterOptions.seasons && filterOptions.seasons.length > 0)
  );

  if (!hasFilterData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <CardTitle>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Loading filter options...</p>
            <p className="text-sm mt-2">Please wait while we analyze your training data.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
          {filterOptions.homeTeams && filterOptions.homeTeams.length > 0 && (
            <div className="space-y-2">
              <Label>Home Teams</Label>
              <Select onValueChange={(value) => {
                if (value && value.trim() !== '') {
                  addToFilter('homeTeams', value);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select home teams..." />
                </SelectTrigger>
                <SelectContent>
                  {getValidSelectOptions(filterOptions.homeTeams, filters.homeTeams).map((team) => (
                    <SelectItem key={`home-${team}`} value={String(team)}>
                      {String(team)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.homeTeams.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {filters.homeTeams.map((team) => (
                    <Badge key={`home-badge-${team}`} variant="secondary" className="text-xs">
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
          )}

          {/* Away Teams */}
          {filterOptions.awayTeams && filterOptions.awayTeams.length > 0 && (
            <div className="space-y-2">
              <Label>Away Teams</Label>
              <Select onValueChange={(value) => {
                if (value && value.trim() !== '') {
                  addToFilter('awayTeams', value);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select away teams..." />
                </SelectTrigger>
                <SelectContent>
                  {getValidSelectOptions(filterOptions.awayTeams, filters.awayTeams).map((team) => (
                    <SelectItem key={`away-${team}`} value={String(team)}>
                      {String(team)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.awayTeams.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {filters.awayTeams.map((team) => (
                    <Badge key={`away-badge-${team}`} variant="secondary" className="text-xs">
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
          )}

          {/* Seasons */}
          {filterOptions.seasons && filterOptions.seasons.length > 0 && (
            <div className="space-y-2">
              <Label>Seasons</Label>
              <Select onValueChange={(value) => {
                const numValue = parseInt(value);
                if (!isNaN(numValue)) {
                  addToFilter('seasons', numValue);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select seasons..." />
                </SelectTrigger>
                <SelectContent>
                  {getValidSelectOptions(filterOptions.seasons, filters.seasons).map((season) => (
                    <SelectItem key={`season-${season}`} value={String(season)}>
                      {String(season)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.seasons.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {filters.seasons.map((season) => (
                    <Badge key={`season-badge-${season}`} variant="secondary" className="text-xs">
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
          )}

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
              {filterOptions.months && filterOptions.months.length > 0 && (
                <div className="space-y-2">
                  <Label>Months</Label>
                  <Select onValueChange={(value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue)) {
                      addToFilter('months', numValue);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select months..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getValidSelectOptions(filterOptions.months, filters.months).map((month) => (
                        <SelectItem key={`month-${month}`} value={String(month)}>
                          {String(month)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filters.months.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {filters.months.map((month) => (
                        <Badge key={`month-badge-${month}`} variant="secondary" className="text-xs">
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
              )}

              {/* Same Division */}
              <div className="space-y-2">
                <Label>Same Division</Label>
                <Select value={filters.sameDivision === null ? '' : filters.sameDivision.toString()} 
                        onValueChange={(value) => updateFilters({ sameDivision: value === '' ? null : value === 'true' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="true">Same Division</SelectItem>
                    <SelectItem value="false">Different Division</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsFilters;
