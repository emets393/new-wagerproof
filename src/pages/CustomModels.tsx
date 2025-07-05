import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast"

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
  const [modelName, setModelName] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [targetVariable, setTargetVariable] = useState('');
  const [results, setResults] = useState<ModelResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast()

  const availableFeatures = [
    'primary_era', 'opponent_era', 'primary_win_pct', 'opponent_win_pct',
    'primary_rl', 'o_u_line', 'primary_ops', 'opponent_ops',
    'primary_streak', 'opponent_streak', 'primary_last_runs', 'opponent_last_runs',
    'primary_handle', 'opponent_handle', 'primary_bets', 'opponent_bets',
    'primary_handedness', 'opponent_handedness', 'same_league', 'same_division',
    'primary_last_win', 'opponent_last_win', 'primary_last_3', 'opponent_last_3'
  ];

  const targetVariables = [
    'moneyline',
    'runline',
    'over_under'
  ];

  const handleFeatureChange = (feature: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
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
      const response = await fetch('/functions/v1/run_custom_model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: modelName,
          selected_features: selectedFeatures,
          target: targetVariable
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run model');
      }

      const data = await response.json();
      setResults(data);
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
                onChange={(e) => setModelName(e.target.value)}
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
              <Select value={targetVariable} onValueChange={setTargetVariable}>
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
                    <p className="text-2xl font-bold text-green-600">{results.today_matches.length}</p>
                    <p className="text-sm text-gray-600">Today's Matches</p>
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
                          <th className="text-left p-2">Win %</th>
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

            {/* Today's Matches */}
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
                    {/* Group matches by game */}
                    {Object.entries(
                      results.today_matches.reduce((acc: any, match) => {
                        const key = `${match.primary_team}-vs-${match.opponent_team}`;
                        if (!acc[key]) {
                          acc[key] = [];
                        }
                        acc[key].push(match);
                        return acc;
                      }, {})
                    ).map(([gameKey, matches]: [string, any]) => {
                      const firstMatch = matches[0];
                      const avgWinPct = matches.reduce((sum: number, m: any) => sum + m.win_pct, 0) / matches.length;
                      
                      return (
                        <div key={gameKey} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">
                                {firstMatch.primary_team} vs {firstMatch.opponent_team}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {matches.length} matching model{matches.length > 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <p className={`font-semibold ${
                                  avgWinPct > 0.6 ? 'text-green-600' : 
                                  avgWinPct < 0.4 ? 'text-red-600' : 'text-yellow-600'
                                }`}>
                                  {(avgWinPct * 100).toFixed(1)}%
                                </p>
                                <p className="text-xs text-gray-600">Avg Win Rate</p>
                              </div>
                              <Link 
                                to={`/game-analysis/${firstMatch.unique_id}`}
                                className="ml-2"
                              >
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
                                <span>Model #{idx + 1}: {match.feature_count} features, {match.games} games</span>
                                <span className={`font-medium ${
                                  match.win_pct > 0.6 ? 'text-green-600' : 
                                  match.win_pct < 0.4 ? 'text-red-600' : 'text-yellow-600'
                                }`}>
                                  {(match.win_pct * 100).toFixed(1)}%
                                </span>
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
