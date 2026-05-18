import React, { useMemo } from 'react';
import { useTodaysMlbGames } from '@/hooks/useTodaysMlbGames';
import { useF5Splits } from '@/hooks/useF5Splits';
import { F5SplitsGameCard } from '@/components/mlb/F5SplitsGameCard';
import type { TodaysMlbGameForF5 } from '@/types/mlbF5Splits';
import { formatGameDateLabel } from '@/utils/mlbF5Splits';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle, Info, RefreshCw } from 'lucide-react';
function GameCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </CardContent>
    </Card>
  );
}

export default function F5Splits() {
  const {
    data: games = [],
    isLoading: gamesLoading,
    isError: gamesError,
    error: gamesErr,
    refetch: refetchGames,
  } = useTodaysMlbGames();

  const teamAbbrs = useMemo(
    () => games.flatMap(g => [g.away_abbr, g.home_abbr]),
    [games],
  );

  const gamesByDate = useMemo(() => {
    const map = new Map<string, TodaysMlbGameForF5[]>();
    for (const game of games) {
      const dateKey = game.official_date || 'unknown';
      const list = map.get(dateKey) ?? [];
      list.push(game);
      map.set(dateKey, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [games]);

  const {
    data: splitsData,
    isLoading: splitsLoading,
    isError: splitsError,
    error: splitsErr,
    refetch: refetchSplits,
  } = useF5Splits(teamAbbrs);

  const isLoading = gamesLoading || (teamAbbrs.length > 0 && splitsLoading);
  const isError = gamesError || splitsError;
  const errorMessage =
    (gamesErr instanceof Error ? gamesErr.message : null) ??
    (splitsErr instanceof Error ? splitsErr.message : null) ??
    'Failed to load first-five splits';

  const lastRefreshed = splitsData?.lastRefreshedAt
    ? new Date(splitsData.lastRefreshedAt).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }) + ' ET'
    : null;

  const handleRetry = () => {
    refetchGames();
    refetchSplits();
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl space-y-5 sm:space-y-6 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-3xl font-bold text-foreground leading-tight">
                ⚾ First-Five Splits
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex text-muted-foreground hover:text-foreground"
                    aria-label="How splits are calculated"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Offense splits are based on the opposing starter&apos;s throwing hand. Defense splits
                  are based on this team&apos;s own starter&apos;s throwing hand.
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base">
              How scheduled teams perform in the first five innings
            </p>
            {lastRefreshed ? (
              <p className="text-xs text-muted-foreground">Last refreshed: {lastRefreshed}</p>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isLoading}
            className="w-full sm:w-auto shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span>{errorMessage}</span>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="space-y-4">
            <GameCardSkeleton />
            <GameCardSkeleton />
          </div>
        ) : games.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No MLB games scheduled
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {gamesByDate.map(([dateKey, dateGames]) => (
              <section key={dateKey} className="space-y-4">
                <h2 className="text-base sm:text-lg font-bold text-foreground border-b border-border pb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span>📅 {formatGameDateLabel(dateKey)}</span>
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                    {dateGames.length} {dateGames.length === 1 ? 'game' : 'games'}
                  </span>
                </h2>
                <div className="space-y-4 sm:space-y-6">
                  {dateGames.map(game => (
                    <F5SplitsGameCard
                      key={game.game_pk}
                      game={game}
                      splitLookup={splitsData?.lookup ?? new Map()}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
