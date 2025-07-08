import React from 'react';
import { Badge } from '@/components/ui/badge';

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
  };
  target: string;
}

const PatternMatchCard: React.FC<PatternMatchProps> = ({ match, target }) => {
  const getTargetBadgeColor = (target: string) => {
    switch (target) {
      case 'moneyline': return 'bg-blue-100 text-blue-800';
      case 'runline': return 'bg-green-100 text-green-800';
      case 'over_under': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate individual pattern prediction
  const getPrediction = () => {
    if (target === 'over_under') {
      return match.win_pct > match.opponent_win_pct ? 'Over' : 'Under';
    } else {
      return match.win_pct > match.opponent_win_pct ? match.primary_team : match.opponent_team;
    }
  };

  const getConfidence = () => {
    if (target === 'over_under') {
      return Math.max(match.win_pct, match.opponent_win_pct) * 100;
    } else {
      return Math.max(match.win_pct, match.opponent_win_pct) * 100;
    }
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
        <Badge className={getTargetBadgeColor(target)}>
          {target}
        </Badge>
      </div>

      {/* Pattern Prediction */}
      <div className="bg-primary/10 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">This pattern predicts:</p>
            <p className="font-semibold text-lg text-foreground">
              {target === 'over_under' ? prediction : prediction}
              {target === 'over_under' && ' 8.5'} {/* TODO: Get actual O/U line */}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Confidence</p>
            <p className="font-semibold text-primary">
              {confidence.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatternMatchCard;