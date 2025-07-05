
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, TrendingUp, Users, Target, Trophy } from 'lucide-react';
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
  model_name?: string;
  confidence?: number;
}

interface GameAnalysisData {
  game_info: {
    unique_id: string;
    primary_team: string;
    opponent_team: string;
    is_home_team: boolean;
  };
  matches: GameMatch[];
  target: string;
  consensus: {
    primary_percentage: number;
    opponent_percentage: number;
    confidence: number;
    models: number;
    team_winner_prediction?: string;
  };
}

const GameAnalysis: React.FC = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [analysisData, setAnalysisData] = useState<GameAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (gameId) {
      loadGameAnalysisData();
    }
  }, [gameId, searchParams]);

  const loadGameAnalysisData = async () => {
    setIsLoading(true);
    console.log('Loading game analysis data for:', gameId);
    
    try {
      const target = searchParams.get('target');
      
      if (!target) {
        console.error('Missing target parameter');
        setAnalysisData(null);
        setIsLoading(false);
        return;
      }

      console.log('Calling get-game-analysis-data with:', { unique_id: gameId, target });
      
      const { data, error } = await supabase.functions.invoke('get-game-analysis-data', {
        body: {
          unique_id: gameId,
          target: target
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        setAnalysisData(null);
        setIsLoading(false);
        return;
      }

      console.log('Received analysis data:', data);
      setAnalysisData(data);

    } catch (error) {
      console.error('Error loading game analysis data:', error);
      setAnalysisData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getTargetDisplayNames = (target: string) => {
    switch (target) {
      case 'moneyline':
        return { primary: 'Win', opponent: 'Lose' };
      case 'runline':
        return { primary: 'Cover', opponent: 'Don\'t Cover' };
      case 'over_under':
        return { primary: 'Over', opponent: 'Under' };
      default:
        return { primary: 'Primary', opponent: 'Opponent' };
    }
  };

  const getBadgeColor = (target: string) => {
    switch (target) {
      case 'moneyline':
        return 'bg-blue-100 text-blue-800';
      case 'runline':
        return 'bg-green-100 text-green-800';
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
            <p className="text-sm text-gray-500 mt-2">
              Game ID: {gameId} | Target: {searchParams.get('target')}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              The analysis function may be temporarily unavailable. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const targetLabels = getTargetDisplayNames(analysisData.target);

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
          <Badge className={getBadgeColor(analysisData.target)}>
            Target: {analysisData.target}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{analysisData.matches.length}</p>
              <p className="text-sm text-gray-600">Contributing Models</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {Math.round(analysisData.consensus.primary_percentage * 100)}%
              </p>
              <p className="text-sm text-gray-600">{targetLabels.primary} Rate</p>
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

      {/* Team Winner Prediction */}
      {analysisData.consensus.team_winner_prediction && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Prediction Winner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-4xl font-bold text-green-600 mb-2">
                {analysisData.consensus.team_winner_prediction}
              </p>
              <p className="text-lg text-gray-600">
                Consensus Winner ({Math.round(Math.max(analysisData.consensus.primary_percentage, analysisData.consensus.opponent_percentage) * 100)}% confidence)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prediction Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weighted Consensus Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">{analysisData.game_info.primary_team} ({targetLabels.primary})</h3>
                <Badge variant="secondary">{analysisData.consensus.models} models</Badge>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Weighted Probability</span>
                  <span>{(analysisData.consensus.primary_percentage * 100).toFixed(1)}%</span>
                </div>
                <Progress value={analysisData.consensus.primary_percentage * 100} className="h-2" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">{analysisData.game_info.opponent_team} ({targetLabels.opponent})</h3>
                <Badge variant="secondary">{analysisData.consensus.models} models</Badge>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Weighted Probability</span>
                  <span>{(analysisData.consensus.opponent_percentage * 100).toFixed(1)}%</span>
                </div>
                <Progress value={analysisData.consensus.opponent_percentage * 100} className="h-2" />
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Model Agreement:</strong> {analysisData.consensus.confidence}% 
              (based on consistency across {analysisData.consensus.models} model{analysisData.consensus.models > 1 ? 's' : ''})
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Individual Models */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contributing Model Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analysisData.matches.map((match, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className={getBadgeColor(analysisData.target)}>
                      {match.model_name || `Model #${index + 1}`}
                    </Badge>
                    <p className="text-sm text-gray-600 mt-1">
                      {match.feature_count} features • {match.games} games
                      {match.confidence && ` • ${Math.round(match.confidence * 100)}% tier accuracy`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-semibold text-lg text-green-600">
                          {(match.win_pct * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-600">{targetLabels.primary}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-lg text-red-600">
                          {(match.opponent_win_pct * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-600">{targetLabels.opponent}</p>
                      </div>
                    </div>
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
