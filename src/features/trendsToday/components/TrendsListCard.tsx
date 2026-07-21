import { cn } from '@/lib/utils';
import { GlassCard, TeamLogoDiscs } from '@/components/ios';
import { DirectionWord, TeamMark } from '../detail/shared';
import { SIDE_MARKET_SHORT, TRENDS_SPORT_LABELS, type TrendsFeedItem } from '../types';

/**
 * Selection indicator: a team-colored wash bleeding in from each edge. Mirrors
 * GameListCard's treatment rather than a `ring-2` outline, which competed with
 * the card's own hairline border and read as a focus state.
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

/** Small capsule used for both verdict pills, so they read as one pair. */
function VerdictPill({
  label,
  children,
  count,
}: {
  label: string;
  children: React.ReactNode;
  count?: string;
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white/55 px-2 py-0.5 text-[10px] font-bold backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
      <span className="text-muted-foreground">{label}</span>
      {children}
      {count && <span className="tabular-nums text-muted-foreground">{count}</span>}
    </span>
  );
}

interface TrendsListCardProps {
  item: TrendsFeedItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Feed card for one game: merged team discs, matchup, time pill, and the two
 * trend verdicts. The verdicts are on the card (not just in the detail pane) so
 * the list itself is scannable for "who has a real angle today".
 */
export function TrendsListCard({ item, isSelected, onSelect }: TrendsListCardProps) {
  const { away, home, verdict } = item;
  const sideTeam = verdict.side === 'away' ? away : verdict.side === 'home' ? home : null;

  return (
    <GlassCard
      interactive
      onClick={() => onSelect(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item.id);
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
            {TRENDS_SPORT_LABELS[item.sport]}
          </span>
        </div>
        <span className="shrink-0 rounded-md border border-black/5 bg-white/50 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
          {item.gameTimeLabel}
        </span>
      </div>

      <div className="relative mt-2 border-t border-black/5 dark:border-white/10" />
      <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
        <VerdictPill
          label={SIDE_MARKET_SHORT[item.sport]}
          count={sideTeam ? `${verdict.sideAgree}/${verdict.sideTotal}` : undefined}
        >
          {sideTeam ? (
            <>
              <TeamMark team={sideTeam} size={14} />
              <span className="text-foreground">{sideTeam.abbrev}</span>
            </>
          ) : (
            <span className="text-muted-foreground">No lean</span>
          )}
        </VerdictPill>
        <VerdictPill
          label="Total"
          count={verdict.total ? `${verdict.totalAgree}/${verdict.totalTotal}` : undefined}
        >
          <DirectionWord direction={verdict.total} showIcon={verdict.total !== null} />
        </VerdictPill>
      </div>
    </GlassCard>
  );
}
