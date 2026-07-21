import * as React from 'react';
import { AlertCircle, RefreshCw, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggeredItem } from '@/components/ios';
import { MlbToolListSkeleton } from './MlbToolListSkeleton';
import { groupMlbToolGamesByDate, searchMlbToolGames } from './feedUtils';
import type { MlbToolFeedItem } from './types';

interface MlbToolFeedPanelProps<T extends MlbToolFeedItem> {
  games: T[];
  isLoading: boolean;
  /** Rendered as an inline warning; the rest of the feed still shows. */
  errorMessage?: string | null;
  onRefresh: () => void;
  selectedGameId: string | null;
  onSelectGame: (id: string) => void;
  /** One card per game — the tool owns what its summary says. */
  renderCard: (game: T, isSelected: boolean) => React.ReactNode;
  /** Shown under the search row, e.g. "Last refreshed 7:02 PM ET". */
  footnote?: React.ReactNode;
  emptyTitle: string;
  emptyBody: string;
  emptyIcon: React.ReactNode;
}

/**
 * Left split-view panel shared by the MLB tools: floating glass search + refresh
 * over today's slate, grouped by date. Owns its scroll; SplitViewLayout provides
 * the bounded container.
 */
export function MlbToolFeedPanel<T extends MlbToolFeedItem>({
  games,
  isLoading,
  errorMessage,
  onRefresh,
  selectedGameId,
  onSelectGame,
  renderCard,
  footnote,
  emptyTitle,
  emptyBody,
  emptyIcon,
}: MlbToolFeedPanelProps<T>) {
  const [searchText, setSearchText] = React.useState('');

  const visible = React.useMemo(() => searchMlbToolGames(games, searchText), [games, searchText]);
  const groups = React.useMemo(() => groupMlbToolGamesByDate(visible), [visible]);

  let cardIndex = -1;
  const renderItem = (game: T) => {
    cardIndex += 1;
    return (
      <StaggeredItem key={game.id} index={cardIndex}>
        {renderCard(game, game.id === selectedGameId)}
      </StaggeredItem>
    );
  };

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto">
        {/* Floating glass header — content refracts under it as you scroll */}
        <div className="sticky top-0 z-20 space-y-1.5 px-3 pb-2 pt-3 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_calc(100%_-_8px),transparent)]">
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
              aria-label="Refresh slate"
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-muted-foreground backdrop-blur-xl hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]',
                isLoading && 'pointer-events-none opacity-60',
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </button>
          </div>
          {footnote && (
            <p className="px-1 text-[10px] text-muted-foreground">{footnote}</p>
          )}
        </div>

        <div className="space-y-2 px-3 pb-10 pt-1">
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-foreground">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="min-w-0">
                <span className="font-bold">Couldn’t load the slate.</span>{' '}
                <span className="text-muted-foreground">{errorMessage}</span>
              </span>
            </div>
          )}

          {isLoading ? (
            <MlbToolListSkeleton />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              {emptyIcon}
              <p className="text-sm font-semibold text-foreground">
                {searchText.trim() ? 'No teams match that search' : emptyTitle}
              </p>
              <p className="max-w-[15rem] text-[12px] text-muted-foreground">
                {searchText.trim() ? 'Try a different team name or abbreviation.' : emptyBody}
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
          ) : (
            groups.map((group) => (
              <React.Fragment key={group.date || 'unknown'}>
                <div className="px-2 pt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </div>
                {group.games.map(renderItem)}
              </React.Fragment>
            ))
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
