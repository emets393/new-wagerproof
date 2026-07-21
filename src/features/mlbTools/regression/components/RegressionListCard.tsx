import { Activity, CloudSun, Flame, Shield, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard, TeamLogoDiscs } from '@/components/ios';
import { TierChip } from '../detail/shared';
import type { RegressionGame } from '../types';

/**
 * Selection indicator: a team-colored wash bleeding in from each edge, matching
 * GameListCard rather than a `ring-2` outline (which competed with the card's
 * own hairline border and read as a focus state).
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
      style={{ background: `radial-gradient(125% 100% at ${anchor} 50%, ${color} 0%, transparent 72%)` }}
    />
  );
}

/** Icon + count for one family of signals, so the row scans without reading. */
function SignalCount({
  icon,
  count,
  title,
}: {
  icon: React.ReactNode;
  count: number;
  title: string;
}) {
  if (count === 0) return null;
  return (
    <span
      title={title}
      className="flex items-center gap-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground [&>svg]:h-3 [&>svg]:w-3"
    >
      {icon}
      {count}
    </span>
  );
}

interface RegressionListCardProps {
  game: RegressionGame;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Feed card for one game: merged team discs, matchup, first pitch, then the
 * strongest pick tier and a count per signal family. The tier is on the card
 * (not only in the detail pane) so the list itself answers "where are today's
 * plays".
 */
export function RegressionListCard({ game, isSelected, onSelect }: RegressionListCardProps) {
  const { away, home } = game;

  return (
    <GlassCard
      interactive
      onClick={() => onSelect(game.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(game.id);
        }
      }}
      // overflow-hidden clips the selection glow to the card's radius.
      className="relative overflow-hidden px-3 py-2.5"
    >
      {isSelected && (
        <>
          <SelectionGlow color={away.colors.primary} side="left" />
          <SelectionGlow color={home.colors.primary} side="right" />
        </>
      )}

      <div className="relative flex items-center gap-2.5">
        <TeamLogoDiscs
          away={{ logoUrl: away.logoUrl, abbrev: away.abbrev, color: away.colors.primary }}
          home={{ logoUrl: home.logoUrl, abbrev: home.abbrev, color: home.colors.primary }}
          size={32}
          overlap={8}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-bold leading-tight text-foreground">
            {away.abbrev} <span className="text-muted-foreground">@</span> {home.abbrev}
          </span>
          <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {game.isDoubleheader ? `Game ${game.gameNumber} of doubleheader` : 'MLB'}
          </span>
        </div>
        <span className="shrink-0 rounded-md border border-black/5 bg-white/50 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
          {game.gameTimeLabel}
        </span>
      </div>

      <div className="relative mt-2 border-t border-black/5 dark:border-white/10" />
      <div className="relative mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {game.topTier ? (
          <>
            <TierChip tier={game.topTier} />
            <span className="text-[10px] font-semibold text-foreground">
              {game.picks.length} {game.picks.length === 1 ? 'pick' : 'picks'}
            </span>
          </>
        ) : (
          <span className="text-[10px] font-semibold text-muted-foreground">No picks</span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <SignalCount icon={<Flame />} count={game.pitchers.length} title="Starting pitcher regression" />
          <SignalCount icon={<Activity />} count={game.batting.length} title="Team batting regression" />
          <SignalCount icon={<Shield />} count={game.bullpens.length} title="Bullpen fatigue" />
          <SignalCount icon={<Target />} count={game.signals.length} title="Series-position signals" />
          <SignalCount icon={<CloudSun />} count={game.weather ? 1 : 0} title="Weather and park" />
        </span>
      </div>
    </GlassCard>
  );
}
