import React, { useMemo } from 'react';
import { useTodaysMatchupGames } from '@/hooks/useTodaysMatchupGames';
import { GameMatchupCard } from '@/components/mlb/pitcher-matchups/GameMatchupCard';
import { formatGameDateLabel } from '@/utils/mlbPitcherMatchups';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';

function GameCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export default function PitcherMatchups() {
  const { data: games = [], isLoading, isError, error, refetch } = useTodaysMatchupGames();

  const gamesByDate = useMemo(() => {
    const map = new Map<string, typeof games>();
    for (const game of games) {
      const key = game.official_date || 'unknown';
      const list = map.get(key) ?? [];
      list.push(game);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [games]);

  const errorMessage = error instanceof Error ? error.message : 'Failed to load pitcher matchups';

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl space-y-5 sm:space-y-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-foreground leading-tight">
            ⚾ Pitcher Matchups
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Tonight&apos;s starters, arsenals, and opposing lineup splits
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
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
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <GameCardSkeleton />
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
              <h2 className="text-base sm:text-lg font-bold text-foreground border-b border-border pb-2 flex flex-wrap items-baseline gap-x-2">
                <span>📅 {formatGameDateLabel(dateKey)}</span>
                <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                  {dateGames.length} {dateGames.length === 1 ? 'game' : 'games'}
                </span>
              </h2>
              <div className="space-y-4 sm:space-y-6">
                {dateGames.map((game, idx) => (
                  <GameMatchupCard key={game.game_pk} game={game} eagerLoad={idx < 3} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
