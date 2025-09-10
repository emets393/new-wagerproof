import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { buildQueryString } from "@/utils/queryParams";
import { normalizeTeamNamesInFilters } from "@/utils/teamNormalization";
import AdvancedNumericFilter from "@/components/AdvancedNumericFilter";
import FilterSummary from "@/components/FilterSummary";
import NumericRangeFilter from "@/components/NumericRangeFilter";

const numericFilters = [
  "series_game_number", "series_home_wins", "series_away_wins", "series_overs", "series_unders",
  "o_u_line", "home_ml", "home_rl", "home_ml_handle", "home_ml_bets", "home_rl_handle", "home_rl_bets",
  "away_ml", "away_rl", "away_ml_handle", "away_ml_bets", "away_rl_handle", "away_rl_bets",
  "ou_handle_over", "ou_bets_over", "same_division", "same_league", "streak", "away_streak",
  "home_win_pct", "away_win_pct", "home_last_win", "away_last_win", "home_last_runs", "away_last_runs",
  "home_last_runs_allowed", "away_last_runs_allowed", "home_ops_last_3", "away_ops_last_3",
  "home_team_last_3", "away_team_last_3", "season", "month",
  "home_whip", "home_era", "away_whip", "away_era",
  "home_handedness", "away_handedness"
];

const textFilters = ["home_team", "away_team", "home_pitcher", "away_pitcher"];

interface Filters {
  [key: string]: string;
}

interface TrainingDataRow {
  ha_winner?: number;
  run_line_winner?: number;
  ou_result?: number;
  home_team?: string;
  away_team?: string;
  [key: string]: any;
}

interface PercentageStats {
  home_winner: string;
  away_winner: string;
  home_cover: string;
  away_cover: string;
  over: string;
  under: string;
}

type SortField = 'home_team' | 'away_team' | 'ha_winner' | 'run_line_winner' | 'ou_result';
type SortDirection = 'asc' | 'desc' | null;

export default function Analytics() {
  const [filters, setFilters] = useState<Filters>({});
  const [appliedFilters, setAppliedFilters] = useState<Filters>({});
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const queryFn = async (): Promise<TrainingDataRow[]> => {
    console.log('Fetching with applied filters:', appliedFilters);
    
    // Handle empty filters gracefully
    if (Object.keys(appliedFilters).length === 0 || Object.values(appliedFilters).every(value => !value || value.trim() === '')) {
      console.log('No applied filters, returning empty array');
      return [];
    }

    // Normalize team names in filters (e.g., Oakland -> Las Vegas)
    const normalizedFilters = normalizeTeamNamesInFilters(appliedFilters);
    console.log('Normalized filters:', normalizedFilters);

    // Build query string from normalized filters
    const queryString = buildQueryString(normalizedFilters);
    const url = `https://gnjrklxotmbvnxbnnqgq.functions.supabase.co/filter-training-data?${queryString}`;
    
    console.log('Original applied filters:', appliedFilters);
    console.log('Converted query string:', queryString);
    console.log('Sending GET request to:', url);

    // Call the edge function for filtering with GET method and query parameters
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ'
      },
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Edge function error response:', errorText);
      console.error('Request details:', { url, queryString, appliedFilters });
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Query result:', { data, count: data?.length });
    
    return data || [];
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['training_data', appliedFilters],
    queryFn,
  });

  const calculatePercentages = (rows: TrainingDataRow[]): PercentageStats | null => {
    const total = rows.length;
    if (total === 0) return null;
    
    const count = (col: string, val: number) => 
      rows.filter(r => r[col] === val).length;
    
    return {
      home_winner: (count('ha_winner', 1) / total * 100).toFixed(1),
      away_winner: (count('ha_winner', 0) / total * 100).toFixed(1),
      home_cover: (count('run_line_winner', 1) / total * 100).toFixed(1),
      away_cover: (count('run_line_winner', 0) / total * 100).toFixed(1),
      over: (count('ou_result', 1) / total * 100).toFixed(1),
      under: (count('ou_result', 0) / total * 100).toFixed(1),
    };
  };

  const stats = data ? calculatePercentages(data) : null;

  const handleChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilter = (key: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  const applyFilters = () => {
    console.log('Applying filters:', filters);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters({});
    setAppliedFilters({});
  };

  // Sorting functions
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-4 w-4" />;
    }
    return <ArrowUpDown className="h-4 w-4" />;
  };

  // Sort the data based on current sort settings
  const sortedData = useMemo(() => {
    if (!data || !sortField || !sortDirection) {
      return data || [];
    }

    return [...data].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle special cases for display values
      if (sortField === 'ha_winner') {
        aValue = aValue === 1 ? 'Home' : 'Away';
        bValue = bValue === 1 ? 'Home' : 'Away';
      } else if (sortField === 'run_line_winner') {
        aValue = aValue === 1 ? 'Home' : 'Away';
        bValue = bValue === 1 ? 'Home' : 'Away';
      } else if (sortField === 'ou_result') {
        aValue = aValue === 1 ? 'Over' : 'Under';
        bValue = bValue === 1 ? 'Over' : 'Under';
      }

      // Convert to strings for comparison
      const aStr = String(aValue || '');
      const bStr = String(bValue || '');

      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [data, sortField, sortDirection]);

  // Define ranges for different numeric fields with better formatting
  const getFieldConfig = (field: string) => {
    switch (field) {
      case 'o_u_line': return { 
        min: 6, max: 15, step: 0.5, 
        formatValue: (v: number) => v.toFixed(1) 
      };
      case 'home_ml': case 'away_ml': return { 
        min: -500, max: 500, step: 10,
        formatValue: (v: number) => v > 0 ? `+${v}` : v.toString()
      };
      case 'home_rl': case 'away_rl': return { 
        min: -3, max: 3, step: 0.5,
        formatValue: (v: number) => v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)
      };
      case 'home_win_pct': case 'away_win_pct': return { 
        min: 0, max: 100, step: 1,
        formatValue: (v: number) => `${v}%`
      };
      case 'season': return { min: 2020, max: 2025, step: 1 };
      case 'month': return { min: 1, max: 12, step: 1 };
      case 'series_game_number': return { min: 1, max: 7, step: 1 };
      case 'home_era': case 'away_era': return { 
        min: 0, max: 8, step: 0.1,
        formatValue: (v: number) => v.toFixed(2)
      };
      case 'home_whip': case 'away_whip': return { 
        min: 0.8, max: 2, step: 0.05,
        formatValue: (v: number) => v.toFixed(2)
      };
      default: return { min: 0, max: 100, step: 1 };
    }
  };

  // Prioritize the most commonly used filters
  const priorityFilters = ['o_u_line', 'series_game_number', 'month', 'home_ml', 'away_ml', 'home_win_pct', 'away_win_pct'];
  const otherFilters = numericFilters.filter(f => !priorityFilters.includes(f));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            MLB Betting Analytics
          </h1>
        </div>

        {/* Team Name Normalization Notice */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Team Name Normalization</h3>
          <p className="text-sm text-blue-700">
            Historical team name changes are automatically handled. For example, "Oakland" will be normalized to "Las Vegas" 
            to include data from both the Oakland Raiders (pre-2020) and Las Vegas Raiders (2020+) periods.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Filter Summary */}
          <FilterSummary 
            filters={filters}
            onClearFilter={handleClearFilter}
            onClearAll={clearFilters}
          />

          {/* Priority Range Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Key Range Filters</CardTitle>
              <CardDescription>Most commonly used filters with range sliders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {priorityFilters.map(field => {
                  const config = getFieldConfig(field);
                  return (
                    <NumericRangeFilter
                      key={field}
                      label={field.replace(/_/g, ' ')}
                      field={field}
                      value={filters[field] || ''}
                      onChange={handleChange}
                      {...config}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Text Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Text Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {textFilters.map(key => (
                  <div key={key} className="flex flex-col space-y-1">
                    <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
                    <Input
                      type="text"
                      value={filters[key] || ''}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={key.replace(/_/g, ' ')}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Additional Range Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Range Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherFilters.map(field => {
                  const config = getFieldConfig(field);
                  return (
                    <NumericRangeFilter
                      key={field}
                      label={field.replace(/_/g, ' ')}
                      field={field}
                      value={filters[field] || ''}
                      onChange={handleChange}
                      {...config}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button onClick={applyFilters} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Apply Filters'}
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear All Filters
            </Button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Error:</strong> {error.message}
            </div>
          )}

          {data && (
            <div className="mt-4">
              <p className="text-sm text-gray-600">Total records found: {data.length}</p>
            </div>
          )}

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(stats).map(([label, value]) => (
                <Card key={label}>
                  <CardContent className="text-center p-4">
                    <p className="text-lg capitalize">{label.replace(/_/g, ' ')}</p>
                    <p className="text-2xl font-semibold">{value}%</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {sortedData && sortedData.length > 0 && !isLoading && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Training Data Sample</CardTitle>
                <CardDescription>
                  A preview of the first 10 records matching your filters.
                  {sortField && sortDirection && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      Sorted by {sortField.replace('_', ' ')} ({sortDirection})
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleSort('home_team')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            <div className="flex items-center gap-2">
                              Home Team
                              {getSortIcon('home_team')}
                            </div>
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleSort('away_team')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            <div className="flex items-center gap-2">
                              Away Team
                              {getSortIcon('away_team')}
                            </div>
                          </Button>
                        </TableHead>
                        <TableHead className="text-center">
                          <Button
                            variant="ghost"
                            onClick={() => handleSort('ha_winner')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            <div className="flex items-center gap-2 justify-center">
                              Winner (ML)
                              {getSortIcon('ha_winner')}
                            </div>
                          </Button>
                        </TableHead>
                        <TableHead className="text-center">
                          <Button
                            variant="ghost"
                            onClick={() => handleSort('run_line_winner')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            <div className="flex items-center gap-2 justify-center">
                              Winner (RL)
                              {getSortIcon('run_line_winner')}
                            </div>
                          </Button>
                        </TableHead>
                        <TableHead className="text-center">
                          <Button
                            variant="ghost"
                            onClick={() => handleSort('ou_result')}
                            className="h-auto p-0 font-semibold hover:bg-transparent"
                          >
                            <div className="flex items-center gap-2 justify-center">
                              O/U Result
                              {getSortIcon('ou_result')}
                            </div>
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData.slice(0, 10).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.home_team}</TableCell>
                          <TableCell>{row.away_team}</TableCell>
                          <TableCell className="text-center">{row.ha_winner === 1 ? 'Home' : 'Away'}</TableCell>
                          <TableCell className="text-center">{row.run_line_winner === 1 ? 'Home' : 'Away'}</TableCell>
                          <TableCell className="text-center">{row.ou_result === 1 ? 'Over' : 'Under'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {sortedData && sortedData.length === 0 && !isLoading && (
            <div className="text-center py-8 text-gray-500">
              <p>No records found with the current filters.</p>
              <p className="text-sm mt-2">Try clearing filters or using different values.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
