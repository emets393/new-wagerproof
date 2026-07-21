import * as React from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggeredItem } from '@/components/ios';
import { FreemiumUpgradeBanner } from '@/components/FreemiumUpgradeBanner';
import { SportPicker } from './SportPicker';
import { GameListCard } from './GameListCard';
import { GameListSkeleton } from './GameListSkeleton';
import { GamesEmptyState, GamesErrorState } from './GamesEmptyState';
import { sortGames, groupGamesByDate } from '../api/shared';
import type { GameFeedItem, GamesSortKey, GamesSport } from '../types';

// Per-sport feed scroll positions survive sport switches and remounts.
const scrollPositions = new Map<GamesSport, number>();

interface GamesFeedPanelProps {
  sport: GamesSport;
  onSportChange: (sport: GamesSport) => void;
  games: GameFeedItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onRefresh: () => void;
  selectedGameId: string | null;
  onSelectGame: (id: string) => void;
  isFreemiumUser: boolean;
  isAdmin: boolean;
  onLockedClick: () => void;
}

/**
 * Left split-view panel: floating glass sport picker + search + date-grouped
 * iOS game cards. Owns its scroll (SplitViewLayout provides the container).
 */
export function GamesFeedPanel({
  sport,
  onSportChange,
  games,
  isLoading,
  error,
  onRetry,
  onRefresh,
  selectedGameId,
  onSelectGame,
  isFreemiumUser,
  isAdmin,
  onLockedClick,
}: GamesFeedPanelProps) {
  const [searchText, setSearchText] = React.useState('');
  const [sortKey, setSortKey] = React.useState<GamesSortKey>('time');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Reset transient list state when the sport changes.
  React.useEffect(() => {
    setSearchText('');
    setSortKey('time');
  }, [sport]);

  // Restore per-sport scroll position once content is available.
  React.useLayoutEffect(() => {
    if (!isLoading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollPositions.get(sport) ?? 0;
    }
  }, [sport, isLoading]);

  const sorted = React.useMemo(
    () => sortGames(games, sortKey, false, searchText),
    [games, sortKey, searchText]
  );
  const groups = React.useMemo(() => groupGamesByDate(sorted), [sorted]);

  let cardIndex = -1;

  return (
    <div className="relative h-full">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto"
        onScroll={(e) => scrollPositions.set(sport, e.currentTarget.scrollTop)}
      >
      {/* Floating glass header — content refracts under it as you scroll */}
      <div className="sticky top-0 z-20 space-y-2 px-3 pb-2 pt-3 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_calc(100%_-_8px),transparent)]">
        <SportPicker
          sport={sport}
          onSportChange={onSportChange}
          sortKey={sortKey}
          onSortChange={setSortKey}
          isFreemiumUser={isFreemiumUser}
        />
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search teams"
              className="h-9 w-full rounded-full border border-black/5 bg-white/60 pl-8 pr-8 text-[13px] font-medium text-foreground outline-none backdrop-blur-xl placeholder:text-muted-foreground focus:border-primary/40 dark:border-white/10 dark:bg-white/[0.06]"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh games"
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-muted-foreground backdrop-blur-xl hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]',
              isLoading && 'pointer-events-none opacity-60'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="space-y-2 px-3 pb-10 pt-1">
        {isLoading ? (
          <GameListSkeleton />
        ) : error ? (
          <GamesErrorState message={error} onRetry={onRetry} />
        ) : sorted.length === 0 ? (
          <GamesEmptyState
            sport={sport}
            hasSearch={!!searchText.trim()}
            onClearSearch={() => setSearchText('')}
          />
        ) : (
          groups.map((group) => (
            <React.Fragment key={group.date || 'unknown'}>
              <div className="px-2 pt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {group.label}
              </div>
              {group.games.map((item) => {
                cardIndex += 1;
                // Freemium: first 2 games in the sorted list are free, rest locked.
                const isLocked = isFreemiumUser && cardIndex >= 2;
                return (
                  <StaggeredItem key={item.id} index={cardIndex}>
                    <GameListCard
                      item={item}
                      isSelected={item.id === selectedGameId}
                      isLocked={isLocked}
                      isAdmin={isAdmin}
                      onSelect={onSelectGame}
                      onLockedClick={onLockedClick}
                    />
                  </StaggeredItem>
                );
              })}
            </React.Fragment>
          ))
        )}

        {isFreemiumUser && sorted.length > 2 && (
          <FreemiumUpgradeBanner totalGames={sorted.length} visibleGames={2} />
        )}
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-10 bg-gradient-to-b from-transparent via-background/75 to-background dark:via-black/75 dark:to-black"
      />
    </div>
  );
}
