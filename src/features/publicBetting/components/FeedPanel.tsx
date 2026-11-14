import * as React from 'react';
import { ChevronDown, RefreshCw, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SegmentedControl } from '@/components/ios';
import {
  MARKET_LABELS,
  PUBLIC_MARKETS,
  SORT_LABELS,
  SPORT_LABELS,
  type BoardSort,
  type PublicGame,
  type PublicMarket,
  type PublicSport,
  type SportFilter,
  type TierFilter,
} from '../types';
import { FeedCard } from './FeedCard';

interface FeedPanelProps {
  sport: SportFilter;
  market: PublicMarket;
  tier: TierFilter;
  sort: BoardSort;
  sports: PublicSport[];
  games: PublicGame[];
  isLoading: boolean;
  isRefreshing: boolean;
  isUnavailable: boolean;
  errorMessage: string | null;
  onSportChange: (sport: SportFilter) => void;
  onMarketChange: (market: PublicMarket) => void;
  onTierChange: (tier: TierFilter) => void;
  onSortChange: (sort: BoardSort) => void;
  onRefresh: () => void;
  /** Survives the mobile detail push, which unmounts this panel. */
  searchText: React.MutableRefObject<string>;
  listScrollTop: React.MutableRefObject<number>;
  selectedGameId: string | null;
  onSelectGame: (id: string) => void;
  boardCount: number;
}

export function FeedPanel({
  sport,
  market,
  tier,
  sort,
  sports,
  games,
  isLoading,
  isRefreshing,
  isUnavailable,
  errorMessage,
  onSportChange,
  onMarketChange,
  onTierChange,
  onSortChange,
  onRefresh,
  searchText: searchStore,
  listScrollTop,
  selectedGameId,
  onSelectGame,
  boardCount,
}: FeedPanelProps) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [searchText, setSearchText] = React.useState(searchStore.current);
  const needle = searchText.trim().toLowerCase();

  React.useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = listScrollTop.current;
  }, [listScrollTop]);
  const visible = needle
    ? games.filter((game) =>
        `${game.away.name} ${game.home.name} ${game.away.abbrev} ${game.home.abbrev}`
          .toLowerCase()
          .includes(needle),
      )
    : games;

  const sportOptions = [
    ...(sports.length > 1 || sport === 'all' ? [{ value: 'all' as const, label: 'All' }] : []),
    ...sports.map((item) => ({ value: item, label: SPORT_LABELS[item] })),
    ...(sport !== 'all' && !sports.includes(sport)
      ? [{ value: sport, label: SPORT_LABELS[sport] }]
      : []),
  ];

  const sportLabel = sport === 'all' ? 'any league' : SPORT_LABELS[sport];

  return (
    <div
      ref={scrollerRef}
      onScroll={(event) => {
        listScrollTop.current = event.currentTarget.scrollTop;
      }}
      className="h-full overflow-x-hidden overflow-y-auto"
    >
      <div className="sticky top-0 z-20 space-y-2 px-3 pb-2 pt-3 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_calc(100%_-_8px),transparent)]">
        {sportOptions.length > 0 && (
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl
              layoutId="public-betting-sport"
              size="sm"
              className="w-max min-w-full"
              options={sportOptions}
              value={sport}
              onChange={onSportChange}
            />
          </div>
        )}
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          <div className="max-w-full min-w-0 overflow-x-auto">
            <SegmentedControl
              layoutId="public-betting-market"
              size="sm"
              className="w-max"
              options={PUBLIC_MARKETS.map((item) => ({ value: item, label: MARKET_LABELS[item] }))}
              value={market}
              onChange={onMarketChange}
            />
          </div>
          <SegmentedControl
            layoutId="public-betting-tier"
            size="sm"
            options={[
              { value: 'sharp' as const, label: 'Sharp money only' },
              { value: 'all' as const, label: 'All' },
            ]}
            value={tier}
            onChange={onTierChange}
          />
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <label className="relative flex h-9 min-w-0 max-w-[46%] shrink items-center sm:max-w-[11rem]">
            <span className="sr-only">Sort</span>
            <select
              aria-label="Sort"
              value={sort}
              onChange={(event) => onSortChange(event.target.value as BoardSort)}
              className="h-9 w-full appearance-none truncate rounded-full border border-black/5 bg-white/60 pl-3 pr-7 text-base font-bold text-foreground outline-none backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] sm:text-[13px]"
            >
              {(Object.keys(SORT_LABELS) as BoardSort[]).map((item) => (
                <option key={item} value={item}>
                  {SORT_LABELS[item]}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-3 w-3 text-muted-foreground" />
          </label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchText}
              onChange={(event) => {
                searchStore.current = event.target.value;
                setSearchText(event.target.value);
              }}
              placeholder="Search teams"
              className="h-9 w-full min-w-0 rounded-full border border-black/5 bg-white/60 pl-8 pr-8 text-base font-medium text-foreground outline-none backdrop-blur-xl placeholder:text-muted-foreground focus:border-primary/40 dark:border-white/10 dark:bg-white/[0.06] sm:text-[13px]"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => {
                  searchStore.current = '';
                  setSearchText('');
                }}
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
            aria-label="Refresh public betting"
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-muted-foreground backdrop-blur-xl hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]',
              isLoading && 'pointer-events-none opacity-60',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (isLoading || isRefreshing) && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="space-y-2 px-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-1">
        {isLoading &&
          Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-[26px] border border-black/5 bg-white/40 dark:border-white/10 dark:bg-white/[0.04]"
            />
          ))}

        {!isLoading && isUnavailable && (
          <EmptyState
            title="Public betting isn't on the board yet."
            body="Percentages show up here once the board is published. The page is ready for them."
          />
        )}

        {!isLoading && errorMessage && !isUnavailable && (
          <EmptyState title="The board couldn't be loaded." body={errorMessage} />
        )}

        {!isLoading && !errorMessage && !isUnavailable && boardCount === 0 && (
          <EmptyState
            title="Nothing on the board."
            body="Public splits show up once a slate is posted. July is usually empty."
          />
        )}

        {!isLoading && !errorMessage && !isUnavailable && boardCount > 0 && visible.length === 0 && (
          <EmptyState
            title={
              needle
                ? 'No teams match that search.'
                : tier === 'sharp'
                  ? `No sharp-money reads on the ${MARKET_LABELS[market].toLowerCase()}.`
                  : `No usable ${MARKET_LABELS[market].toLowerCase()} splits for ${sportLabel}.`
            }
            body={
              tier === 'sharp' && !needle
                ? 'Sharp money needs heavy tickets one way, the dollars the other way, and the line moving with the dollars.'
                : 'A 0/100 split and a thin ticket count stay off the feed.'
            }
          />
        )}

        {visible.map((game) => (
          <FeedCard
            key={game.id}
            game={game}
            market={market}
            isSelected={game.id === selectedGameId}
            onSelect={onSelectGame}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[26px] border border-dashed border-black/10 px-4 py-8 text-center dark:border-white/15">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-[13px] leading-snug text-muted-foreground">{body}</p>
    </div>
  );
}
