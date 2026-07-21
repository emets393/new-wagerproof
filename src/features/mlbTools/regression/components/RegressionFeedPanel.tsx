import * as React from 'react';
import { ArrowUpDown, Check, ClipboardList, RefreshCw, Search, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard, SegmentedControl, StaggeredItem } from '@/components/ios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RegressionListCard } from './RegressionListCard';
import { RegressionListSkeleton } from './RegressionListSkeleton';
import { searchRegressionGames } from '../buildFeed';
import {
  REGRESSION_FILTER_LABELS,
  REGRESSION_SORT_LABELS,
  type RegressionFilter,
  type RegressionGame,
  type RegressionSortKey,
} from '../types';

const FILTER_OPTIONS: { value: RegressionFilter; label: string }[] = (
  ['all', 'picks'] as RegressionFilter[]
).map((v) => ({ value: v, label: REGRESSION_FILTER_LABELS[v] }));

const SORT_KEYS: RegressionSortKey[] = ['time', 'tier', 'signals'];

interface RegressionFeedPanelProps {
  /** Already filtered and sorted by the page; the panel only searches. */
  games: RegressionGame[];
  isLoading: boolean;
  onRefresh: () => void;
  selectedGameId: string | null;
  onSelectGame: (id: string) => void;
  /** Clears the selection, which is what shows the report-wide summary. */
  onShowSummary: () => void;
  filter: RegressionFilter;
  onFilterChange: (filter: RegressionFilter) => void;
  sortKey: RegressionSortKey;
  onSortChange: (key: RegressionSortKey) => void;
  reportDateLabel: string | null;
  pickCount: number;
}

/**
 * Left split-view panel: a summary row that owns all the report-wide content,
 * then today's games. Owns its scroll; SplitViewLayout provides the bounded
 * container.
 */
export function RegressionFeedPanel({
  games,
  isLoading,
  onRefresh,
  selectedGameId,
  onSelectGame,
  onShowSummary,
  filter,
  onFilterChange,
  sortKey,
  onSortChange,
  reportDateLabel,
  pickCount,
}: RegressionFeedPanelProps) {
  const [searchText, setSearchText] = React.useState('');

  const visible = React.useMemo(
    () => searchRegressionGames(games, searchText),
    [games, searchText],
  );

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto">
        {/* Floating glass header — content refracts under it as you scroll */}
        <div className="sticky top-0 z-20 space-y-2 px-3 pb-2 pt-3 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_calc(100%_-_8px),transparent)]">
          <div className="flex items-center gap-1.5">
            <SegmentedControl
              layoutId="regression-filter"
              size="sm"
              className="min-w-0 flex-1"
              options={FILTER_OPTIONS}
              value={filter}
              // Wrapped rather than passed bare: a Dispatch<SetStateAction<T>>
              // would let T infer as a function type and collapse to `string`.
              onChange={(v) => onFilterChange(v)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Sort games"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-muted-foreground backdrop-blur-xl hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                {SORT_KEYS.map((key) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => onSortChange(key)}
                    className="gap-2 rounded-lg"
                  >
                    <span className="flex-1">{REGRESSION_SORT_LABELS[key]}</span>
                    {key === sortKey && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
              aria-label="Refresh report"
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
          {/* The report-wide content is a destination, not an empty state — this
              row is how you get back to it once a game is auto-selected. */}
          <GlassCard
            interactive
            onClick={onShowSummary}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onShowSummary();
              }
            }}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2.5',
              !selectedGameId && 'border-primary/40 dark:border-primary/40',
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardList className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-bold leading-tight text-foreground">
                Today's report
              </span>
              <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {reportDateLabel ?? 'Record, accuracy & method'}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground dark:bg-white/[0.06]">
              <Zap className="h-3 w-3" />
              {pickCount}
            </span>
          </GlassCard>

          {isLoading ? (
            <RegressionListSkeleton />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <Zap className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">
                {searchText.trim()
                  ? 'No teams match that search'
                  : filter === 'picks'
                    ? 'No games have picks today'
                    : 'No games in today’s report'}
              </p>
              <p className="max-w-[15rem] text-[12px] text-muted-foreground">
                {searchText.trim()
                  ? 'Try a different team name or abbreviation.'
                  : filter === 'picks'
                    ? 'The model found nothing clearing the Watch tier. Switch to All games to see the regression signals anyway.'
                    : 'Reports generate at 9 AM, 11 AM and 4 PM ET.'}
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
            visible.map((game, i) => (
              <StaggeredItem key={game.id} index={i}>
                <RegressionListCard
                  game={game}
                  isSelected={game.id === selectedGameId}
                  onSelect={onSelectGame}
                />
              </StaggeredItem>
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
