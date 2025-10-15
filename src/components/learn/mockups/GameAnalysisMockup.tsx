import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users } from 'lucide-react';
import { mockGameAnalysis } from '@/data/learnMockData';

export function GameAnalysisMockup() {
  const data = mockGameAnalysis;

  return (
    <div className="space-y-6 max-w-4xl mx-auto opacity-95">
      {/* Game Info */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Trophy className="h-6 w-6" />
            {data.game_info.primary_team} vs {data.game_info.opponent_team}
          </CardTitle>
          <Badge className="w-fit bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
            Target: {data.target}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{data.matches.length}</p>
              <p className="text-sm text-muted-foreground">Contributing Models</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                {Math.round(data.matches.reduce((sum, m) => sum + m.games, 0) / data.matches.length)}
              </p>
              <p className="text-sm text-muted-foreground">Avg Sample Size</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prediction Winner */}
      <Card className="bg-slate-50 dark:bg-muted/20 border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Prediction Winner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">KC</span>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600 mb-2">
                {data.consensus.team_winner_prediction}
              </p>
              <p className="text-base text-muted-foreground">
                Consensus Winner ({Math.round(data.consensus.primary_percentage * 100)}% confidence)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weighted Consensus */}
      <Card className="bg-slate-50 dark:bg-muted/20 border-border">
        <CardHeader>
          <CardTitle>Weighted Consensus Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col items-center space-y-3">
              <h3 className="font-medium">{data.game_info.primary_team}</h3>
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-200"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - data.consensus.primary_percentage)}`}
                    className="text-green-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">
                    {Math.round(data.consensus.primary_percentage * 100)}%
                  </span>
                </div>
              </div>
              <Badge variant="secondary">{data.consensus.models} models</Badge>
            </div>

            <div className="flex flex-col items-center space-y-3">
              <h3 className="font-medium">{data.game_info.opponent_team}</h3>
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-200"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - data.consensus.opponent_percentage)}`}
                    className="text-green-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">
                    {Math.round(data.consensus.opponent_percentage * 100)}%
                  </span>
                </div>
              </div>
              <Badge variant="secondary">{data.consensus.models} models</Badge>
            </div>
          </div>

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Model Agreement:</strong> {data.consensus.confidence}%
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Individual Models */}
      <Card className="bg-slate-50 dark:bg-muted/20 border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contributing Model Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.matches.map((match, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3 bg-background">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                      {match.model_name}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {match.feature_count} features • {match.games} games
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-semibold text-lg text-green-600">
                          {(match.win_pct * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {data.game_info.primary_team}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-lg text-red-600">
                          {(match.opponent_win_pct * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {data.game_info.opponent_team}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Features Used:</p>
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
}

