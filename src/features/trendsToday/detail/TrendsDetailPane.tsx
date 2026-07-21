import * as React from 'react';
import { Chip } from '@heroui/react';
import { Clock, TrendingUp } from 'lucide-react';
import { TeamAura, TeamLogoDiscs } from '@/components/ios';
// Shared with /games on purpose: the packing rule ("a short widget shouldn't
// hold open a full-height row") is identical, and this hook is sport-agnostic.
import { useMasonryGrid } from '@/features/games/detail/useMasonryGrid';
import { DirectionWord, TeamMark } from './shared';
import { TrendsSportSections } from './sections';
import { SIDE_MARKET_SHORT, TRENDS_SPORT_LABELS, type TrendsFeedItem } from '../types';

/** Matchup header: teams, tipoff, and the two verdicts restated as chips. */
function TrendsDetailHero({ game }: { game: TrendsFeedItem }) {
  const { verdict, away, home } = game;
  const sideTeam = verdict.side === 'away' ? away : verdict.side === 'home' ? home : null;

  return (
    <div className="px-4 pb-3 pt-5">
      <div className="flex items-center gap-3">
        <TeamLogoDiscs
          away={{ logoUrl: away.logoUrl, abbrev: away.abbrev, color: away.colors.primary }}
          home={{ logoUrl: home.logoUrl, abbrev: home.abbrev, color: home.colors.primary }}
          size={52}
          overlap={12}
        />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-bold leading-tight tracking-tight text-foreground">
            {away.abbrev} <span className="text-muted-foreground">@</span> {home.abbrev}
          </h1>
          <p className="truncate text-[12px] text-muted-foreground">
            {away.name} at {home.name}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
          <Chip size="sm" variant="flat" classNames={{ content: 'text-[10px] font-bold' }}>
            {TRENDS_SPORT_LABELS[game.sport]}
          </Chip>
          <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" />
            {game.gameTimeLabel}
          </span>
        </div>
      </div>

      {/* The two answers up front, so the widget stack below is confirmation. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white/60 px-2.5 py-1 text-[11px] font-bold backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
          <span className="text-muted-foreground">{SIDE_MARKET_SHORT[game.sport]}</span>
          {sideTeam ? (
            <>
              <TeamMark team={sideTeam} size={16} />
              <span className="text-foreground">{sideTeam.abbrev}</span>
              <span className="text-muted-foreground">
                {verdict.sideAgree}/{verdict.sideTotal}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">No lean</span>
          )}
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white/60 px-2.5 py-1 text-[11px] font-bold backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
          <span className="text-muted-foreground">Total</span>
          <DirectionWord direction={verdict.total} />
          {verdict.total && (
            <span className="text-muted-foreground">
              {verdict.totalAgree}/{verdict.totalTotal}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * Right split-view pane: team-color aura, matchup hero, and the per-sport stack
 * of trend widgets. Scrolls independently and resets to top on selection change,
 * matching /games.
 */
export function TrendsDetailPane({
  game,
  isFeedLoading,
}: {
  game: TrendsFeedItem | null;
  isFeedLoading: boolean;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  useMasonryGrid(gridRef, game?.id);

  React.useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [game?.id]);

  if (!game) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <TrendingUp className="h-9 w-9 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-muted-foreground">
            {isFeedLoading ? 'Loading today’s slate…' : 'Select a game to see its situational trends'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="relative h-full overflow-y-auto">
      <TeamAura awayColor={game.away.colors.primary} homeColor={game.home.colors.primary} />
      <div className="relative mx-auto max-w-5xl @container">
        <TrendsDetailHero game={game} />
        {/* @container measures this pane's own width — it's a resizable slice of
            the viewport, so a `lg:` breakpoint would go two-column too early. */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 items-start gap-x-4 gap-y-4 px-4 pb-10 [--widget-card-bg:rgba(241,245,249,0.92)] [--widget-card-border:rgba(15,23,42,0.1)] @xl:grid-cols-2"
        >
          <TrendsSportSections game={game} />
        </div>
      </div>
    </div>
  );
}
