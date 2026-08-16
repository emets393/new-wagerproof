import * as React from 'react';
import { AlertCircle, ArrowUpDown, BarChart3, Check, RefreshCw, Search, X } from 'lucide-react';
import { StaggeredItem } from '@/components/ios';
import { SegmentedControl } from '@/components/ios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { groupMlbToolGamesByDate, searchMlbToolGames } from '@/features/mlbTools/shared/feedUtils';
import { MlbToolListSkeleton } from '@/features/mlbTools/shared/MlbToolListSkeleton';
import type { MlbToolFeedItem } from '@/features/mlbTools/shared/types';
import type { PropsSport } from './usePropsUrlState';

export type PropsSortKey = 'time' | 'away' | 'home';

const SPORT_OPTIONS = [
  { value: 'mlb' as const, label: 'MLB' },
  { value: 'nfl' as const, label: 'NFL' },
  { value: 'nba' as const, label: 'NBA', status: 'Soon', disabled: true },
];

const SORT_OPTIONS: { value: PropsSortKey; label: string }[] = [
  { value: 'time', label: 'Game time' },
  { value: 'away', label: 'Away team' },
  { value: 'home', label: 'Home team' },
];

interface PropsFeedPanelProps<T extends MlbToolFeedItem> {
  sport: PropsSport;
  onSportChange: (sport: PropsSport) => void;
  games: T[];
  isLoading: boolean;
  errorMessage?: string | null;
  onRefresh: () => void;
  selectedGameId: string | null;
  onSelectGame: (id: string) => void;
  renderCard: (game: T, isSelected: boolean) => React.ReactNode;
  footnote?: React.ReactNode;
  emptyTitle: string;
  emptyBody: string;
}

/** Shared prop slate: the same sport/search/sort/refresh hierarchy as Today's Trends. */
export function PropsFeedPanel<T extends MlbToolFeedItem>({
  sport,
  onSportChange,
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
}: PropsFeedPanelProps<T>) {
  const [searchText, setSearchText] = React.useState('');
  const [sortKey, setSortKey] = React.useState<PropsSortKey>('time');

  const visible = React.useMemo(() => {
    const searched = searchMlbToolGames(games, searchText);
    return [...searched].sort((a, b) => {
      if (sortKey === 'away') return a.away.name.localeCompare(b.away.name);
      if (sortKey === 'home') return a.home.name.localeCompare(b.home.name);
      return a.timeSortKey.localeCompare(b.timeSortKey);
    });
  }, [games, searchText, sortKey]);
  const groups = React.useMemo(
    () => sortKey === 'time' ? groupMlbToolGamesByDate(visible) : null,
    [sortKey, visible],
  );

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
        <div className="sticky top-0 z-20 space-y-2 px-3 pb-2 pt-3 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_calc(100%_-_8px),transparent)]">
          <div className="flex items-center gap-1.5">
            <SegmentedControl
              layoutId="props-sport-picker"
              size="sm"
              className="min-w-0 flex-1"
              options={SPORT_OPTIONS}
              value={sport}
              onChange={(value) => {
                if (value !== 'nba') onSportChange(value);
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Sort prop matchups" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-muted-foreground backdrop-blur-xl hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem key={option.value} onClick={() => setSortKey(option.value)} className="gap-2 rounded-lg">
                    <span className="flex-1">{option.label}</span>
                    {option.value === sortKey && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search teams" className="h-9 w-full rounded-full border border-black/5 bg-white/60 pl-8 pr-8 text-[13px] font-medium text-foreground outline-none backdrop-blur-xl placeholder:text-muted-foreground focus:border-primary/40 dark:border-white/10 dark:bg-white/[0.06]" />
              {searchText && (
                <button type="button" onClick={() => setSearchText('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button type="button" onClick={onRefresh} aria-label="Refresh prop matchups" className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-muted-foreground backdrop-blur-xl hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]', isLoading && 'pointer-events-none opacity-60')}>
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </button>
          </div>
          {footnote && <p className="px-1 text-[10px] text-muted-foreground">{footnote}</p>}
        </div>

        <div className="space-y-2 px-3 pb-10 pt-1">
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-foreground">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span><strong>Couldn’t load the slate.</strong> <span className="text-muted-foreground">{errorMessage}</span></span>
            </div>
          )}
          {isLoading ? <MlbToolListSkeleton /> : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">{searchText.trim() ? 'No teams match that search' : emptyTitle}</p>
              <p className="max-w-[15rem] text-[12px] text-muted-foreground">{searchText.trim() ? 'Try a different team name or abbreviation.' : emptyBody}</p>
            </div>
          ) : groups ? groups.map((group) => (
            <div key={group.date || 'unknown'} className="contents">
              <div className="px-2 pt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{group.label}</div>
              {group.games.map(renderItem)}
            </div>
          )) : visible.map(renderItem)}
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-10 bg-gradient-to-b from-transparent via-background/75 to-background dark:via-black/75 dark:to-black" />
    </div>
  );
}
