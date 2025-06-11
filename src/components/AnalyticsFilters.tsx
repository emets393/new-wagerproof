
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsFilters as AnalyticsFiltersType } from "@/pages/Analytics";

interface AnalyticsFiltersProps {
  filters: AnalyticsFiltersType;
  onFiltersChange: (filters: AnalyticsFiltersType) => void;
}

const AnalyticsFilters = ({ filters, onFiltersChange }: AnalyticsFiltersProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const teams = [
    'Angels', 'Houston', 'Athletics', 'Toronto', 'Baltimore', 'Boston', 'White Sox', 'Cleveland',
    'Detroit', 'Kansas City', 'Minnesota', 'Yankees', 'Arizona', 'Atlanta', 'Cubs', 'Cincinnati',
    'Colorado', 'Miami', 'Milwaukee', 'Mets', 'Philadelphia', 'Pittsburgh', 'Cardinals', 'San Diego',
    'San Francisco', 'Seattle', 'Rangers', 'Tampa Bay', 'Dodgers', 'Washington'
  ];

  const updateFilters = (updates: Partial<AnalyticsFiltersType>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.teams.length > 0) count++;
    if (filters.gameLocation !== 'all') count++;
    if (filters.season !== 'all') count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.gameContext.divisionalOnly || filters.gameContext.leagueOnly || filters.gameContext.playoffOnly) count++;
    if (filters.performance.minStreak !== -10 || filters.performance.maxStreak !== 10) count++;
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              Advanced
              {showAdvanced ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Always Visible Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                {teams.filter(team => !filters.teams.includes(team)).map((team) => (
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

          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={filters.dateRange.start}
                onChange={(e) => updateFilters({ 
                  dateRange: { ...filters.dateRange, start: e.target.value }
                })}
                placeholder="Start date"
              />
              <Input
                type="date"
                value={filters.dateRange.end}
                onChange={(e) => updateFilters({ 
                  dateRange: { ...filters.dateRange, end: e.target.value }
                })}
                placeholder="End date"
              />
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="border-t pt-6 space-y-6">
            {/* Game Context */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Game Context</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="divisional"
                    checked={filters.gameContext.divisionalOnly}
                    onCheckedChange={(checked) => updateFilters({
                      gameContext: { ...filters.gameContext, divisionalOnly: checked }
                    })}
                  />
                  <Label htmlFor="divisional">Divisional Games Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="league"
                    checked={filters.gameContext.leagueOnly}
                    onCheckedChange={(checked) => updateFilters({
                      gameContext: { ...filters.gameContext, leagueOnly: checked }
                    })}
                  />
                  <Label htmlFor="league">Same League Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="playoff"
                    checked={filters.gameContext.playoffOnly}
                    onCheckedChange={(checked) => updateFilters({
                      gameContext: { ...filters.gameContext, playoffOnly: checked }
                    })}
                  />
                  <Label htmlFor="playoff">Playoff Games Only</Label>
                </div>
              </div>
            </div>

            {/* Performance Filters */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Team Performance</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Streak</Label>
                  <Input
                    type="number"
                    value={filters.performance.minStreak}
                    onChange={(e) => updateFilters({
                      performance: { ...filters.performance, minStreak: parseInt(e.target.value) || -10 }
                    })}
                    placeholder="Minimum streak"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Streak</Label>
                  <Input
                    type="number"
                    value={filters.performance.maxStreak}
                    onChange={(e) => updateFilters({
                      performance: { ...filters.performance, maxStreak: parseInt(e.target.value) || 10 }
                    })}
                    placeholder="Maximum streak"
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
