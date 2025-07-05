import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Target, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TrendMatch {
  combo: string;
  games: number;
  win_pct: number;
}

interface TodayMatch {
  unique_id: string;
  primary_team: string;
  opponent_team: string;
  combo: string;
  win_pct: number;
  games: number;
}

interface ModelResults {
  model_id: string;
  trend_matches: TrendMatch[];
  today_matches: TodayMatch[];
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

export default function CustomModels() {
  const [modelName, setModelName] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [results, setResults] = useState<ModelResults | null>(null);
  const { toast } = useToast();

  const handleFeatureToggle = (featureId: string) => {
    setSelectedFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
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
              {/* Trend Matches */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Trend Patterns ({results.trend_matches.length})
                  </CardTitle>
                  <CardDescription>
                    Historical patterns with 15+ games
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pattern</TableHead>
                          <TableHead>Win %</TableHead>
                          <TableHead>Games</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.trend_matches.map((trend, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-xs">
                              {trend.combo.replace(/\|/g, ' | ')}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {(trend.win_pct * 100).toFixed(1)}%
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
                          <TableHead>Matchup</TableHead>
                          <TableHead>Pattern</TableHead>
                          <TableHead>Win %</TableHead>
                          <TableHead>Games</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.today_matches.map((match, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-semibold">
                              {match.primary_team} vs {match.opponent_team}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {match.combo.replace(/\|/g, ' | ')}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {(match.win_pct * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell>{match.games}</TableCell>
                          </TableRow>
                        ))}
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
  );
}
