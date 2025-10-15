import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import { mockNFLGames } from '@/data/learnMockData';

export function NFLGameCardMockup() {
  const game = mockNFLGames[0];

  const formatMoneyline = (ml: number) => (ml > 0 ? `+${ml}` : `${ml}`);
  const formatSpread = (spread: number | null) => {
    if (!spread) return '-';
    return spread > 0 ? `+${spread}` : `${spread}`;
  };

  const formatDate = () => 'Sun, Oct 19';
  const formatTime = () => '8:20 PM EST';

  return (
    <div className="relative max-w-md mx-auto opacity-95">
      <Card className="relative overflow-hidden bg-gradient-to-br from-gray-100/90 via-gray-200/90 to-gray-100/90 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-2 border-red-200 dark:border-red-800 shadow-xl">
        <CardContent className="space-y-6 pt-6 pb-6">
          {/* Game Date and Time */}
          <div className="text-center space-y-2">
            <div className="text-base font-bold text-gray-900 dark:text-gray-100">
              {formatDate()}
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 inline-block">
              {formatTime()}
            </div>
          </div>

          {/* Team Logos and Betting Info */}
          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-start">
              {/* Away Team */}
              <div className="text-center flex-1">
                <div className="h-16 w-16 mx-auto mb-3 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-600 dark:text-gray-300">KC</span>
                </div>
                <div className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                  {game.away_team}
                </div>
                <div className="text-sm text-muted-foreground">
                  Spread: {formatSpread(game.away_spread)}
                </div>
                <div className="text-lg font-bold text-blue-600">
                  {formatMoneyline(game.away_ml)}
                </div>
              </div>

              {/* @ Symbol and Total */}
              <div className="text-center px-4 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold text-gray-400 dark:text-gray-500 mb-3">@</span>
                <div className="text-sm font-bold text-blue-900 dark:text-blue-100 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                  Total: {game.over_line}
                </div>
              </div>

              {/* Home Team */}
              <div className="text-center flex-1">
                <div className="h-16 w-16 mx-auto mb-3 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-600 dark:text-gray-300">BUF</span>
                </div>
                <div className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                  {game.home_team}
                </div>
                <div className="text-sm text-muted-foreground">
                  Spread: {formatSpread(game.home_spread)}
                </div>
                <div className="text-lg font-bold text-green-600">
                  {formatMoneyline(game.home_ml)}
                </div>
              </div>
            </div>
          </div>

          {/* Model Predictions Section */}
          <div className="text-center pt-6 border-t-2 border-gray-200 dark:border-gray-700">
            <div className="bg-gradient-to-br from-gray-50 to-slate-50/30 dark:from-gray-800/50 dark:to-slate-800/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
              <h4 className="text-lg font-bold text-gray-400 dark:text-gray-500">Model Predictions</h4>
              
              {/* Spread */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Spread</h5>
                <div className="grid grid-cols-2 items-stretch gap-6">
                  <BackgroundGradient 
                    className="h-36 rounded-3xl bg-white dark:bg-gray-900 flex flex-col items-center justify-center"
                    colors={['#E31837', '#E31837']}
                  >
                    <div className="h-20 w-20 flex items-center justify-center mb-2">
                      <span className="text-3xl font-bold text-gray-600 dark:text-gray-300">KC</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-center leading-snug">
                      Kansas City ({formatSpread(game.away_spread)})
                    </span>
                  </BackgroundGradient>
                  
                  <BackgroundGradient 
                    className="h-36 rounded-3xl bg-white dark:bg-gray-900 flex flex-col items-center justify-center text-center"
                    colors={['#059669', '#10b981']}
                  >
                    <div className="text-4xl font-extrabold leading-tight text-emerald-600">54%</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 font-medium mt-1">Confidence</div>
                  </BackgroundGradient>
                </div>
              </div>

              {/* Over/Under */}
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Over / Under</h5>
                <div className="grid grid-cols-2 items-stretch gap-6">
                  <BackgroundGradient 
                    className="h-36 rounded-3xl bg-white dark:bg-gray-900 flex flex-col items-center justify-center"
                    colors={['#059669', '#10b981']}
                  >
                    <div className="text-6xl font-black text-emerald-600">▲</div>
                    <div className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100 text-center">
                      Over {game.over_line}
                    </div>
                  </BackgroundGradient>
                  
                  <BackgroundGradient 
                    className="h-36 rounded-3xl bg-white dark:bg-gray-900 flex flex-col items-center justify-center text-center"
                    colors={['#059669', '#10b981']}
                  >
                    <div className="text-4xl font-extrabold leading-tight text-emerald-600">62%</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 font-medium mt-1">Confidence</div>
                  </BackgroundGradient>
                </div>
              </div>
            </div>
          </div>

          {/* Public Betting Facts */}
          <div className="text-center pt-6 border-t-2 border-gray-200 dark:border-gray-700">
            <div className="bg-gradient-to-br from-gray-50 to-slate-50/30 dark:from-gray-800/50 dark:to-slate-800/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
              <h4 className="text-lg font-bold text-gray-400 dark:text-gray-500">Public Betting Facts</h4>
              
              <div className="space-y-2">
                <Badge variant="outline" className="w-full justify-center text-xs font-medium bg-white dark:bg-gray-800">
                  ML: {game.ml_splits_label}
                </Badge>
                <Badge variant="outline" className="w-full justify-center text-xs font-medium bg-white dark:bg-gray-800">
                  Spread: {game.spread_splits_label}
                </Badge>
                <Badge variant="outline" className="w-full justify-center text-xs font-medium bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600">
                  Total: {game.total_splits_label}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

