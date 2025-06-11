
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsFilters as AnalyticsFiltersType } from "@/pages/Analytics";

interface AnalyticsFiltersProps {
  filters: AnalyticsFiltersType;
  onFiltersChange: (filters: AnalyticsFiltersType) => void;
  availableTeams: string[];
}

const AnalyticsFilters = ({ filters, onFiltersChange, availableTeams }: AnalyticsFiltersProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilters = (updates: Partial<AnalyticsFiltersType>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.teams.length > 0) count++;
    if (filters.gameLocation !== 'all') count++;
    if (filters.season !== 'all') count++;
    return count;
  };

  const clearAllFilters = () => {
    onFiltersChange({
      teams: [],
      gameLocation: 'all',
      season: 'all',
      dateRange: { start: '', end: '' },
      gameContext: { divisionalOnly: false, leagueOnly: false, playoffOnly: false },
      performance: { minStreak: -10, maxStreak: 10 }
    });
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Filters - Teams, Season, Game Location */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Team Selection */}
          <div className="space-y-2">
            <Label>Teams</Label>
            <Select onValueChange={(value) => {
              if (value && !filters.teams.includes(value)) {
                updateFilters({ teams: [...filters.teams, value] });
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select teams..." />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.filter(team => !filters.teams.includes(team)).map((team) => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.teams.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {filters.teams.map((team) => (
                  <Badge key={team} variant="secondary" className="text-xs">
                    {team}
                    <button
                      onClick={() => updateFilters({ teams: filters.teams.filter(t => t !== team) })}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Season Selection */}
          <div className="space-y-2">
            <Label>Season</Label>
            <Select value={filters.season} onValueChange={(value: string) => 
              updateFilters({ season: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                <SelectItem value="2025">2025 Season</SelectItem>
                <SelectItem value="2024">2024 Season</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Game Location */}
          <div className="space-y-2">
            <Label>Game Location</Label>
            <Select value={filters.gameLocation} onValueChange={(value: 'all' | 'home' | 'away') => 
              updateFilters({ gameLocation: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Games</SelectItem>
                <SelectItem value="home">Home Only</SelectItem>
                <SelectItem value="away">Away Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalyticsFilters;
