
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import TeamDisplay from '@/components/TeamDisplay';

interface PatternMatchProps {
  match: {
    pattern_id: string;
    pattern_name: string;
    unique_id: string;
    primary_team: string;
    opponent_team: string;
    is_home_game: boolean;
    win_pct: number;
    opponent_win_pct: number;
    target: string;
    dominant_side?: string;
    // Betting line data
    o_u_line?: number;
    home_ml?: number;
    away_ml?: number;
    home_rl?: number;
    away_rl?: number;
    game_info?: {
      is_home_team: boolean;
      primary_team: string;
      opponent_team: string;
    };
  };
  target: string;
  onViewMatchingGames?: () => void;
}

const PatternMatchCard: React.FC<PatternMatchProps> = ({ match, target, onViewMatchingGames }) => {
  const getTargetBadgeColor = (target: string) => {
    switch (target) {
      case 'moneyline': return 'bg-blue-100 text-blue-800';
      case 'runline': return 'bg-green-100 text-green-800';
      case 'over_under': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get the predicted team or outcome based on win percentages
  const getPrediction = () => {
    if (target === 'over_under') {
      return match.win_pct > match.opponent_win_pct ? 'Over' : 'Under';
    } else {
      // For moneyline and runline, use dominant_side logic for consistent predictions
      // This ensures the same prediction logic as the Custom Models page
      const dominantSide = match.dominant_side || (match.win_pct > match.opponent_win_pct ? 'primary' : 'opponent');
      return dominantSide === 'primary' ? match.primary_team : match.opponent_team;
    }
  };

  // Get betting line for the prediction
  const getBettingLine = () => {
    if (target === 'over_under') {
      return match.o_u_line ? ` ${match.o_u_line}` : '';
    } else if (target === 'moneyline') {
      const predictedTeam = getPrediction();
      // Determine if predicted team is actually the home team
      const homeTeam = match.is_home_game ? match.primary_team : match.opponent_team;
      const isPredictedTeamHome = predictedTeam === homeTeam;
      const line = isPredictedTeamHome ? match.home_ml : match.away_ml;
      return line ? ` (${line > 0 ? '+' : ''}${line})` : '';
    } else if (target === 'runline') {
      const predictedTeam = getPrediction();
      // Determine if predicted team is actually the home team
      const homeTeam = match.is_home_game ? match.primary_team : match.opponent_team;
      const isPredictedTeamHome = predictedTeam === homeTeam;
      const line = isPredictedTeamHome ? match.home_rl : match.away_rl;
      return line ? ` (${line > 0 ? '+' : ''}${line})` : '';
    }
    return '';
  };

  const getConfidence = () => {
    return Math.max(match.win_pct, match.opponent_win_pct) * 100;
  };

  const prediction = getPrediction();
  const confidence = getConfidence();

  return (
    <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
      {/* Match Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">
            {match.primary_team} {match.is_home_game ? 'vs' : '@'} {match.opponent_team}
          </p>
        </div>
      </div>

      {/* Pattern Prediction */}
      <div className="bg-primary/10 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">This pattern predicts:</p>
            <div className="flex items-center gap-2">
              {target !== 'over_under' && (
                <>
                  <div className="flex items-center gap-2">
                    <TeamDisplay 
                      team={prediction} 
                      isHome={prediction === match.primary_team ? match.is_home_game : !match.is_home_game}
                      showName={false}
                    />
                    <span className="font-semibold text-lg text-foreground">{prediction}</span>
                  </div>
                </>
              )}
              {target === 'over_under' && (
                <span className="font-semibold text-lg text-foreground">{prediction}</span>
              )}
              <span className="font-semibold text-lg text-foreground">{getBettingLine()}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Confidence: {confidence.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* View Matching Games Button */}
      {onViewMatchingGames && (
        <Button 
          onClick={onViewMatchingGames}
          className="w-full font-semibold text-base bg-primary text-white hover:bg-primary/90 transition-colors"
          variant="default"
        >
          View Matching Games
        </Button>
      )}
    </div>
  );
};

export default PatternMatchCard;
