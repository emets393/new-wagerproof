import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from '@/components/ios';
import { AgentAvatarTile } from './AgentAvatarTile';
import { StreakBadge } from './StreakBadge';
import { getPrimaryColor, DEFAULT_AGENT_COLOR } from '@/utils/agentColors';
import { getPersonalityPills } from '@/utils/agentPersonality';
import { AgentWithPerformance, formatRecord } from '@/types/agent';

interface AgentListCardProps {
  agent: AgentWithPerformance;
  isSelected: boolean;
  onSelect: (agentId: string) => void;
  onToggleActive?: (agentId: string, checked: boolean) => void;
  isTogglePending?: boolean;
}

/**
 * iOS AgentRowCard for the split-view list: glass card with avatar tile +
 * name + personality chips, streak badge, then a divider and the
 * sports | record | win% info row. Autopilot switch preserved from the
 * legacy AgentCard (stopPropagation so toggling never selects).
 */
export function AgentListCard({
  agent,
  isSelected,
  onSelect,
  onToggleActive,
  isTogglePending = false,
}: AgentListCardProps) {
  const [pulseAnimation, setPulseAnimation] = useState<object | null>(null);
  const perf = agent.performance;
  const primary = getPrimaryColor(agent.avatar_color || DEFAULT_AGENT_COLOR);
  const pills = getPersonalityPills(agent.personality_params).slice(0, 2);
  const winRate = perf?.win_rate != null ? perf.win_rate * 100 : null;
  const isAutopilotOn = agent.is_active && agent.auto_generate;

  useEffect(() => {
    let alive = true;
    fetch('/pulselottie.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data) setPulseAnimation(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <GlassCard
      interactive
      role="button"
      tabIndex={0}
      onClick={() => onSelect(agent.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(agent.id);
        }
      }}
      className={cn('relative p-4', isSelected && 'ring-2')}
      style={isSelected ? ({ ['--tw-ring-color' as string]: `${primary}80` } as React.CSSProperties) : undefined}
    >
      {/* Identity row */}
      <div className="flex items-start gap-3">
        <AgentAvatarTile
          agentId={agent.id}
          spriteIndexOverride={(agent as any).sprite_index}
          emoji={agent.avatar_emoji}
          color={agent.avatar_color}
          size={52}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[16px] font-bold text-foreground">{agent.name}</p>
            {agent.is_active && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#10B981]" title="Active" />
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {pills.map((pill) => (
              <span
                key={pill}
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: `${primary}1f`, color: primary }}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <StreakBadge streak={perf?.current_streak ?? 0} />
        </div>
      </div>

      {/* Autopilot control (never selects the card) */}
      <div
        className="mt-3 flex items-center justify-between"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          {isAutopilotOn ? (
            <>
              <span className="text-[11px] font-semibold text-emerald-500">Autopilot Active</span>
              {pulseAnimation ? (
                <span className="h-6 w-6">
                  <Lottie animationData={pulseAnimation} loop autoplay style={{ width: 24, height: 24 }} />
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-[11px] font-medium text-muted-foreground">
              {agent.auto_generate ? 'Autopilot Ready' : 'Manual Mode'}
            </span>
          )}
        </div>
        <Switch
          checked={agent.is_active}
          disabled={isTogglePending}
          onCheckedChange={(checked) => onToggleActive?.(agent.id, checked)}
        />
      </div>

      {/* Divider + info row */}
      <div className="mt-3 border-t border-black/5 dark:border-white/10" />
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          {agent.preferred_sports.slice(0, 3).map((sport) => (
            <Badge key={sport} variant="outline" className="h-5 px-1.5 text-[10px]">
              {sport.toUpperCase()}
            </Badge>
          ))}
          {agent.preferred_sports.length > 3 && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              +{agent.preferred_sports.length - 3}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[12px] font-bold">
          <span className="text-muted-foreground">{formatRecord(perf)}</span>
          {winRate !== null && (
            <span className={winRate >= 50 ? 'text-emerald-500' : 'text-red-500'}>
              {winRate.toFixed(0)}%
            </span>
          )}
          <span className="flex items-center gap-0.5 font-sans text-[11px] font-medium text-muted-foreground">
            <Activity className="h-3 w-3" />
            {perf?.total_picks || 0}
          </span>
        </div>
      </div>
    </GlassCard>
  );
}
