
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Define filter interface locally
interface Filters {
  home_team?: string;
  away_team?: string;
  series_game_number?: number;
  home_pitcher?: string;
  away_pitcher?: string;
  home_handedness?: number;
  away_handedness?: number;
  season?: number;
  month?: number;
  day?: number;
  era_min?: number;
}

interface FilterOptions {
  homeTeams: string[];
  awayTeams: string[];
  seasons: number[];
  months: number[];
  days: number[];
  homePitchers: string[];
  awayPitchers: string[];
  homeHandedness: number[];
  awayHandedness: number[];
  seriesGameNumbers: number[];
}

interface AnalyticsFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  filterOptions: FilterOptions;
}

const AnalyticsFilters = ({ filters, onFiltersChange, filterOptions }: AnalyticsFiltersProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilters = (updates: Partial<Filters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => value !== undefined && value !== null && value !== '').length;
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  // Helper function to safely validate options for SelectItem
  const getValidSelectOptions = (options: any[]) => {
    if (!Array.isArray(options)) {
      return [];
    }
    
    return options.filter(option => {
      // Filter out null, undefined, empty strings
      if (option === null || option === undefined || option === '') {
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
              <Label>Home Team</Label>
              <Select 
                value={filters.home_team || ""} 
                onValueChange={(value) => updateFilters({ home_team: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select home team..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {getValidSelectOptions(filterOptions.homeTeams).map((team) => (
                    <SelectItem key={`home-${team}`} value={String(team)}>
                      {String(team)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Away Teams */}
          {filterOptions.awayTeams && filterOptions.awayTeams.length > 0 && (
            <div className="space-y-2">
              <Label>Away Team</Label>
              <Select 
                value={filters.away_team || ""} 
                onValueChange={(value) => updateFilters({ away_team: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select away team..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {getValidSelectOptions(filterOptions.awayTeams).map((team) => (
                    <SelectItem key={`away-${team}`} value={String(team)}>
                      {String(team)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Seasons */}
          {filterOptions.seasons && filterOptions.seasons.length > 0 && (
            <div className="space-y-2">
              <Label>Season</Label>
              <Select 
                value={filters.season ? String(filters.season) : ""} 
                onValueChange={(value) => updateFilters({ season: value ? parseInt(value) : undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select season..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {getValidSelectOptions(filterOptions.seasons).map((season) => (
                    <SelectItem key={`season-${season}`} value={String(season)}>
                      {String(season)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Months */}
          {filterOptions.months && filterOptions.months.length > 0 && (
            <div className="space-y-2">
              <Label>Month</Label>
              <Select 
                value={filters.month ? String(filters.month) : ""} 
                onValueChange={(value) => updateFilters({ month: value ? parseInt(value) : undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {getValidSelectOptions(filterOptions.months).map((month) => (
                    <SelectItem key={`month-${month}`} value={String(month)}>
                      {String(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-6 border-t pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Home Pitchers */}
              {filterOptions.homePitchers && filterOptions.homePitchers.length > 0 && (
                <div className="space-y-2">
                  <Label>Home Pitcher</Label>
                  <Select 
                    value={filters.home_pitcher || ""} 
                    onValueChange={(value) => updateFilters({ home_pitcher: value || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pitcher..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      {getValidSelectOptions(filterOptions.homePitchers).map((pitcher) => (
                        <SelectItem key={`home-pitcher-${pitcher}`} value={String(pitcher)}>
                          {String(pitcher)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Away Pitchers */}
              {filterOptions.awayPitchers && filterOptions.awayPitchers.length > 0 && (
                <div className="space-y-2">
                  <Label>Away Pitcher</Label>
                  <Select 
                    value={filters.away_pitcher || ""} 
                    onValueChange={(value) => updateFilters({ away_pitcher: value || undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pitcher..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      {getValidSelectOptions(filterOptions.awayPitchers).map((pitcher) => (
                        <SelectItem key={`away-pitcher-${pitcher}`} value={String(pitcher)}>
                          {String(pitcher)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Series Game Number */}
              {filterOptions.seriesGameNumbers && filterOptions.seriesGameNumbers.length > 0 && (
                <div className="space-y-2">
                  <Label>Series Game Number</Label>
                  <Select 
                    value={filters.series_game_number ? String(filters.series_game_number) : ""} 
                    onValueChange={(value) => updateFilters({ series_game_number: value ? parseInt(value) : undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select game..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any</SelectItem>
                      {getValidSelectOptions(filterOptions.seriesGameNumbers).map((gameNum) => (
                        <SelectItem key={`game-${gameNum}`} value={String(gameNum)}>
                          Game {String(gameNum)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsFilters;
