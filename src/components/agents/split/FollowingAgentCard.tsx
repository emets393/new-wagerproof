import { Bell, BellOff, Eye, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ios';
import { AgentAvatarTile } from './AgentAvatarTile';
import { AgentSelectionGlow } from './AgentSelectionGlow';
import { getAgentColorPair, DEFAULT_AGENT_COLOR } from '@/utils/agentColors';
import { formatNetUnits, formatRecord } from '@/types/agent';
import type { FollowedAgentDetailed } from '@/hooks/useFollowedAgents';

interface FollowingAgentCardProps {
  agent: FollowedAgentDetailed;
  isSelected: boolean;
  onSelect: (avatarId: string) => void;
  onToggleFavorite: () => void;
  onToggleNotify: () => void;
}

/**
 * Spectator-only card for a followed agent — no generate/run/autopilot.
 * Star/bell mutate only is_favorite / notify_on_pick on the caller's follow row.
 */
export function FollowingAgentCard({
  agent,
  isSelected,
  onSelect,
  onToggleFavorite,
  onToggleNotify,
}: FollowingAgentCardProps) {
  const perf = agent.performance;
  const [primary, secondary] = getAgentColorPair(agent.avatar_color || DEFAULT_AGENT_COLOR);
  const netUnits = perf ? formatNetUnits(perf.net_units) : '+0.00u';
  const isPositive = (perf?.net_units ?? 0) >= 0;

  return (
    <GlassCard
      interactive
      role="button"
      tabIndex={0}
      onClick={() => onSelect(agent.avatar_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(agent.avatar_id);
        }
      }}
      className="relative overflow-hidden p-3.5"
    >
      {isSelected && <AgentSelectionGlow primary={primary} secondary={secondary} />}

      <div className="relative flex items-center gap-3">
        <AgentAvatarTile
          agentId={agent.avatar_id}
          emoji={agent.avatar_emoji}
          color={agent.avatar_color}
          size={44}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-bold text-foreground">{agent.name}</p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-500">
              <Eye className="h-2.5 w-2.5" />
              Following
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2.5 text-xs font-semibold">
            <span className="text-muted-foreground">{formatRecord(perf)}</span>
            <span className={isPositive ? 'text-emerald-500' : 'text-red-500'}>{netUnits}</span>
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label={agent.is_favorite ? 'Unfavorite' : 'Favorite'}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onToggleFavorite}
          >
            <Star
              className={cn('h-4 w-4', agent.is_favorite && 'fill-amber-500 text-amber-500')}
            />
          </button>
          <button
            type="button"
            aria-label={agent.notify_on_pick ? 'Mute pick notifications' : 'Notify on picks'}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onToggleNotify}
          >
            {agent.notify_on_pick ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
