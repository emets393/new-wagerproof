import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Target, Settings, ChevronUp, ChevronDown, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TrendMatch {
  combo: string;
  games: number;
  win_pct: number;
  opponent_win_pct: number;
  feature_count: number;
  features: string[];
}

interface TodayMatch {
  unique_id: string;
  primary_team: string;
  opponent_team: string;
  is_home_team: boolean;
  combo: string;
  win_pct: number;
  opponent_win_pct: number;
  games: number;
  feature_count: number;
  features: string[];
}

interface ModelResults {
  model_id: string;
  trend_matches: TrendMatch[];
  today_matches: TodayMatch[];
  target: string;
}

const featureOptions = [
  { id: "primary_era", label: "Primary Team ERA", category: "Pitching" },
  { id: "opponent_era", label: "Opponent ERA", category: "Pitching" },
  { id: "primary_whip", label: "Primary Team WHIP", category: "Pitching" },
  { id: "opponent_whip", label: "Opponent WHIP", category: "Pitching" },
  { id: "primary_last_runs", label: "Primary Last Runs", category: "Recent Performance" },
  { id: "opponent_last_runs", label: "Opponent Last Runs", category: "Recent Performance" },
  { id: "primary_last_runs_allowed", label: "Primary Last Runs Allowed", category: "Recent Performance" },
  { id: "opponent_last_runs_allowed", label: "Opponent Last Runs Allowed", category: "Recent Performance" },
  { id: "primary_last_win", label: "Primary Last Win", category: "Recent Performance" },
  { id: "opponent_last_win", label: "Opponent Last Win", category: "Recent Performance" },
  { id: "primary_streak", label: "Primary Streak", category: "Recent Performance" },
  { id: "opponent_streak", label: "Opponent Streak", category: "Recent Performance" },
  { id: "primary_rl", label: "Primary Run Line", category: "Betting Lines" },
  { id: "o_u_line", label: "Over/Under Line", category: "Betting Lines" },
  { id: "primary_ml_handle", label: "Primary ML Handle", category: "Betting Volume" },
  { id: "opponent_ml_handle", label: "Opponent ML Handle", category: "Betting Volume" },
  { id: "primary_ml_bets", label: "Primary ML Bets", category: "Betting Volume" },
  { id: "opponent_ml_bets", label: "Opponent ML Bets", category: "Betting Volume" },
  { id: "primary_rl_handle", label: "Primary RL Handle", category: "Betting Volume" },
  { id: "opponent_rl_handle", label: "Opponent RL Handle", category: "Betting Volume" },
  { id: "primary_rl_bets", label: "Primary RL Bets", category: "Betting Volume" },
  { id: "opponent_rl_bets", label: "Opponent RL Bets", category: "Betting Volume" },
  { id: "ou_handle_over", label: "Over Handle", category: "Betting Volume" },
  { id: "ou_bets_over", label: "Over Bets", category: "Betting Volume" },
  { id: "primary_team_last_3", label: "Primary Team Last 3", category: "Team Stats" },
  { id: "opponent_team_last_3", label: "Opponent Team Last 3", category: "Team Stats" },
  { id: "primary_ops_last_3", label: "Primary OPS Last 3", category: "Team Stats" },
  { id: "opponent_ops_last_3", label: "Opponent OPS Last 3", category: "Team Stats" },
  { id: "primary_win_pct", label: "Primary Win %", category: "Season Stats" },
  { id: "opponent_win_pct", label: "Opponent Win %", category: "Season Stats" },
  { id: "same_league", label: "Same League", category: "Matchup Context" },
  { id: "same_division", label: "Same Division", category: "Matchup Context" },
  { id: "primary_handedness", label: "Primary Handedness", category: "Matchup Context" },
  { id: "opponent_handedness", label: "Opponent Handedness", category: "Matchup Context" },
];

const targetOptions = [
  { label: "Moneyline", value: "moneyline" },
  { label: "Run Line", value: "runline" },
  { label: "Over/Under", value: "over_under" }
];

const groupedFeatures = featureOptions.reduce((groups, feature) => {
  if (!groups[feature.category]) {
    groups[feature.category] = [];
  }
  groups[feature.category].push(feature);
  return groups;
}, {} as Record<string, typeof featureOptions>);

type TrendSortColumn = 'primary' | 'opponent' | 'games';
type TodaySortColumn = 'matchup' | 'model' | 'winner' | 'percentage' | 'games';
type SortDirection = 'asc' | 'desc';

export default function CustomModels() {
  const [modelName, setModelName] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [results, setResults] = useState<ModelResults | null>(null);
  const [trendSortColumn, setTrendSortColumn] = useState<TrendSortColumn>('games');
  const [trendSortDirection, setTrendSortDirection] = useState<SortDirection>('desc');
  const [todaySortColumn, setTodaySortColumn] = useState<TodaySortColumn>('percentage');
  const [todaySortDirection, setTodaySortDirection] = useState<SortDirection>('desc');
  const { toast } = useToast();

  const handleFeatureToggle = (featureId: string) => {
    setSelectedFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const handleTrendSort = (column: TrendSortColumn) => {
    if (trendSortColumn === column) {
      setTrendSortDirection(trendSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setTrendSortColumn(column);
      setTrendSortDirection('desc');
    }
  };

  const handleTodaySort = (column: TodaySortColumn) => {
    if (todaySortColumn === column) {
      setTodaySortDirection(todaySortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setTodaySortColumn(column);
      setTodaySortDirection('desc');
    }
  };

  const getSortIcon = (currentColumn: string, targetColumn: string, direction: SortDirection) => {
    if (currentColumn !== targetColumn) {
      return <ChevronUp className="w-4 h-4 opacity-30" />;
    }
    return direction === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  const sortTrendMatches = (matches: TrendMatch[]) => {
    return [...matches].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (trendSortColumn) {
        case 'primary':
          aValue = a.win_pct;
          bValue = b.win_pct;
          break;
        case 'opponent':
          aValue = a.opponent_win_pct;
          bValue = b.opponent_win_pct;
          break;
        case 'games':
          aValue = a.games;
          bValue = b.games;
          break;
        default:
          aValue = a.games;
          bValue = b.games;
      }

      return trendSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  const sortTodayMatches = (matches: TodayMatch[]) => {
    return [...matches].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (todaySortColumn) {
        case 'matchup':
          aValue = formatMatchup(a);
          bValue = formatMatchup(b);
          break;
        case 'model':
          const aModelIndex = results?.trend_matches.findIndex(trend => trend.combo === a.combo) ?? -1;
          const bModelIndex = results?.trend_matches.findIndex(trend => trend.combo === b.combo) ?? -1;
          aValue = aModelIndex + 1;
          bValue = bModelIndex + 1;
          break;
        case 'winner':
          aValue = getProjectedWinner(a, results?.target || '');
          bValue = getProjectedWinner(b, results?.target || '');
          break;
        case 'percentage':
          aValue = getProjectedWinPercentage(a);
          bValue = getProjectedWinPercentage(b);
          break;
        case 'games':
          aValue = a.games;
          bValue = b.games;
          break;
        default:
          aValue = getProjectedWinPercentage(a);
          bValue = getProjectedWinPercentage(b);
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return todaySortDirection === 'asc' ? 
          aValue.localeCompare(bValue) : 
          bValue.localeCompare(aValue);
      } else {
        return todaySortDirection === 'asc' ? 
          (aValue as number) - (bValue as number) : 
          (bValue as number) - (aValue as number);
      }
    });
  };

  const getColumnHeaders = (targetType: string) => {
    switch (targetType) {
      case 'moneyline':
        return ['Model #', 'Features', 'Primary Win %', 'Opponent Win %', '# of Games'];
      case 'runline':
        return ['Model #', 'Features', 'Primary Cover %', 'Opponent Cover %', '# of Games'];
      case 'over_under':
        return ['Model #', 'Features', 'Over %', 'Under %', '# of Games'];
      default:
        return ['Model #', 'Features', 'Primary %', 'Opponent %', '# of Games'];
    }
  };

  const getTodayHeaders = (targetType: string) => {
    switch (targetType) {
      case 'moneyline':
      case 'runline':
        return ['Matchup', 'Model #', 'Features', 'Projected Winner', 'Win %', '# of Games'];
      case 'over_under':
        return ['Matchup', 'Model #', 'Features', 'Projected Winner', 'Win %', '# of Games'];
      default:
        return ['Matchup', 'Model #', 'Features', 'Projected Winner', 'Win %', '# of Games'];
    }
  };

  const formatFeatures = (features: string[]) => {
    const featureLabels = features.map(featureId => {
      const feature = featureOptions.find(f => f.id === featureId);
      return feature ? feature.label.replace(/^(Primary|Opponent)\s+/, '') : featureId;
    });
    return featureLabels.slice(0, 3).join(', ') + (featureLabels.length > 3 ? '...' : '');
  };

  const formatMatchup = (match: TodayMatch) => {
    return match.is_home_team 
      ? `${match.opponent_team} at ${match.primary_team}`
      : `${match.primary_team} at ${match.opponent_team}`;
  };

  const getProjectedWinner = (match: TodayMatch, targetType: string) => {
    if (targetType === 'over_under') {
      return match.win_pct > match.opponent_win_pct ? 'Over' : 'Under';
    }
    return match.win_pct > match.opponent_win_pct ? match.primary_team : match.opponent_team;
  };

  const getProjectedWinPercentage = (match: TodayMatch) => {
    return Math.max(match.win_pct, match.opponent_win_pct);
  };

  const handleBuildModel = async () => {
    if (!modelName.trim()) {
      toast({
        title: "Missing Model Name",
        description: "Please enter a name for your model.",
        variant: "destructive"
      });
      return;
    }

    if (selectedFeatures.length < 2) {
      toast({
        title: "Not Enough Features",
        description: "Please select at least 2 features for your model.",
        variant: "destructive"
      });
      return;
    }

    if (!target) {
      toast({
        title: "Missing Target",
        description: "Please select a target prediction type.",
        variant: "destructive"
      });
      return;
    }

    setIsBuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke('run_custom_model', {
        body: {
          model_name: modelName,
          selected_features: selectedFeatures,
          target: target
        }
      });

      if (error) throw error;

      setResults(data);
      toast({
        title: "Model Built Successfully!",
        description: `Found ${data.trend_matches.length} trend patterns and ${data.today_matches.length} matching games today.`
      });
    } catch (error) {
      console.error('Error building model:', error);
      toast({
        title: "Error Building Model",
        description: error.message || "Failed to build the custom model. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Custom Model Builder
            </h1>
            <p className="text-muted-foreground mt-2">
              Create your own predictive models by selecting features and target outcomes
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Model Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Model Configuration
                </CardTitle>
                <CardDescription>
                  Configure your custom prediction model
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="model-name">Model Name</Label>
                  <Input
                    id="model-name"
                    placeholder="Enter a name for your model"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Target Prediction</Label>
                  <Select value={target} onValueChange={setTarget}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select what to predict" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <Label>Select Features ({selectedFeatures.length} selected)</Label>
                  <div className="max-h-80 overflow-y-auto space-y-4 border rounded-lg p-4">
                    {Object.entries(groupedFeatures).map(([category, features]) => (
                      <div key={category} className="space-y-2">
                        <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">
                          {category}
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {features.map(feature => (
                            <div key={feature.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={feature.id}
                                checked={selectedFeatures.includes(feature.id)}
                                onCheckedChange={() => handleFeatureToggle(feature.id)}
                              />
                              <Label 
                                htmlFor={feature.id} 
                                className="text-sm font-normal cursor-pointer"
                              >
                                {feature.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleBuildModel} 
                  disabled={isBuilding}
                  className="w-full"
                >
                  {isBuilding ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Building Model...
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4 mr-2" />
                      Build Model
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            {results && (
              <div className="space-y-6">
                {/* Trend Patterns */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Trend Patterns ({results.trend_matches.length})
                    </CardTitle>
                    <CardDescription>
                      Historical patterns with 25+ games and strong predictive edge (includes 4-5 feature subsets)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Model #</TableHead>
                            <TableHead>Features</TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                className="font-medium text-left p-0 h-auto hover:text-primary transition-colors flex items-center gap-1"
                                onClick={() => handleTrendSort('primary')}
                              >
                                {getColumnHeaders(results.target)[2]}
                                {getSortIcon(trendSortColumn, 'primary', trendSortDirection)}
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                className="font-medium text-left p-0 h-auto hover:text-primary transition-colors flex items-center gap-1"
                                onClick={() => handleTrendSort('opponent')}
                              >
                                {getColumnHeaders(results.target)[3]}
                                {getSortIcon(trendSortColumn, 'opponent', trendSortDirection)}
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                className="font-medium text-left p-0 h-auto hover:text-primary transition-colors flex items-center gap-1"
                                onClick={() => handleTrendSort('games')}
                              >
                                {getColumnHeaders(results.target)[4]}
                                {getSortIcon(trendSortColumn, 'games', trendSortDirection)}
                              </Button>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortTrendMatches(results.trend_matches).map((trend, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-semibold">
                                {results.trend_matches.indexOf(trend) + 1}
                              </TableCell>
                              <TableCell>
                                <Tooltip>
                                  <TooltipTrigger className="flex items-center gap-1 cursor-help">
                                    <span className="text-xs bg-muted px-2 py-1 rounded">
                                      {trend.feature_count}f
                                    </span>
                                    <Info className="w-3 h-3 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="max-w-xs">
                                      <p className="font-semibold mb-1">{trend.feature_count} Features:</p>
                                      {trend.features.map(featureId => {
                                        const feature = featureOptions.find(f => f.id === featureId);
                                        return (
                                          <p key={featureId} className="text-xs">
                                            • {feature?.label || featureId}
                                          </p>
                                        );
                                      })}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="font-semibold">
                                {(trend.win_pct * 100).toFixed(1)}%
                              </TableCell>
                              <TableCell className="font-semibold">
                                {(trend.opponent_win_pct * 100).toFixed(1)}%
                              </TableCell>
                              <TableCell>{trend.games}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Today's Matches */}
                <Card>
                  <CardHeader>
                    <CardTitle>Today's Matching Games ({results.today_matches.length})</CardTitle>
                    <CardDescription>
                      Games today that match your trend patterns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <Button
                                variant="ghost"
                                className="font-medium text-left p-0 h-auto hover:text-primary transition-colors flex items-center gap-1"
                                onClick={() => handleTodaySort('matchup')}
                              >
                                Matchup
                                {getSortIcon(todaySortColumn, 'matchup', todaySortDirection)}
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                className="font-medium text-left p-0 h-auto hover:text-primary transition-colors flex items-center gap-1"
                                onClick={() => handleTodaySort('model')}
                              >
                                Model #
                                {getSortIcon(todaySortColumn, 'model', todaySortDirection)}
                              </Button>
                            </TableHead>
                            <TableHead>Features</TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                className="font-medium text-left p-0 h-auto hover:text-primary transition-colors flex items-center gap-1"
                                onClick={() => handleTodaySort('winner')}
                              >
                                Projected Winner
                                {getSortIcon(todaySortColumn, 'winner', todaySortDirection)}
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                className="font-medium text-left p-0 h-auto hover:text-primary transition-colors flex items-center gap-1"
                                onClick={() => handleTodaySort('percentage')}
                              >
                                Win %
                                {getSortIcon(todaySortColumn, 'percentage', todaySortDirection)}
                              </Button>
                            </TableHead>
                            <TableHead>
                              <Button
                                variant="ghost"
                                className="font-medium text-left p-0 h-auto hover:text-primary transition-colors flex items-center gap-1"
                                onClick={() => handleTodaySort('games')}
                              >
                                # of Games
                                {getSortIcon(todaySortColumn, 'games', todaySortDirection)}
                              </Button>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortTodayMatches(results.today_matches).map((match, index) => {
                            const matchingModelIndex = results.trend_matches.findIndex(
                              trend => trend.combo === match.combo
                            ) + 1;
                            
                            return (
                              <TableRow key={index}>
                                <TableCell className="font-semibold">
                                  {formatMatchup(match)}
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {matchingModelIndex}
                                </TableCell>
                                <TableCell>
                                  <Tooltip>
                                    <TooltipTrigger className="flex items-center gap-1 cursor-help">
                                      <span className="text-xs bg-muted px-2 py-1 rounded">
                                        {match.feature_count}f
                                      </span>
                                      <Info className="w-3 h-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="max-w-xs">
                                        <p className="font-semibold mb-1">{match.feature_count} Features:</p>
                                        {match.features.map(featureId => {
                                          const feature = featureOptions.find(f => f.id === featureId);
                                          return (
                                            <p key={featureId} className="text-xs">
                                              • {feature?.label || featureId}
                                            </p>
                                          );
                                        })}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {getProjectedWinner(match, results.target)}
                                </TableCell>
                                <TableCell className="font-semibold">
                                  {(getProjectedWinPercentage(match) * 100).toFixed(1)}%
                                </TableCell>
                                <TableCell>{match.games}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
