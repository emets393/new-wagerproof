
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, Users, Target, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ConfidenceChart from '@/components/ConfidenceChart';

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
    o_u_line?: number;
    home_ml?: number;
    away_ml?: number;
    home_rl?: number;
    away_rl?: number;
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
      const modelsParam = searchParams.get('models');
      
      if (!target) {
        console.error('Missing target parameter');
        setAnalysisData(null);
        setIsLoading(false);
        return;
      }

      let models = null;
      if (modelsParam) {
        try {
          models = JSON.parse(decodeURIComponent(modelsParam));
        } catch (e) {
          console.error('Failed to parse models parameter:', e);
        }
      }

      console.log('Calling get-game-analysis-data with:', { unique_id: gameId, target, models });
      
      const { data, error } = await supabase.functions.invoke('get-game-analysis-data', {
        body: {
          unique_id: gameId,
          target: target,
          models: models
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

  const getTeamLogo = (teamName: string) => {
    const espnLogoMap: { [key: string]: string } = {
      'Arizona': 'https://a.espncdn.com/i/teamlogos/mlb/500/ari.png',
      'Atlanta': 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png',
      'Baltimore': 'https://a.espncdn.com/i/teamlogos/mlb/500/bal.png',
      'Boston': 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png',
      'Cubs': 'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png',
      'White Sox': 'https://a.espncdn.com/i/teamlogos/mlb/500/cws.png',
      'Cincinnati': 'https://a.espncdn.com/i/teamlogos/mlb/500/cin.png',
      'Cleveland': 'https://a.espncdn.com/i/teamlogos/mlb/500/cle.png',
      'Colorado': 'https://a.espncdn.com/i/teamlogos/mlb/500/col.png',
      'Detroit': 'https://a.espncdn.com/i/teamlogos/mlb/500/det.png',
      'Houston': 'https://a.espncdn.com/i/teamlogos/mlb/500/hou.png',
      'Kansas City': 'https://a.espncdn.com/i/teamlogos/mlb/500/kc.png',
      'Angels': 'https://a.espncdn.com/i/teamlogos/mlb/500/laa.png',
      'Dodgers': 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png',
      'Miami': 'https://a.espncdn.com/i/teamlogos/mlb/500/mia.png',
      'Milwaukee': 'https://a.espncdn.com/i/teamlogos/mlb/500/mil.png',
      'Minnesota': 'https://a.espncdn.com/i/teamlogos/mlb/500/min.png',
      'Mets': 'https://a.espncdn.com/i/teamlogos/mlb/500/nym.png',
      'Yankees': 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png',
      'Athletics': 'https://a.espncdn.com/i/teamlogos/mlb/500/oak.png',
      'Philadelphia': 'https://a.espncdn.com/i/teamlogos/mlb/500/phi.png',
      'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/mlb/500/pit.png',
      'San Diego': 'https://a.espncdn.com/i/teamlogos/mlb/500/sd.png',
      'San Francisco': 'https://a.espncdn.com/i/teamlogos/mlb/500/sf.png',
      'Seattle': 'https://a.espncdn.com/i/teamlogos/mlb/500/sea.png',
      'ST Louis': 'https://a.espncdn.com/i/teamlogos/mlb/500/stl.png',
      'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png',
      'Texas': 'https://a.espncdn.com/i/teamlogos/mlb/500/tex.png',
      'Toronto': 'https://a.espncdn.com/i/teamlogos/mlb/500/tor.png',
      'Washington': 'https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png',
    };
    return espnLogoMap[teamName];
  };

  // Helper to get betting line for prediction
  const getBettingLine = () => {
    if (!analysisData || !analysisData.consensus.team_winner_prediction) return '';
    
    const { target } = analysisData;
    const { team_winner_prediction } = analysisData.consensus;
    const { home_ml, away_ml, home_rl, away_rl } = analysisData.game_info;
    
    if (target === 'moneyline') {
      const isHomeTeamWinner = team_winner_prediction === analysisData.game_info.primary_team;
      const line = isHomeTeamWinner ? home_ml : away_ml;
      return line ? ` (${line > 0 ? '+' : ''}${line})` : '';
    }
    
    if (target === 'runline') {
      const isHomeTeamWinner = team_winner_prediction === analysisData.game_info.primary_team;
      const line = isHomeTeamWinner ? home_rl : away_rl;
      return line ? ` (${line > 0 ? '+' : ''}${line})` : '';
    }
    
    return '';
  };

  // Helper to get over/under prediction with line
  const getOverUnderPrediction = () => {
    if (!analysisData) return { label: '', display: '' };
    const isOver = analysisData.consensus.primary_percentage > analysisData.consensus.opponent_percentage;
    const ouLine = analysisData.game_info.o_u_line;
    const label = isOver ? 'Over' : 'Under';
    const display = ouLine ? `${label} (${ouLine})` : label;
    return { label, display };
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{analysisData.matches.length}</p>
              <p className="text-sm text-gray-600">Contributing Models</p>
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

      {/* Prediction */}
      {analysisData.consensus.team_winner_prediction && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {analysisData.target === 'over_under' ? 'Prediction' : 'Prediction Winner'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {analysisData.target === 'over_under' ? (
                  <div className="text-center">
                    {analysisData.consensus.primary_percentage > analysisData.consensus.opponent_percentage ? (
                      <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                      </svg>
                    ) : (
                      <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0l-7-7m7 7l7-7" />
                      </svg>
                    )}
                  </div>
                ) : (
                  getTeamLogo(analysisData.consensus.team_winner_prediction) ? (
                    <img 
                      src={getTeamLogo(analysisData.consensus.team_winner_prediction)} 
                      alt={`${analysisData.consensus.team_winner_prediction} logo`} 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-lg font-bold text-muted-foreground">
                      {analysisData.consensus.team_winner_prediction.slice(0, 3).toUpperCase()}
                    </span>
                  )
                )}
              </div>
              <div className="text-center">
                <p className={`text-4xl font-bold mb-2 ${
                  analysisData.target === 'over_under'
                    ? (analysisData.consensus.primary_percentage > analysisData.consensus.opponent_percentage ? 'text-green-600' : 'text-red-600')
                    : 'text-green-600'
                }`}>
                  {analysisData.target === 'over_under'
                    ? getOverUnderPrediction().display
                    : `${analysisData.consensus.team_winner_prediction}${getBettingLine()}`}
                </p>
                <p className="text-lg text-gray-600">
                  {analysisData.target === 'over_under' ? 'Consensus Prediction' : 'Consensus Winner'} ({Math.round(Math.max(analysisData.consensus.primary_percentage, analysisData.consensus.opponent_percentage) * 100)}% confidence)
                </p>
              </div>
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
            <div className="flex flex-col items-center space-y-3">
              <div className="flex justify-between items-center w-full">
                <h3 className="font-medium">{analysisData.game_info.primary_team}</h3>
                <Badge variant="secondary">{analysisData.consensus.models} models</Badge>
              </div>
              <ConfidenceChart 
                confidence={analysisData.consensus.primary_percentage * 100}
                teamColors={['#10b981', '#e5e7eb']}
              />
              <p className="text-sm text-gray-600">Weighted Win Probability</p>
            </div>
            
            <div className="flex flex-col items-center space-y-3">
              <div className="flex justify-between items-center w-full">
                <h3 className="font-medium">{analysisData.game_info.opponent_team}</h3>
                <Badge variant="secondary">{analysisData.consensus.models} models</Badge>
              </div>
              <ConfidenceChart 
                confidence={analysisData.consensus.opponent_percentage * 100}
                teamColors={['#10b981', '#e5e7eb']}
              />
              <p className="text-sm text-gray-600">Weighted Win Probability</p>
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
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className={`font-semibold text-lg ${match.win_pct > match.opponent_win_pct ? 'text-green-600' : 'text-red-600'}`}>
                          {(match.win_pct * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-600">{analysisData.game_info.primary_team} Win %</p>
                      </div>
                      <div>
                        <p className={`font-semibold text-lg ${match.opponent_win_pct > match.win_pct ? 'text-green-600' : 'text-red-600'}`}>
                          {(match.opponent_win_pct * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-600">{analysisData.game_info.opponent_team} Win %</p>
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
