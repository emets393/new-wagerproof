import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';

import SavePatternButton from '@/components/SavePatternButton';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

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

const CustomModels = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modelName, setModelName] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [targetVariable, setTargetVariable] = useState('');
  const [results, setResults] = useState<ModelResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast()

  // Helper function to get target-specific labels
  const getTargetLabels = (target: string) => {
    switch (target) {
      case 'over_under':
        return {
          primaryRate: 'Over Rate',
          opponentRate: 'Under Rate',
          primaryShort: 'Over %',
          opponentShort: 'Under %',
          avgLabel: 'Avg Over Rate'
        };
      case 'runline':
        return {
          primaryRate: 'Cover Rate',
          opponentRate: 'No Cover Rate',
          primaryShort: 'Cover %',
          opponentShort: 'No Cover %',
          avgLabel: 'Avg Cover Rate'
        };
      case 'moneyline':
        return {
          primaryRate: 'Win Rate',
          opponentRate: 'Loss Rate',
          primaryShort: 'Win %',
          opponentShort: 'Loss %',
          avgLabel: 'Avg Win Rate'
        };
      default:
        return {
          primaryRate: 'Win Rate',
          opponentRate: 'Loss Rate',
          primaryShort: 'Win %',
          opponentShort: 'Loss %',
          avgLabel: 'Avg Win Rate'
        };
    }
  };

  // Load state from URL parameters on component mount
  useEffect(() => {
    const urlModelName = searchParams.get('modelName');
    const urlFeatures = searchParams.get('features');
    const urlTarget = searchParams.get('target');
    const urlResults = searchParams.get('results');

    if (urlModelName) setModelName(urlModelName);
    if (urlFeatures) {
      try {
        setSelectedFeatures(JSON.parse(decodeURIComponent(urlFeatures)));
      } catch (e) {
        console.error('Failed to parse features from URL:', e);
      }
    }
    if (urlTarget) setTargetVariable(urlTarget);
    if (urlResults) {
      try {
        setResults(JSON.parse(decodeURIComponent(urlResults)));
      } catch (e) {
        console.error('Failed to parse results from URL:', e);
      }
    }
  }, [searchParams]);

  // Update URL parameters when state changes
  const updateUrlParams = (name: string, features: string[], target: string, modelResults: ModelResults | null) => {
    const params = new URLSearchParams();
    if (name) params.set('modelName', name);
    if (features.length > 0) params.set('features', encodeURIComponent(JSON.stringify(features)));
    if (target) params.set('target', target);
    if (modelResults) params.set('results', encodeURIComponent(JSON.stringify(modelResults)));
    
    setSearchParams(params);
  };

  const availableFeatures = [
    // Pitching Stats
    'primary_era', 'opponent_era', 'primary_whip', 'opponent_whip',
    
    // Team Performance
    'primary_win_pct', 'opponent_win_pct', 'primary_streak', 'opponent_streak',
    'primary_last_win', 'opponent_last_win', 'primary_last_3', 'opponent_last_3',
    
    // Recent Performance
    'primary_last_runs', 'opponent_last_runs', 'primary_ops_last_3', 'opponent_ops_last_3',
    'primary_team_last_3', 'opponent_team_last_3',
    
    // Betting Lines & Handle
    'primary_rl', 'o_u_line', 'primary_handle', 'opponent_handle',
    'primary_ml_handle', 'opponent_ml_handle', 'primary_rl_handle', 'opponent_rl_handle',
    
    // Betting Volume
    'primary_bets', 'opponent_bets', 'primary_ml_bets', 'opponent_ml_bets',
    'primary_rl_bets', 'opponent_rl_bets', 'ou_handle_over', 'ou_bets_over',
    
    // Advanced Stats
    'primary_ops', 'opponent_ops', 'primary_handedness', 'opponent_handedness',
    
    // Series & Context
    'same_league', 'same_division', 'series_primary_wins', 'series_opponent_wins',
    'series_overs', 'series_unders'
  ];

  const targetVariables = [
    'moneyline',
    'runline',
    'over_under'
  ];

  const handleFeatureChange = (feature: string) => {
    const newFeatures = selectedFeatures.includes(feature)
      ? selectedFeatures.filter(f => f !== feature)
      : [...selectedFeatures, feature];
    
    setSelectedFeatures(newFeatures);
    updateUrlParams(modelName, newFeatures, targetVariable, results);
  };

  const handleModelNameChange = (newName: string) => {
    setModelName(newName);
    updateUrlParams(newName, selectedFeatures, targetVariable, results);
  };

  const handleTargetChange = (newTarget: string) => {
    setTargetVariable(newTarget);
    updateUrlParams(modelName, selectedFeatures, newTarget, results);
  };

  const handleSubmit = async () => {
    if (!modelName.trim()) {
      toast({
        title: "Model name required",
        description: "Please enter a name for your model.",
        variant: "destructive"
      })
      return;
    }

    if (selectedFeatures.length < 3) {
       toast({
        title: "Minimum features required",
        description: "Please select at least 3 features for your model.",
        variant: "destructive"
      })
      return;
    }

    if (!targetVariable) {
       toast({
        title: "Target variable required",
        description: "Please select a target variable.",
        variant: "destructive"
      })
      return;
    }

    setIsLoading(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('run_custom_model', {
        body: {
          model_name: modelName,
          selected_features: selectedFeatures,
          target: targetVariable
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to run model');
      }

      setResults(data);
      updateUrlParams(modelName, selectedFeatures, targetVariable, data);
    } catch (error: any) {
      console.error('Error running custom model:', error);
      toast({
        title: "Error running model",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false);
    }
  };

  // Get target-specific labels for current target
  const targetLabels = getTargetLabels(targetVariable);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      {/* Header Section */}
      <div className="container max-w-7xl mx-auto py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Custom Model Builder
        </h1>
        <p className="text-gray-600">
          Create and run custom models to identify trend patterns and gain
          insights from historical data.
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Model Building Form */}
        <Card>
          <CardHeader>
            <CardTitle>Build Your Model</CardTitle>
            <p className="text-sm text-gray-600">
              Define your model parameters and select features to analyze.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <Label htmlFor="model-name">Model Name</Label>
              <Input
                id="model-name"
                placeholder="Enter model name"
                value={modelName}
                onChange={(e) => handleModelNameChange(e.target.value)}
              />
            </div>

            <div>
              <Label>Select Features</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {availableFeatures.map((feature) => (
                  <Button
                    key={feature}
                    variant={selectedFeatures.includes(feature) ? 'default' : 'outline'}
                    onClick={() => handleFeatureChange(feature)}
                    className="text-sm"
                  >
                    {feature}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>Target Variable</Label>
              <Select value={targetVariable} onValueChange={handleTargetChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select target variable" />
                </SelectTrigger>
                <SelectContent>
                  {targetVariables.map((variable) => (
                    <SelectItem key={variable} value={variable}>
                      {variable}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Running Model...' : 'Run Model'}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {results && (
          <div className="space-y-6">
            {/* Model Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Model Results Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{results.trend_matches.length}</p>
                    <p className="text-sm text-gray-600">Trend Patterns</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{Object.keys(
                      results.today_matches.reduce((acc: any, match) => {
                        acc[match.unique_id] = true;
                        return acc;
                      }, {})
                    ).length}</p>
                    <p className="text-sm text-gray-600">Today's Games</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{selectedFeatures.length}</p>
                    <p className="text-sm text-gray-600">Features Used</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{results.target}</p>
                    <p className="text-sm text-gray-600">Target Variable</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trend Patterns */}
            {results.trend_matches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Trend Patterns</CardTitle>
                  <p className="text-sm text-gray-600">
                    Strongest predictive patterns found in historical data
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">{targetLabels.primaryShort}</th>
                          <th className="text-left p-2">{targetLabels.opponentShort}</th>
                          <th className="text-left p-2">Games</th>
                          <th className="text-left p-2">Features</th>
                          <th className="text-left p-2">Pattern</th>
                          <th className="text-left p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.trend_matches.map((match, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="p-2">
                              <span className={`font-medium ${
                                match.win_pct > 0.6 ? 'text-green-600' : 
                                match.win_pct < 0.4 ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {(match.win_pct * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-2">
                              <span className={`font-medium ${
                                match.opponent_win_pct > 0.6 ? 'text-green-600' : 
                                match.opponent_win_pct < 0.4 ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {(match.opponent_win_pct * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-2">{match.games}</td>
                            <td className="p-2">{match.feature_count}</td>
                            <td className="p-2">
                              <div className="flex flex-wrap gap-1 max-w-md">
                                {match.combo.split('|').slice(0, 3).map((feature, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {feature}
                                  </Badge>
                                ))}
                                {match.combo.split('|').length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{match.combo.split('|').length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-2">
                              <SavePatternButton
                                combo={match.combo}
                                features={match.features}
                                winPct={match.win_pct}
                                opponentWinPct={match.opponent_win_pct}
                                games={match.games}
                                featureCount={match.feature_count}
                                target={results.target}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Today's Matches - Fixed to show only unique games */}
            {results.today_matches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Today's Matching Games</CardTitle>
                  <p className="text-sm text-gray-600">
                    Games that match your model's predictive patterns
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Group matches by unique_id to eliminate duplicates */}
                    {Object.entries(
                      results.today_matches.reduce((acc: any, match) => {
                        if (!acc[match.unique_id]) {
                          acc[match.unique_id] = {
                            matches: [],
                            gameInfo: null
                          };
                        }
                        acc[match.unique_id].matches.push(match);
                        
                        // Use the first match for game info display
                        if (!acc[match.unique_id].gameInfo) {
                          acc[match.unique_id].gameInfo = {
                            primary_team: match.primary_team,
                            opponent_team: match.opponent_team,
                            unique_id: match.unique_id
                          };
                        }
                        return acc;
                      }, {})
                    ).map(([uniqueId, gameGroup]: [string, any]) => {
                      const matches = gameGroup.matches;
                      const gameInfo = gameGroup.gameInfo;
                      
                      return (
                        <div key={uniqueId} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">
                                {gameInfo.primary_team} vs {gameInfo.opponent_team}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {matches.length} matching model{matches.length > 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Link to={`/game-analysis/${uniqueId}?target=${encodeURIComponent(results.target)}`}>
                                <Button variant="outline" size="sm">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Analyze
                                </Button>
                              </Link>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            {matches.map((match: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                                <span>Model #{idx + 1}</span>
                                <div className="flex gap-4 text-gray-600">
                                  <span>{match.feature_count} features</span>
                                  <span>{match.games} games</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {results.trend_matches.length === 0 && results.today_matches.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-600">No significant patterns found with the selected features.</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Try adjusting your feature selection or target variable.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomModels;
