import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ios';
import { AgentAvatarTile } from './AgentAvatarTile';
import { AgentSelectionGlow } from './AgentSelectionGlow';
import { RankBadge } from './RankBadge';
import { formatNetUnits, type Sport } from '@/types/agent';
import { getAgentColorPair, DEFAULT_AGENT_COLOR } from '@/utils/agentColors';
import type { LeaderboardEntry } from '@/services/agentPerformanceService';
import { TicketSportIcon } from '@/components/agents/AgentTicketShell';

interface LeaderboardRowCardProps {
  entry: LeaderboardEntry;
  rank: number;
  isSelected: boolean;
  isBottomMode: boolean;
  onSelect: (avatarId: string) => void;
}

/** Overlapping sport-icon coins — compact enough that 4–5 sports never wrap. */
export function SportIconCluster({
  sports,
  size = 18,
  className,
}: {
  sports: Sport[];
  size?: number;
  className?: string;
}) {
  if (!sports.length) return null;
  return (
    <div
      className={cn('flex flex-nowrap items-center', className)}
      aria-label={sports.map((s) => s.toUpperCase()).join(', ')}
    >
      {sports.map((sport, i) => (
        <span
          key={sport}
          title={sport.toUpperCase()}
          className="relative grid shrink-0 place-items-center rounded-full border border-black/10 bg-muted text-foreground dark:border-white/15 dark:bg-white/10"
          style={{
            width: size,
            height: size,
            marginLeft: i === 0 ? 0 : -7,
            zIndex: sports.length - i,
          }}
        >
          <TicketSportIcon sport={sport} className="h-[55%] w-[55%]" />
        </span>
      ))}
    </div>
  );
}

/**
 * iOS leaderboard row: rank badge (gold/silver/bronze glow for top 3),
 * gradient avatar, name + overlapping sport icons, trailing record / net units / WR badge.
 */
export function LeaderboardRowCard({
  entry,
  rank,
  isSelected,
  isBottomMode,
  onSelect,
}: LeaderboardRowCardProps) {
  const record = `${entry.wins}-${entry.losses}${entry.pushes > 0 ? `-${entry.pushes}` : ''}`;
  const winRate = entry.win_rate != null ? `${(entry.win_rate * 100).toFixed(1)}%` : '--';
  const [primary, secondary] = getAgentColorPair(entry.avatar_color || DEFAULT_AGENT_COLOR);
  const sports = entry.preferred_sports ?? [];

  return (
    <GlassCard
      radius={18}
      interactive
      role="button"
      tabIndex={0}
      onClick={() => onSelect(entry.avatar_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(entry.avatar_id);
        }
      }}
      className={cn('relative overflow-hidden px-3 py-2.5')}
    >
      {isSelected && <AgentSelectionGlow primary={primary} secondary={secondary} />}

      <div className="relative flex items-center gap-2.5">
        <RankBadge rank={rank} />
        <AgentAvatarTile
          agentId={entry.avatar_id}
          spriteIndexOverride={(entry as any).sprite_index}
          emoji={entry.avatar_emoji}
          color={entry.avatar_color}
          size={rank <= 3 ? 40 : 34}
          round
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{entry.name}</p>
          <SportIconCluster sports={sports} className="mt-0.5" />
        </div>

        <div className="text-right">
          <p className="font-mono text-[11px] text-muted-foreground">{record}</p>
          <p
            className={cn(
              'font-mono text-[13px] font-bold',
              entry.net_units >= 0 ? 'text-emerald-500' : 'text-red-500'
            )}
          >
            {formatNetUnits(entry.net_units)}
          </p>
        </div>

        <span
          className={cn(
            'min-w-[52px] rounded-full px-1.5 py-0.5 text-center font-mono text-[11px] font-bold',
            isBottomMode
              ? entry.win_rate !== null && entry.win_rate < 0.35
                ? 'bg-red-500/15 text-red-500'
                : 'bg-orange-500/15 text-orange-500'
              : 'bg-[#00E676]/15 text-[#00A854] dark:text-[#00E676]'
          )}
        >
          {winRate}
        </span>

        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </GlassCard>
  );
}
