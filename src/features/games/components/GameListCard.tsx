import * as React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard, TeamLogoDiscs, StatCapsule } from '@/components/ios';
import { PolymarketSparkline, type DemoSparklineSeries } from './PolymarketSparkline';
import { StarButton } from '@/components/StarButton';
import { AgentConsensusStrip } from './AgentConsensusStrip';
import { ProjectionPills } from './ProjectionPills';
import { formatMoneyline, formatSpread } from '../api/shared';
import type { GameAgentConsensus } from '@/services/agentConsensusService';
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
  /** Landing-page demo cards pass false to skip the live Polymarket fetch. */
  showSparkline?: boolean;
  /** Static prediction-market series for landing demos (implies showSparkline). */
  demoSparkline?: DemoSparklineSeries;
  /**
   * Public-agent consensus for this game. Fetched once per slate by the feed
   * panel (the flag threshold needs the whole slate), passed down rather than
   * carried on GameFeedItem so the five sport adapters stay untouched.
   */
  consensus?: GameAgentConsensus;
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
  showSparkline = true,
  demoSparkline,
  consensus,
}: GameListCardProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { lines, edges, awayTeam, homeTeam } = item;

  const favoredHome = lines.homeSpread !== null && lines.homeSpread < 0;
  const spreadText =
    lines.homeSpread !== null
      ? `${favoredHome ? homeTeam.abbrev : awayTeam.abbrev} ${formatSpread(favoredHome ? lines.homeSpread : lines.awaySpread)}`
      : 'TBD';

  const mlbFinal = item.sport === 'mlb' ? (item.raw as any)?.is_final_prediction : undefined;
  const showPolymarket = !isLocked && (showSparkline || Boolean(demoSparkline));

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
          'relative overflow-hidden px-3 py-2.5',
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

        {/* Main row (iOS GameRowCard): teams block | line pills | sparkline */}
        <div className="relative flex items-center gap-2">
          <div className="w-[82px] shrink-0">
            <TeamLogoDiscs
              away={{ logoUrl: awayTeam.logoUrl, abbrev: awayTeam.abbrev, color: awayTeam.colors.primary }}
              home={{ logoUrl: homeTeam.logoUrl, abbrev: homeTeam.abbrev, color: homeTeam.colors.primary }}
              size={32}
              overlap={8}
            />
            <div className="mt-1 truncate text-[12px] font-bold leading-tight text-foreground">
              {awayTeam.abbrev} <span className="text-muted-foreground">@</span> {homeTeam.abbrev}
            </div>
            <div className="font-mono text-[10px] font-semibold leading-tight">
              <span className={cn((lines.awayML ?? 0) < 0 ? 'text-blue-500' : 'text-primary')}>
                {formatMoneyline(lines.awayML)}
              </span>
              <span className="mx-1 text-muted-foreground">/</span>
              <span className={cn((lines.homeML ?? 0) < 0 ? 'text-blue-500' : 'text-primary')}>
                {formatMoneyline(lines.homeML)}
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            <StatCapsule className="px-2 py-0.5" label="Spread" value={spreadText} />
            <StatCapsule className="px-2 py-0.5" label="Total" value={lines.total !== null ? String(lines.total) : 'TBD'} />
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
              width={116}
              height={38}
              demoSeries={demoSparkline}
            />
          )}
        </div>

        {/* Model edges + compact game metadata */}
        <div className="relative mt-2 border-t border-black/5 dark:border-white/10" />
        <div className="relative mt-2 flex items-center gap-1">
          <ProjectionPills
            edges={edges}
            awayTeam={awayTeam}
            homeTeam={homeTeam}
            signalCount={item.signalCount}
          />

          <div className="ml-auto flex shrink-0 items-center gap-1">
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
        </div>

        {consensus && <AgentConsensusStrip consensus={consensus} />}

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
