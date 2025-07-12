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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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
  const [explainPatternIndex, setExplainPatternIndex] = useState<number | null>(null);
  const [openInfoIndex, setOpenInfoIndex] = useState<number | null>(null);

  const featureConfig = [
    { key: 'primary_era', supabaseColumn: 'primary_era', displayName: 'Primary Pitcher ERA', blurb: 'ERA (Earned Run Average) of the primary team\'s starting pitcher.' },
    { key: 'opponent_era', supabaseColumn: 'opponent_era', displayName: 'Opponent Pitcher ERA', blurb: 'ERA of the opponent\'s starting pitcher.' },
    { key: 'primary_whip', supabaseColumn: 'primary_whip', displayName: 'Primary Pitcher WHIP', blurb: 'WHIP (Walks + Hits per Inning Pitched) for the primary team\'s starter.' },
    { key: 'opponent_whip', supabaseColumn: 'opponent_whip', displayName: 'Opponent Pitcher WHIP', blurb: 'WHIP for the opponent\'s starting pitcher.' },
    { key: 'primary_win_pct', supabaseColumn: 'primary_win_pct', displayName: 'Primary Team Win %', blurb: 'Win percentage for the primary team.' },
    { key: 'opponent_win_pct', supabaseColumn: 'opponent_win_pct', displayName: 'Opponent Team Win %', blurb: 'Win percentage for the opponent team.' },
    { key: 'primary_streak', supabaseColumn: 'primary_streak', displayName: 'Primary Team Win Streak', blurb: 'Number of consecutive wins or losses for the primary team.' },
    { key: 'opponent_streak', supabaseColumn: 'opponent_streak', displayName: 'Opponent Team Win Streak', blurb: 'Number of consecutive wins or losses for the opponent team.' },
    { key: 'primary_last_win', supabaseColumn: 'primary_last_win', displayName: 'Primary Last Game Result', blurb: 'Whether the primary team won their last game.' },
    { key: 'opponent_last_win', supabaseColumn: 'opponent_last_win', displayName: 'Opponent Last Game Result', blurb: 'Whether the opponent team won their last game.' },
    { key: 'primary_last_runs', supabaseColumn: 'primary_last_runs', displayName: 'Primary Runs Last Game', blurb: 'Runs scored by the primary team in their last game.' },
    { key: 'opponent_last_runs', supabaseColumn: 'opponent_last_runs', displayName: 'Opponent Last Runs Scored', blurb: 'Runs scored by the opponent in their last game.' },
    { key: 'primary_ops_last_3', supabaseColumn: 'primary_ops_last_3', displayName: 'Primary OPS % allowed (Last 3 gms)', blurb: 'On-base + slugging % in the last 3 games for the primary team.' },
    { key: 'opponent_ops_last_3', supabaseColumn: 'opponent_ops_last_3', displayName: 'Opponent OPS % allowed (Last 3 gms)', blurb: 'On-base + slugging % in the last 3 games for the opponent team.' },
    { key: 'primary_team_last_3', supabaseColumn: 'primary_team_last_3', displayName: 'Primary Team OPS % (Last 3 gms)', blurb: 'Win/Loss record in the last 3 games for the primary team.' },
    { key: 'opponent_team_last_3', supabaseColumn: 'opponent_team_last_3', displayName: 'Opponent Team OPS % (Last 3 gms)', blurb: 'Win/Loss record in the last 3 games for the opponent.' },
    { key: 'primary_rl', supabaseColumn: 'primary_rl', displayName: 'Favorite/Underdog', blurb: 'Which team is favored/underdog.' },
    { key: 'o_u_line', supabaseColumn: 'o_u_line', displayName: 'Over/Under Line', blurb: 'Total expected runs set by the sportsbook.' },
    { key: 'primary_ml_handle', supabaseColumn: 'primary_ml_handle', displayName: 'Primary ML Handle', blurb: '% of money wagered on the primary team\'s moneyline.' },
    { key: 'opponent_ml_handle', supabaseColumn: 'opponent_ml_handle', displayName: 'Opponent ML Handle', blurb: '% of money wagered on the opponent team\'s moneyline.' },
    { key: 'primary_rl_handle', supabaseColumn: 'primary_rl_handle', displayName: 'Primary RL Handle', blurb: 'Money wagered on the primary team\'s run line.' },
    { key: 'opponent_rl_handle', supabaseColumn: 'opponent_rl_handle', displayName: 'Opponent RL Handle', blurb: 'Money wagered on the opponent team\'s run line.' },
    { key: 'primary_ml_bets', supabaseColumn: 'primary_ml_bets', displayName: 'Primary ML Bets', blurb: '% of moneyline bets on the primary team.' },
    { key: 'opponent_ml_bets', supabaseColumn: 'opponent_ml_bets', displayName: 'Opponent ML Bets', blurb: '% of moneyline bets on the opponent team.' },
    { key: 'primary_rl_bets', supabaseColumn: 'primary_rl_bets', displayName: 'Primary RL Bets', blurb: '% of run line bets on the primary team.' },
    { key: 'opponent_rl_bets', supabaseColumn: 'opponent_rl_bets', displayName: 'Opponent RL Bets', blurb: '% of run line bets on the opponent team.' },
    { key: 'ou_handle_over', supabaseColumn: 'ou_handle_over', displayName: 'Over/Under Handle', blurb: '% of money wagered on the Over for total runs.' },
    { key: 'ou_bets_over', supabaseColumn: 'ou_bets_over', displayName: 'Over Under Bets', blurb: '% of bets on the Over for total runs.' },
    { key: 'primary_ops', supabaseColumn: 'primary_ops', displayName: 'Primary Team OPS', blurb: 'Season OPS (On-base + Slugging) for the primary team.' },
    { key: 'opponent_ops', supabaseColumn: 'opponent_ops', displayName: 'Opponent Team OPS', blurb: 'Season OPS for the opponent team.' },
    { key: 'primary_handedness', supabaseColumn: 'primary_handedness', displayName: 'Primary Pitcher Handedness', blurb: 'Left-handed or right-handed primary pitcher.' },
    { key: 'opponent_handedness', supabaseColumn: 'opponent_handedness', displayName: 'Opponent Pitcher Handedness', blurb: 'Left-handed or right-handed opponent pitcher.' },
    { key: 'same_league', supabaseColumn: 'same_league', displayName: 'Same League Matchup', blurb: 'Whether both teams are in the same league.' },
    { key: 'same_division', supabaseColumn: 'same_division', displayName: 'Same Division Matchup', blurb: 'Whether both teams are in the same division.' },
    { key: 'series_primary_wins', supabaseColumn: 'series_primary_wins', displayName: 'Primary Series Wins', blurb: 'Games won by the primary team in this series.' },
    { key: 'series_opponent_wins', supabaseColumn: 'series_opponent_wins', displayName: 'Opponent Series Wins', blurb: 'Games won by the opponent team in this series.' },
    { key: 'series_overs', supabaseColumn: 'series_overs', displayName: 'Series Over Hits', blurb: 'Games in this series that hit the Over.' },
    { key: 'series_unders', supabaseColumn: 'series_unders', displayName: 'Series Under Hits', blurb: 'Games in this series that hit the Under.' },
  ];

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

  const availableFeatures = featureConfig.map(f => f.key);

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

  // Restore getTargetLabels for table headers
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

  // Use targetLabels for table headers
  const targetLabels = getTargetLabels(targetVariable);

  function describePattern(features: string[], combo: string) {
    const bins = combo.split('|');
    const phrases = features.map((feature, i) => {
      const value = bins[i];
      // Example mappings for common features
      if (feature === 'primary_pitcher_era') {
        if (value === 'good') return 'a primary pitcher with a good ERA';
        if (value === 'average') return 'a primary pitcher with an average ERA';
        if (value === 'poor') return 'a primary pitcher with a poor ERA';
      }
      if (feature === 'primary_team_last_win') {
        return value === 'yes' ? 'a primary team who won their last game' : 'a primary team who lost their last game';
      }
      if (feature === 'opponent_last_win') {
        return value === 'yes' ? 'an opponent who won their last game' : 'an opponent who lost their last game';
      }
      if (feature === 'primary_team_streak') {
        if (value === 'hot') return 'a primary team on a hot streak';
        if (value === 'neutral') return 'a primary team on a neutral streak';
        if (value === 'cold') return 'a primary team on a cold streak';
      }
      if (feature === 'opponent_team_streak') {
        if (value === 'hot') return 'an opponent on a hot streak';
        if (value === 'neutral') return 'an opponent on a neutral streak';
        if (value === 'cold') return 'an opponent on a cold streak';
      }
      if (feature === 'primary_pitcher_whip') {
        if (value === 'good') return 'a primary pitcher with a good WHIP';
        if (value === 'average') return 'a primary pitcher with an average WHIP';
        if (value === 'poor') return 'a primary pitcher with a poor WHIP';
      }
      if (feature === 'primary_team_win_pct') {
        if (value === 'good') return 'a primary team with a high win percentage';
        if (value === 'average') return 'a primary team with an average win percentage';
        if (value === 'poor') return 'a primary team with a low win percentage';
      }
      if (feature === 'opponent_team_win_pct') {
        if (value === 'good') return 'an opponent with a high win percentage';
        if (value === 'average') return 'an opponent with an average win percentage';
        if (value === 'poor') return 'an opponent with a low win percentage';
      }
      if (feature === 'primary_team_last_runs') {
        if (value === 'high') return 'a primary team that scored a lot of runs recently';
        if (value === 'medium') return 'a primary team that scored a moderate number of runs recently';
        if (value === 'low') return 'a primary team that scored few runs recently';
      }
      if (feature === 'opponent_team_last_runs') {
        if (value === 'high') return 'an opponent that scored a lot of runs recently';
        if (value === 'medium') return 'an opponent that scored a moderate number of runs recently';
        if (value === 'low') return 'an opponent that scored few runs recently';
      }
      // Default fallback
      return `${feature.replace(/_/g, ' ')}: ${value}`;
    });
    if (phrases.length === 0) return '';
    if (phrases.length === 1) return `This pattern looks for ${phrases[0]}.`;
    if (phrases.length === 2) return `This pattern looks for ${phrases[0]} and ${phrases[1]}.`;
    return `This pattern looks for ${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}.`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          {/* Animated Analytics Graphic */}
          <div className="mb-6 flex flex-col items-center">
            <div className="flex gap-2 mb-2">
              <div className="w-3 h-10 bg-accent animate-bounce rounded-md" style={{ animationDelay: '0s' }}></div>
              <div className="w-3 h-16 bg-primary animate-bounce rounded-md" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-8 bg-accent animate-bounce rounded-md" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-3 h-14 bg-primary animate-bounce rounded-md" style={{ animationDelay: '0.3s' }}></div>
              <div className="w-3 h-12 bg-accent animate-bounce rounded-md" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="text-accent font-bold text-xl mt-2 drop-shadow">Analyzing Trends...</span>
          </div>
        </div>
      )}

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
              <Label>Select Features</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {featureConfig.map((feature, idx) => (
                  <div key={feature.key} className="relative flex items-center w-full max-w-xs min-w-[180px]">
                    <Button
                      variant={selectedFeatures.includes(feature.key) ? 'default' : 'outline'}
                      onClick={() => handleFeatureChange(feature.key)}
                      className={
                        (selectedFeatures.includes(feature.key)
                          ? 'bg-primary/80 text-white font-bold border-primary hover:bg-primary transition-colors text-sm'
                          : 'border-gray-300 text-gray-700 bg-background hover:bg-gray-200 text-sm') +
                        ' w-full min-w-[140px] max-w-xs px-2 py-2 justify-start text-left'
                      }
                    >
                      {feature.displayName}
                    </Button>
                    <button
                      type="button"
                      className="absolute top-1 right-1 z-10 cursor-pointer p-0 w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-md border border-gray-200 hover:bg-blue-100 focus:outline-none"
                      onClick={() => setOpenInfoIndex(openInfoIndex === idx ? null : idx)}
                      aria-label={`Info about ${feature.displayName}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="#fff" />
                        <rect x="11" y="10" width="2" height="6" rx="1" fill="currentColor" />
                        <circle cx="12" cy="7.5" r="1.2" fill="currentColor" />
                      </svg>
                    </button>
                    {openInfoIndex === idx && (
                      <div className="absolute z-50 left-1/2 top-full mt-2 w-64 -translate-x-1/2 bg-white border border-gray-300 rounded shadow-lg p-3 text-sm text-gray-800" style={{ minWidth: '200px' }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold">{feature.displayName}</span>
                          <button className="text-gray-400 hover:text-gray-600" onClick={() => setOpenInfoIndex(null)} aria-label="Close info">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div>{feature.blurb}</div>
                      </div>
                    )}
                  </div>
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

            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="bg-accent text-primary font-bold hover:bg-accent/90 transition-colors"
            >
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
                <CardTitle className="flex items-center gap-2 text-blue-900 font-extrabold">
                  <BarChart3 className="h-5 w-5 text-blue-900" />
                  Model Results Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-blue-900 drop-shadow-sm">{results.trend_matches.length}</p>
                    <p className="text-sm text-gray-600">Trend Patterns</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-blue-900 drop-shadow-sm">{Object.keys(
                      results.today_matches.reduce((acc: any, match) => {
                        acc[match.unique_id] = true;
                        return acc;
                      }, {})
                    ).length}</p>
                    <p className="text-sm text-gray-600">Today's Games</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-blue-900 drop-shadow-sm">{selectedFeatures.length}</p>
                    <p className="text-sm text-gray-600">Features Used</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-blue-900 drop-shadow-sm uppercase">{results.target}</p>
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
                          <th className="text-left p-2">#</th>
                          <th className="text-left p-2">{targetLabels.primaryShort}</th>
                          <th className="text-left p-2">{targetLabels.opponentShort}</th>
                          <th className="text-left p-2">Games</th>
                          <th className="text-left p-2">Features</th>
                          <th className="text-left p-2">Explain</th>
                          <th className="text-left p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.trend_matches.map((match, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-bold text-blue-900">{index + 1}</td>
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
                              <Button variant="outline" size="sm" onClick={() => setExplainPatternIndex(index)}>
                                Explain
                              </Button>
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
                              <Link to={`/game-analysis/${uniqueId}?target=${encodeURIComponent(results.target)}&models=${encodeURIComponent(JSON.stringify(matches))}`}>
                                <Button variant="outline" size="sm">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Analyze
                                </Button>
                              </Link>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            {matches.map((match: any, idx: number) => {
                              // Find the index of the matching trend pattern
                              const patternIndex = results.trend_matches.findIndex(
                                (tm) =>
                                  tm.combo === match.combo &&
                                  tm.win_pct === match.win_pct &&
                                  tm.opponent_win_pct === match.opponent_win_pct &&
                                  tm.games === match.games &&
                                  tm.feature_count === match.feature_count
                              );
                              // Calculate highest win percentage
                              const highestWinPct = Math.max(match.win_pct, match.opponent_win_pct);
                              return (
                                <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                                  <span className="font-semibold text-blue-900">
                                    {patternIndex !== -1 ? `Trend Pattern #${patternIndex + 1}` : 'Pattern'}
                                  </span>
                                  <div className="flex gap-4 text-gray-600 items-center">
                                    <span className="font-bold text-green-700">{(highestWinPct * 100).toFixed(1)}% <span className="font-normal text-gray-600">Win %</span></span>
                                    <span>{match.feature_count} features</span>
                                    <span>{match.games} games</span>
                                  </div>
                                </div>
                              );
                            })}
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

      {/* Pattern Explanation Modal */}
      <Dialog open={explainPatternIndex !== null} onOpenChange={() => setExplainPatternIndex(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pattern Explanation</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {explainPatternIndex !== null && (
              <div className="text-base text-gray-800">
                {describePattern(
                  results.trend_matches[explainPatternIndex].features,
                  results.trend_matches[explainPatternIndex].combo
                )}
              </div>
            )}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomModels;
