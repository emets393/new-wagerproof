import React from 'react';
import { Badge } from '@/components/ui/badge';
import TeamPredictionCard from './TeamPredictionCard';
import TotalPredictionCard from './TotalPredictionCard';

interface PredictionData {
  moneyline_prediction?: string;
  ml_probability?: number;
  runline_prediction?: string;
  run_line_probability?: number;
  ou_prediction?: string;
  ou_probability?: number;
  home_team?: string;
  away_team?: string;
  o_u_line?: number;
}

interface PatternMatchProps {
  match: {
    pattern_id: string;
    pattern_name: string;
    unique_id: string;
    primary_team: string;
    opponent_team: string;
    is_home_game: boolean;
    win_pct: number;
    target: string;
    predictions?: PredictionData;
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

  const predictions = match.predictions;

  return (
    <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
      {/* Match Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">
            {match.primary_team} {match.is_home_game ? 'vs' : '@'} {match.opponent_team}
          </p>
          <p className="text-sm text-muted-foreground">
            Win Rate: {(match.win_pct * 100).toFixed(1)}%
          </p>
        </div>
        <Badge className={getTargetBadgeColor(target)}>
          {target}
        </Badge>
      </div>

      {/* Prediction Cards */}
      {predictions && (
        <div className="grid gap-3">
          {/* Moneyline Prediction */}
          {predictions.moneyline_prediction && predictions.ml_probability && (
            <TeamPredictionCard
              title="Moneyline Prediction"
              predictedTeam={predictions.moneyline_prediction}
              confidence={predictions.ml_probability * 100}
              homeTeam={predictions.home_team || match.primary_team}
              awayTeam={predictions.away_team || match.opponent_team}
            />
          )}

          {/* Runline Prediction */}
          {predictions.runline_prediction && predictions.run_line_probability && (
            <TeamPredictionCard
              title="Run Line Prediction"
              predictedTeam={predictions.runline_prediction}
              confidence={predictions.run_line_probability * 100}
              homeTeam={predictions.home_team || match.primary_team}
              awayTeam={predictions.away_team || match.opponent_team}
            />
          )}

          {/* Over/Under Prediction */}
          {predictions.ou_prediction && predictions.ou_probability && predictions.o_u_line && (
            <TotalPredictionCard
              prediction={predictions.ou_prediction}
              total={predictions.o_u_line}
              confidence={predictions.ou_probability * 100}
            />
          )}
        </div>
      )}

      {/* No Predictions Available */}
      {!predictions && (
        <p className="text-sm text-muted-foreground italic">
          No prediction data available for this game
        </p>
      )}
    </div>
  );
};

export default PatternMatchCard;