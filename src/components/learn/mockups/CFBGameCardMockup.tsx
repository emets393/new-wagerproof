import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockCFBGames } from '@/data/learnMockData';

export function CFBGameCardMockup() {
  const game = mockCFBGames[0];

  const formatMoneyline = (ml: number) => (ml > 0 ? `+${ml}` : `${ml}`);
  const formatSpread = (spread: number) => (spread > 0 ? `+${spread}` : `${spread}`);

  return (
    <div className="relative max-w-md mx-auto opacity-95">
      <Card className="relative overflow-hidden bg-gradient-to-br from-gray-100/90 via-gray-200/90 to-gray-100/90 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 border-2 border-blue-200 dark:border-blue-400 shadow-xl">
        {/* Top color bar */}
        <div 
          className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
          style={{
            background: `linear-gradient(to right, #9E1B32, #BA0C2F)`,
            opacity: 0.9
          }}
        />
        
        <CardContent className="space-y-4 pt-5 pb-5 px-6">
          {/* Game Date and Time */}
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              OCT 18, 2025
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              7:30 PM EST
            </div>
            {/* Weather */}
            <div className="flex justify-center mt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background shadow-sm">
                <span className="text-xs font-medium text-foreground">
                  Temp: 68°F • Wind: 8 mph
                </span>
              </div>
            </div>
          </div>

          {/* Team Logos and Info */}
          <div className="space-y-4 pt-1.5">
            <div className="flex justify-center items-center space-x-6">
              {/* Away Team */}
              <div className="text-center w-[140px]">
                <div className="h-16 w-16 mx-auto mb-3 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-600 dark:text-gray-300">ALA</span>
                </div>
                <div className="text-base font-bold mb-2 text-foreground">
                  {game.away_team}
                </div>
              </div>

              {/* @ Symbol */}
              <div className="text-center">
                <span className="text-5xl font-bold text-gray-400 dark:text-gray-500">@</span>
              </div>

              {/* Home Team */}
              <div className="text-center w-[140px]">
                <div className="h-16 w-16 mx-auto mb-3 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-600 dark:text-gray-300">UGA</span>
                </div>
                <div className="text-base font-bold mb-2 text-foreground">
                  {game.home_team}
                </div>
              </div>
            </div>

            {/* Betting Lines */}
            <div className="flex justify-between items-center">
              <div className="text-center flex-1">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {formatMoneyline(game.away_ml)}
                </div>
                <div className="text-base font-bold text-foreground">
                  {formatSpread(-game.api_spread)}
                </div>
              </div>

              <div className="text-center px-4">
                <div className="text-sm font-bold text-foreground bg-primary/10 dark:bg-primary/20 px-3 py-1 rounded-full border border-primary/30">
                  Total: {game.api_over_line}
                </div>
              </div>

              <div className="text-center flex-1">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatMoneyline(game.home_ml)}
                </div>
                <div className="text-base font-bold text-foreground">
                  {formatSpread(game.api_spread)}
                </div>
              </div>
            </div>
          </div>

          {/* Public Betting Facts */}
          <div className="space-y-3 pt-6 border-t-2 border-border">
            <div className="text-center">
              <h4 className="text-sm font-bold text-foreground bg-gradient-to-r from-primary/10 to-primary/10 px-3 py-1 rounded-full border border-border">
                Public Betting Facts
              </h4>
            </div>
            <div className="space-y-2 bg-gradient-to-br from-primary/10 to-primary/10 p-4 rounded-lg border border-border">
              <Badge variant="outline" className="w-full justify-center text-xs bg-background">
                Spread: {game.spread_splits_label}
              </Badge>
              <Badge variant="outline" className="w-full justify-center text-xs bg-primary/20 border-primary">
                Total: {game.total_splits_label}
              </Badge>
              <Badge variant="outline" className="w-full justify-center text-xs bg-background">
                ML: {game.ml_splits_label}
              </Badge>
            </div>
          </div>

          {/* Model Predictions */}
          <div className="text-center pt-6 border-t-2 border-gray-200 dark:border-gray-700">
            <div className="bg-gradient-to-br from-gray-50 to-slate-50/30 dark:from-gray-800/50 dark:to-slate-800/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-xl font-bold text-gray-400 dark:text-gray-500 mb-4">Model Predictions</h4>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Spread */}
                <div className="bg-slate-50 dark:bg-muted/20 rounded-xl border border-border p-4">
                  <h5 className="text-base font-bold mb-3 pb-2 border-b border-border">Spread</h5>
                  <div className="text-3xl font-bold text-foreground mb-1">2.5</div>
                  <div className="text-xs text-muted-foreground">Edge to UGA</div>
                </div>

                {/* Over/Under */}
                <div className="bg-slate-50 dark:bg-muted/20 rounded-xl border border-border p-4">
                  <h5 className="text-base font-bold mb-3 pb-2 border-b text-emerald-800 dark:text-emerald-400">O/U</h5>
                  <div className="text-3xl font-bold text-emerald-600 mb-1">2.5</div>
                  <div className="text-xs text-emerald-700">Edge to Over</div>
                </div>
              </div>
            </div>
          </div>

          {/* Match Simulator */}
          <div className="text-center pt-6 border-t-2 border-gray-200 dark:border-gray-700">
            <div className="bg-gradient-to-br from-gray-50 to-slate-50/30 dark:from-gray-800/50 dark:to-slate-800/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-xl font-bold text-gray-400 dark:text-gray-500 mb-4">Match Simulator</h4>
              
              <div className="flex justify-between items-center bg-gradient-to-br from-orange-50 to-orange-50 dark:from-orange-950/30 dark:to-orange-950/30 p-4 rounded-lg border border-border">
                <div className="text-center flex-1">
                  <div className="text-2xl font-bold text-foreground">{game.pred_away_score}</div>
                </div>
                <div className="text-center px-4">
                  <div className="text-base font-bold text-muted-foreground">VS</div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-2xl font-bold text-foreground">{game.pred_home_score}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

