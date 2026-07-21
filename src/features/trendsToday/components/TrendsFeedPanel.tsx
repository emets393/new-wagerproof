import * as React from 'react';
import { AlertCircle, RefreshCw, Search, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggeredItem } from '@/components/ios';
import { TrendsSportPicker } from './TrendsSportPicker';
import { TrendsListCard } from './TrendsListCard';
import { TrendsListSkeleton } from './TrendsListSkeleton';
import { groupTrendsByDate, searchTrendsGames } from '../feedUtils';
import {
  TRENDS_SPORT_LABELS,
  type TrendsFeedItem,
  type TrendsSortKey,
  type TrendsSport,
  type TrendsSportFilter,
} from '../types';

interface TrendsFeedPanelProps {
  sport: TrendsSportFilter;
  onSportChange: (sport: TrendsSportFilter) => void;
  /** Already filtered by league and sorted by the page; the panel only searches. */
  games: TrendsFeedItem[];
  isLoading: boolean;
  /** Per-league failures; the rest of the feed still renders. */
  errors: { sport: TrendsSport; message: string }[];
  onRefresh: () => void;
  selectedGameId: string | null;
  onSelectGame: (id: string) => void;
  sortKey: TrendsSortKey;
  onSortChange: (key: TrendsSortKey) => void;
}

/**
 * Left split-view panel: floating glass league picker + search over a feed of
 * today's games across all three leagues. Owns its scroll; SplitViewLayout
 * provides the bounded container.
 */
export function TrendsFeedPanel({
  sport,
  onSportChange,
  games,
  isLoading,
  errors,
  onRefresh,
  selectedGameId,
  onSelectGame,
  sortKey,
  onSortChange,
}: TrendsFeedPanelProps) {
  const [searchText, setSearchText] = React.useState('');

  const visible = React.useMemo(
    () => searchTrendsGames(games, searchText),
    [games, searchText],
  );

  // Date headers only make sense when the list is in chronological order; the
  // value sorts deliberately interleave dates.
  const groups = React.useMemo(
    () => (sortKey === 'time' ? groupTrendsByDate(visible) : null),
    [visible, sortKey],
  );

  let cardIndex = -1;
  const renderCard = (item: TrendsFeedItem) => {
    cardIndex += 1;
    return (
      <StaggeredItem key={item.id} index={cardIndex}>
        <TrendsListCard
          item={item}
          isSelected={item.id === selectedGameId}
          onSelect={onSelectGame}
        />
      </StaggeredItem>
    );
  };

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto">
        {/* Floating glass header — content refracts under it as you scroll */}
        <div className="sticky top-0 z-20 space-y-2 px-3 pb-2 pt-3 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_calc(100%_-_8px),transparent)]">
          <TrendsSportPicker
            sport={sport}
            onSportChange={onSportChange}
            sortKey={sortKey}
            onSortChange={onSortChange}
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
              aria-label="Refresh trends"
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-muted-foreground backdrop-blur-xl hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]',
                isLoading && 'pointer-events-none opacity-60',
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="space-y-2 px-3 pb-10 pt-1">
          {/* A failed league is reported inline rather than replacing the feed —
              the other leagues' slates are still usable. */}
          {errors.map((err) => (
            <div
              key={err.sport}
              className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-foreground"
            >
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="min-w-0">
                <span className="font-bold">{TRENDS_SPORT_LABELS[err.sport]} trends unavailable.</span>{' '}
                <span className="text-muted-foreground">{err.message}</span>
              </span>
            </div>
          ))}

          {isLoading ? (
            <TrendsListSkeleton />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">
                {searchText.trim() ? 'No teams match that search' : 'No situational trends today'}
              </p>
              <p className="max-w-[15rem] text-[12px] text-muted-foreground">
                {searchText.trim()
                  ? 'Try a different team name or abbreviation.'
                  : 'Trend rows are published per slate. Check back closer to first pitch or tipoff.'}
              </p>
              {searchText.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  className="text-[12px] font-semibold text-primary"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : groups ? (
            groups.map((group) => (
              <React.Fragment key={group.date || 'unknown'}>
                <div className="px-2 pt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </div>
                {group.games.map(renderCard)}
              </React.Fragment>
            ))
          ) : (
            visible.map(renderCard)
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
