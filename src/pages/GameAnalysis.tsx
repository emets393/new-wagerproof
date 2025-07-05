
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, TrendingUp, Users, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface GameMatch {
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
  target: string;
}

interface GameAnalysisData {
  game_info: {
    unique_id: string;
    primary_team: string;
    opponent_team: string;
    is_home_team: boolean;
  };
  matches: GameMatch[];
  consensus: {
    moneyline: { prediction: string; confidence: number; models: number };
    runline: { prediction: string; confidence: number; models: number };
    over_under: { prediction: string; confidence: number; models: number };
  };
}

const GameAnalysis: React.FC = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<GameAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (gameId) {
      loadGameAnalysis(gameId);
    }
  }, [gameId]);

  const loadGameAnalysis = async (uniqueId: string) => {
    setIsLoading(true);
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      
      // Get all models that match this game today
      const response = await fetch('/functions/v1/run_custom_model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: 'Game Analysis',
          selected_features: ['primary_era', 'opponent_era', 'primary_win_pct', 'opponent_win_pct'], // Basic features for analysis
          target: 'moneyline'
        })
      });

      const result = await response.json();
      
      // Find all matches for this specific game
      const gameMatches = result.today_matches?.filter((match: GameMatch) => 
        match.unique_id === uniqueId
      ) || [];

      if (gameMatches.length === 0) {
        setAnalysisData(null);
        return;
      }

      // Get game info from first match
      const gameInfo = {
        unique_id: gameMatches[0].unique_id,
        primary_team: gameMatches[0].primary_team,
        opponent_team: gameMatches[0].opponent_team,
        is_home_team: gameMatches[0].is_home_team
      };

      // Calculate consensus by target
      const targetGroups = gameMatches.reduce((acc: any, match: GameMatch) => {
        if (!acc[match.target]) {
          acc[match.target] = [];
        }
        acc[match.target].push(match);
        return acc;
      }, {});

      const consensus = {
        moneyline: calculateConsensus(targetGroups['primary_win'] || targetGroups['moneyline'] || []),
        runline: calculateConsensus(targetGroups['primary_runline_win'] || targetGroups['runline'] || []),
        over_under: calculateConsensus(targetGroups['ou_result'] || targetGroups['over_under'] || [])
      };

      setAnalysisData({
        game_info: gameInfo,
        matches: gameMatches,
        consensus
      });

    } catch (error) {
      console.error('Error loading game analysis:', error);
      setAnalysisData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateConsensus = (matches: GameMatch[]) => {
    if (matches.length === 0) {
      return { prediction: 'No models', confidence: 0, models: 0 };
    }

    const avgWinRate = matches.reduce((sum, match) => sum + match.win_pct, 0) / matches.length;
    const prediction = avgWinRate > 0.5 ? 'Favorable' : 'Unfavorable';
    const confidence = Math.abs(avgWinRate - 0.5) * 200; // Convert to 0-100 scale

    return {
      prediction,
      confidence: Math.round(confidence),
      models: matches.length
    };
  };

  const getTargetDisplayName = (target: string) => {
    switch (target) {
      case 'primary_win':
      case 'moneyline':
        return 'Moneyline';
      case 'primary_runline_win':
      case 'runline':
        return 'Run Line';
      case 'ou_result':
      case 'over_under':
        return 'Over/Under';
      default:
        return target;
    }
  };

  const getBadgeColor = (target: string) => {
    switch (target) {
      case 'primary_win':
      case 'moneyline':
        return 'bg-blue-100 text-blue-800';
      case 'primary_runline_win':
      case 'runline':
        return 'bg-green-100 text-green-800';
      case 'ou_result':
      case 'over_under':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading game analysis...</div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="container mx-auto p-6">
        <Button onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-600">No analysis data found for this game.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Game Analysis</h1>
      </div>

      {/* Game Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {analysisData.game_info.primary_team} vs {analysisData.game_info.opponent_team}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{analysisData.matches.length}</p>
              <p className="text-sm text-gray-600">Matching Models</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {Math.round(analysisData.matches.reduce((sum, match) => sum + match.win_pct, 0) / analysisData.matches.length * 100)}%
              </p>
              <p className="text-sm text-gray-600">Avg Win Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {Math.round(analysisData.matches.reduce((sum, match) => sum + match.games, 0) / analysisData.matches.length)}
              </p>
              <p className="text-sm text-gray-600">Avg Sample Size</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consensus */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Prediction Consensus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { key: 'moneyline', label: 'Moneyline', data: analysisData.consensus.moneyline },
              { key: 'runline', label: 'Run Line', data: analysisData.consensus.runline },
              { key: 'over_under', label: 'Over/Under', data: analysisData.consensus.over_under }
            ].map(({ key, label, data }) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">{label}</h3>
                  <Badge variant="secondary">{data.models} models</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{data.prediction}</span>
                    <span>{data.confidence}%</span>
                  </div>
                  <Progress value={data.confidence} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Individual Models */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Individual Model Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analysisData.matches.map((match, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className={getBadgeColor(match.target)}>
                      {getTargetDisplayName(match.target)}
                    </Badge>
                    <p className="text-sm text-gray-600 mt-1">
                      {match.feature_count} features • {match.games} games
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg">
                      {(match.win_pct * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-600">Win Rate</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-2">Features Used:</p>
                  <div className="flex flex-wrap gap-1">
                    {match.features.map((feature, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GameAnalysis;
