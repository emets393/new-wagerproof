
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, TrendingUp, Users, Target } from 'lucide-react';

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
      loadGameAnalysisFromParams();
    }
  }, [gameId, searchParams]);

  const loadGameAnalysisFromParams = () => {
    setIsLoading(true);
    console.log('Loading game analysis from URL params...');
    console.log('Game ID:', gameId);
    console.log('Search params:', searchParams.toString());
    
    try {
      const modelResultsParam = searchParams.get('modelResults');
      const targetParam = searchParams.get('target');
      const primaryTeamParam = searchParams.get('primaryTeam');
      const opponentTeamParam = searchParams.get('opponentTeam');

      console.log('URL Parameters:', {
        modelResults: modelResultsParam ? 'Present' : 'Missing',
        target: targetParam,
        primaryTeam: primaryTeamParam,
        opponentTeam: opponentTeamParam
      });

      if (!modelResultsParam || !targetParam || !primaryTeamParam || !opponentTeamParam) {
        console.error('Missing required URL parameters');
        setAnalysisData(null);
        setIsLoading(false);
        return;
      }

      const matches: GameMatch[] = JSON.parse(decodeURIComponent(modelResultsParam));
      console.log('Parsed matches:', matches.length);
      
      if (matches.length === 0) {
        console.error('No matches found in model results');
        setAnalysisData(null);
        setIsLoading(false);
        return;
      }

      // Calculate consensus
      const avgWinRate = matches.reduce((sum, match) => sum + match.win_pct, 0) / matches.length;
      const avgOpponentWinRate = matches.reduce((sum, match) => sum + match.opponent_win_pct, 0) / matches.length;
      const confidence = Math.abs(avgWinRate - 0.5) * 200; // Convert to 0-100 scale

      const gameInfo = {
        unique_id: gameId!,
        primary_team: decodeURIComponent(primaryTeamParam),
        opponent_team: decodeURIComponent(opponentTeamParam),
        is_home_team: matches[0]?.is_home_team || false
      };

      console.log('Analysis data created successfully');
      setAnalysisData({
        game_info: gameInfo,
        matches,
        target: decodeURIComponent(targetParam),
        consensus: {
          primary_percentage: avgWinRate,
          opponent_percentage: avgOpponentWinRate,
          confidence: Math.round(confidence),
          models: matches.length
        }
      });

    } catch (error) {
      console.error('Error parsing game analysis data:', error);
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
              Make sure to navigate here from the Custom Models page with valid results.
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
              <p className="text-sm text-gray-600">Matching Models</p>
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

      {/* Prediction Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Prediction Summary
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
                  <span>Probability</span>
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
                  <span>Probability</span>
                  <span>{(analysisData.consensus.opponent_percentage * 100).toFixed(1)}%</span>
                </div>
                <Progress value={analysisData.consensus.opponent_percentage * 100} className="h-2" />
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Confidence Level:</strong> {analysisData.consensus.confidence}% 
              (based on deviation from 50/50 odds)
            </p>
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
                    <Badge className={getBadgeColor(analysisData.target)}>
                      Model #{index + 1}
                    </Badge>
                    <p className="text-sm text-gray-600 mt-1">
                      {match.feature_count} features • {match.games} games
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
