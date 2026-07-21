import * as React from 'react';
import { Clock } from 'lucide-react';
import { TeamAura, TeamLogoDiscs } from '@/components/ios';
// Shared with /games on purpose: the packing rule ("a short widget shouldn't
// hold open a full-height row") is identical and the hook is sport-agnostic.
import { useMasonryGrid } from '@/features/games/detail/useMasonryGrid';
import type { MlbToolFeedItem } from './types';

/** Matchup header: teams, first pitch, and the tool's headline chips. */
function MlbToolDetailHero({
  game,
  subline,
  chips,
}: {
  game: MlbToolFeedItem;
  subline?: React.ReactNode;
  chips?: React.ReactNode;
}) {
  const { away, home } = game;

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
            {subline ?? `${away.name} at ${home.name}`}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
          <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" />
            {game.gameTimeLabel}
          </span>
        </div>
      </div>

      {chips && <div className="mt-3 flex flex-wrap items-center gap-2">{chips}</div>}
    </div>
  );
}

/** Header chip used for the hero's headline answers. */
export function HeroChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white/60 px-2.5 py-1 text-[11px] font-bold backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </span>
  );
}

interface MlbToolDetailShellProps {
  game: MlbToolFeedItem | null;
  isFeedLoading: boolean;
  emptyIcon: React.ReactNode;
  emptyLabel: string;
  subline?: React.ReactNode;
  chips?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Right split-view pane shared by the MLB tools: team-color aura, matchup hero,
 * and a masonry-packed widget grid. Scrolls independently and resets to top on
 * selection change, matching /games and /todays-trends.
 */
export function MlbToolDetailShell({
  game,
  isFeedLoading,
  emptyIcon,
  emptyLabel,
  subline,
  chips,
  children,
}: MlbToolDetailShellProps) {
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
          {emptyIcon}
          <p className="text-sm font-semibold text-muted-foreground">
            {isFeedLoading ? 'Loading today’s slate…' : emptyLabel}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="relative h-full overflow-y-auto">
      <TeamAura awayColor={game.away.colors.primary} homeColor={game.home.colors.primary} />
      <div className="relative mx-auto max-w-5xl @container">
        <MlbToolDetailHero game={game} subline={subline} chips={chips} />
        {/* @container measures this pane's own width — it's a resizable slice of
            the viewport, so a `lg:` breakpoint would go two-column too early. */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 items-start gap-x-4 gap-y-4 px-4 pb-10 [--widget-card-bg:rgba(241,245,249,0.92)] [--widget-card-border:rgba(15,23,42,0.1)] @xl:grid-cols-2"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
