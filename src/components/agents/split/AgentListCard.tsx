import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import {
  Activity,
  Ellipsis,
  Info,
  PauseCircle,
  Pin,
  PinOff,
  PlayCircle,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlassCard } from '@/components/ios';
import { AgentAvatarTile } from './AgentAvatarTile';
import { AgentSelectionGlow } from './AgentSelectionGlow';
import { getAgentColorPair, DEFAULT_AGENT_COLOR } from '@/utils/agentColors';
import { getPersonalityPills } from '@/utils/agentPersonality';
import { AgentPerformance, AgentWithPerformance, formatRecord } from '@/types/agent';

interface AgentListCardProps {
  agent: AgentWithPerformance;
  isSelected: boolean;
  onSelect: (agentId: string) => void;
  onToggleActive?: (agentId: string, checked: boolean) => void;
  onTogglePinned?: (agentId: string, pinned: boolean) => void;
  onEdit?: (agentId: string) => void;
  onDelete?: (agentId: string) => void;
  isTogglePending?: boolean;
}

function formBuckets(performance: AgentPerformance | null): Array<{ wins: number; losses: number }> {
  if (!performance) return [];
  const wins = performance.wins;
  const losses = performance.losses;
  const total = wins + losses;
  if (total <= 0) return [];

  // Stable FNV-1a seed + LCG, mirroring the native card's deterministic
  // distribution. The totals are real; only their recent-day grouping is
  // synthesized until the list query carries daily grading dates.
  let state = 0x811c9dc5;
  for (let index = 0; index < performance.avatar_id.length; index += 1) {
    state ^= performance.avatar_id.charCodeAt(index);
    state = Math.imul(state, 0x01000193) >>> 0;
  }
  state |= 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };

  const sequence = [
    ...Array.from({ length: wins }, () => true),
    ...Array.from({ length: losses }, () => false),
  ];
  for (let index = sequence.length - 1; index > 0; index -= 1) {
    const swapIndex = next() % (index + 1);
    [sequence[index], sequence[swapIndex]] = [sequence[swapIndex], sequence[index]];
  }

  const bucketCount = Math.min(7, Math.max(3, Math.floor(total / 4)));
  const buckets = Array.from({ length: bucketCount }, () => ({ wins: 0, losses: 0 }));
  sequence.forEach((win, index) => {
    const bucket = Math.floor((index * bucketCount) / sequence.length);
    if (win) buckets[bucket].wins += 1;
    else buckets[bucket].losses += 1;
  });
  return buckets;
}

export function AgentFormChart({ performance }: { performance: Pick<AgentPerformance, 'avatar_id' | 'wins' | 'losses' | 'current_streak'> | null }) {
  const buckets = formBuckets(performance);
  const streak = performance?.current_streak ?? 0;
  const maxTotal = Math.max(1, ...buckets.map((bucket) => bucket.wins + bucket.losses));
  const streakClass = streak > 0
    ? 'bg-emerald-500/[0.14] text-emerald-500'
    : streak < 0
      ? 'bg-red-500/[0.14] text-red-500'
      : 'bg-muted text-muted-foreground';

  return (
    <div className="flex h-[50px] w-24 shrink-0 flex-col items-end gap-1.5">
      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none', streakClass)}>
        Streak <strong className="font-black">{streak === 0 ? '—' : streak > 0 ? `W${streak}` : `L${Math.abs(streak)}`}</strong>
      </span>
      {buckets.length === 0 ? (
        <div className="flex h-7 w-full items-center">
          <div className="w-full border-t-2 border-dotted border-muted-foreground/40" />
        </div>
      ) : (
        <div className="flex h-7 items-end gap-[3px]" aria-label="Recent win and loss form">
          {buckets.map((bucket, index) => {
            const total = bucket.wins + bucket.losses;
            const totalHeight = (total / maxTotal) * 28;
            const winHeight = total > 0 ? (bucket.wins / total) * totalHeight : 0;
            const lossHeight = totalHeight - winHeight;
            return (
              <div key={index} className="flex h-7 w-2 flex-col justify-end gap-px">
                {bucket.losses > 0 && (
                  <span className="w-2 rounded-sm bg-red-500" style={{ height: Math.max(2, lossHeight) }} />
                )}
                {bucket.wins > 0 && (
                  <span className="w-2 rounded-sm bg-emerald-500" style={{ height: Math.max(2, winHeight) }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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
  onTogglePinned,
  onEdit,
  onDelete,
  isTogglePending = false,
}: AgentListCardProps) {
  const [pulseAnimation, setPulseAnimation] = useState<object | null>(null);
  const perf = agent.performance;
  const [primary, secondary] = getAgentColorPair(agent.avatar_color || DEFAULT_AGENT_COLOR);
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
      className={cn('relative overflow-hidden p-3.5')}
    >
      {isSelected && <AgentSelectionGlow primary={primary} secondary={secondary} />}

      <div className="relative">
      {/* Identity row */}
      <div className="flex items-start gap-3">
        <AgentAvatarTile
          agentId={agent.id}
          spriteIndexOverride={(agent as any).sprite_index}
          emoji={agent.avatar_emoji}
          color={agent.avatar_color}
          size={48}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[15px] font-bold text-foreground">{agent.name}</p>
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

        <AgentFormChart performance={perf} />
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

      {/* Autopilot sits below sports + record and never selects the card. */}
      <div
        className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 dark:border-white/10"
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
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`More actions for ${agent.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Ellipsis className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem
                className="gap-2 rounded-lg"
                disabled={isTogglePending}
                onSelect={() => onToggleActive?.(agent.id, !agent.is_active)}
              >
                {agent.is_active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                {agent.is_active ? 'Pause' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 rounded-lg"
                onSelect={() => onTogglePinned?.(agent.id, !agent.is_widget_favorite)}
              >
                {agent.is_widget_favorite ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {agent.is_widget_favorite ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-lg" onSelect={() => onEdit?.(agent.id)}>
                <SlidersHorizontal className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-lg" onSelect={() => onSelect(agent.id)}>
                <Info className="h-4 w-4" />
                Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive"
                onSelect={() => onDelete?.(agent.id)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Switch
            checked={agent.is_active}
            disabled={isTogglePending}
            onCheckedChange={(checked) => onToggleActive?.(agent.id, checked)}
          />
        </div>
      </div>
      </div>
    </GlassCard>
  );
}
