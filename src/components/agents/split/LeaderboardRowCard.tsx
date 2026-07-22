import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ios';
import { AgentAvatarTile } from './AgentAvatarTile';
import { AgentSelectionGlow } from './AgentSelectionGlow';
import { RankBadge } from './RankBadge';
import { formatNetUnits } from '@/types/agent';
import { getAgentColorPair, DEFAULT_AGENT_COLOR } from '@/utils/agentColors';
import type { LeaderboardEntry } from '@/services/agentPerformanceService';

interface LeaderboardRowCardProps {
  entry: LeaderboardEntry;
  rank: number;
  isSelected: boolean;
  isBottomMode: boolean;
  onSelect: (avatarId: string) => void;
}

/**
 * iOS leaderboard row: rank badge (gold/silver/bronze glow for top 3),
 * gradient avatar, name + sports, trailing record / net units / WR badge.
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
          <div className="mt-0.5 flex items-center gap-1">
            {sports.slice(0, 2).map((sport) => (
              <Badge key={`${entry.avatar_id}-${sport}`} variant="outline" className="h-4 px-1.5 text-[9px]">
                {sport.toUpperCase()}
              </Badge>
            ))}
            {sports.length > 2 && (
              <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                +{sports.length - 2}
              </Badge>
            )}
          </div>
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
