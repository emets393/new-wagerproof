import * as React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard, TeamLogoDiscs, StatCapsule, EdgePill } from '@/components/ios';
import { PolymarketSparkline } from './PolymarketSparkline';
import { StarButton } from '@/components/StarButton';
import { formatMoneyline, formatSpread, getDisplayedProb } from '../api/shared';
import type { GameFeedItem } from '../types';

/** Mounts children only once scrolled near the viewport (Polymarket fetches per mount). */
function useInView<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  return { ref, inView };
}

/**
 * Selection indicator: a team-colored wash bleeding in from each edge, the same
 * language as the Today's Matchups tiles. Replaces a `ring-2` outline — a ring
 * competed with the card's own hairline border and read as a focus state.
 */
function SelectionGlow({ color, side }: { color: string; side: 'left' | 'right' }) {
  const anchor = side === 'left' ? '0%' : '100%';
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-0 w-3/5 opacity-30 dark:opacity-40',
        side === 'left' ? 'left-0' : 'right-0',
      )}
      style={{
        background: `radial-gradient(125% 100% at ${anchor} 50%, ${color} 0%, transparent 72%)`,
      }}
    />
  );
}

interface GameListCardProps {
  item: GameFeedItem;
  isSelected: boolean;
  isLocked: boolean;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onLockedClick?: () => void;
}

/**
 * The unified iOS-style feed card for all five sports. Layout mirrors the iOS
 * GameRowCard: time pill top-right, merged team discs + matchup + moneylines,
 * spread/total capsules, divider, model edge pills.
 */
export function GameListCard({
  item,
  isSelected,
  isLocked,
  isAdmin,
  onSelect,
  onLockedClick,
}: GameListCardProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { lines, edges, awayTeam, homeTeam } = item;

  const displayedProb = getDisplayedProb(edges.mlProb);
  // Map win-prob to the iOS 4-tier edge scale: 80%+ reads as a top-tier edge
  // (matches the legacy FADE ALERT threshold), 62%+ mid-tier.
  const mlMagnitude = displayedProb !== null ? (displayedProb * 100 - 50) / 6 : 0;

  const favoredHome = lines.homeSpread !== null && lines.homeSpread < 0;
  const spreadText =
    lines.homeSpread !== null
      ? `${favoredHome ? homeTeam.abbrev : awayTeam.abbrev} ${formatSpread(favoredHome ? lines.homeSpread : lines.awaySpread)}`
      : '-';

  const mlbFinal = item.sport === 'mlb' ? (item.raw as any)?.is_final_prediction : undefined;
  const showPolymarket = !isLocked;

  const handleClick = () => {
    if (isLocked) {
      onLockedClick?.();
      return;
    }
    onSelect(item.id);
  };

  return (
    <div ref={ref} className="relative">
      <GlassCard
        interactive={!isLocked}
        onClick={handleClick}
        className={cn(
          // overflow-hidden clips the selection glow to the card's 26px radius.
          'relative overflow-hidden px-4 py-3.5',
          isLocked && 'pointer-events-none select-none opacity-50 blur-[3px]'
        )}
        role="button"
        tabIndex={isLocked ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {isSelected && (
          <>
            <SelectionGlow color={awayTeam.colors.primary} side="left" />
            <SelectionGlow color={homeTeam.colors.primary} side="right" />
          </>
        )}

        {/* Time pill (+ admin star / MLB status), floating top-right like iOS */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {isAdmin && item.sport !== 'mlb' && (
            <span onClick={(e) => e.stopPropagation()}>
              <StarButton gameId={item.id} gameType={item.sport} />
            </span>
          )}
          {mlbFinal !== undefined && (
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                mlbFinal
                  ? 'bg-primary/15 text-primary'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              )}
            >
              {mlbFinal ? 'Final' : 'Prelim'}
            </span>
          )}
          <span className="rounded-md border border-black/5 bg-white/50 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
            {item.status === 'postponed' ? 'PPD' : item.gameTimeLabel}
          </span>
        </div>

        {/* Main row (iOS GameRowCard): teams block | line pills | sparkline */}
        <div className="relative mt-4 flex items-center gap-3">
          <div className="w-[96px] shrink-0">
            <TeamLogoDiscs
              away={{ logoUrl: awayTeam.logoUrl, abbrev: awayTeam.abbrev, color: awayTeam.colors.primary }}
              home={{ logoUrl: homeTeam.logoUrl, abbrev: homeTeam.abbrev, color: homeTeam.colors.primary }}
              size={40}
            />
            <div className="mt-1.5 truncate text-[13px] font-bold text-foreground">
              {awayTeam.abbrev} <span className="text-muted-foreground">@</span> {homeTeam.abbrev}
            </div>
            <div className="font-mono text-[11px] font-semibold">
              <span className={cn((lines.awayML ?? 0) < 0 ? 'text-blue-500' : 'text-primary')}>
                {formatMoneyline(lines.awayML)}
              </span>
              <span className="mx-1 text-muted-foreground">/</span>
              <span className={cn((lines.homeML ?? 0) < 0 ? 'text-blue-500' : 'text-primary')}>
                {formatMoneyline(lines.homeML)}
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
            <StatCapsule label="Spread" value={spreadText} />
            <StatCapsule label="Total" value={lines.total !== null ? String(lines.total) : '-'} />
          </div>

          {showPolymarket && inView && (
            <PolymarketSparkline
              awayTeam={awayTeam.name}
              homeTeam={homeTeam.name}
              awayAbbrev={awayTeam.abbrev}
              homeAbbrev={homeTeam.abbrev}
              awayColor={awayTeam.colors.primary}
              homeColor={homeTeam.colors.primary}
              league={item.sport}
            />
          )}
        </div>

        {/* Edge pills */}
        {(displayedProb !== null ||
          edges.spreadEdge !== null ||
          edges.totalEdge !== null) && (
          <>
            <div className="relative mt-2.5 border-t border-black/5 dark:border-white/10" />
            <div className="relative mt-2.5 flex flex-wrap items-center gap-1.5">
              {displayedProb !== null && (
                <EdgePill text={`ML ${(displayedProb * 100).toFixed(0)}%`} magnitude={mlMagnitude} />
              )}
              {edges.spreadEdge !== null && (
                <EdgePill
                  text={`SPR ${formatSpread(Math.round(Math.abs(edges.spreadEdge) * 2) / 2)}`}
                  magnitude={Math.abs(edges.spreadEdge)}
                />
              )}
              {edges.totalEdge !== null && (
                <EdgePill
                  text={`O/U ${formatSpread(Math.round(Math.abs(edges.totalEdge) * 2) / 2)}`}
                  magnitude={Math.abs(edges.totalEdge)}
                />
              )}
            </div>
          </>
        )}

      </GlassCard>

      {isLocked && (
        <button
          type="button"
          onClick={onLockedClick}
          className="absolute inset-0 z-10 flex items-center justify-center rounded-[26px]"
          aria-label="Upgrade to unlock this game"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur-md">
            <Lock className="h-3.5 w-3.5" /> Pro
          </span>
        </button>
      )}
    </div>
  );
}
