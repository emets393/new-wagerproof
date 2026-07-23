import * as React from 'react';
import { Copy, Eye, Flame, Snowflake, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ios';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SectionHeader } from '@/features/outliers/components/SectionHeader';
import { useUnfollowAgent, type FollowedAgentDetailed } from '@/hooks/useFollowedAgents';
import { formatRecord } from '@/types/agent';
import { hasFreshAgentPicks } from '@/utils/agentPicksSeen';
import { AgentAvatarTile } from './AgentAvatarTile';
import { AgentFormChart } from './AgentListCard';

interface FollowingRailProps {
  agents: FollowedAgentDetailed[];
  selectedId: string | null;
  onSelect: (agentId: string) => void;
  onCopy: (agentId: string) => void;
}

function StreakMarker({ streak }: { streak: number }) {
  if (Math.abs(streak) < 5) return null;
  const winning = streak > 0;
  const Icon = winning ? Flame : Snowflake;
  return (
    <span
      className={cn(
        'absolute -left-2 top-1/2 z-10 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-full border bg-black/85 px-1.5 py-1 text-[10px] font-black text-white shadow-lg',
        winning
          ? 'border-orange-500/80 shadow-orange-500/25'
          : 'border-sky-400/80 shadow-sky-400/25',
      )}
      aria-label={`${Math.abs(streak)} pick ${winning ? 'winning' : 'losing'} streak`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(streak)}
    </span>
  );
}

export function FollowingRail({ agents, selectedId, onSelect, onCopy }: FollowingRailProps) {
  const [open, setOpen] = React.useState(false);
  const unfollow = useUnfollowAgent();

  const remove = (agent: FollowedAgentDetailed) => {
    unfollow.mutate(agent.avatar_id, {
      onSuccess: () => toast.success(`Unfollowed ${agent.name}`),
      onError: () => toast.error("Couldn't unfollow this agent"),
    });
  };

  if (agents.length === 0) return null;

  return (
    <>
      <section className="group space-y-2.5 pt-1">
        <SectionHeader
          title="Following"
          icon={<Users />}
          action={{ kind: 'link', label: 'See All', onClick: () => setOpen(true) }}
        />
        <div className="-mx-1 overflow-x-auto px-1 pb-2 pt-1 scrollbar-transparent">
          <div className="flex min-w-max gap-3">
            {agents.map((agent) => {
              const streak = agent.performance?.current_streak ?? 0;
              const fresh = hasFreshAgentPicks(agent.avatar_id, agent.last_generated_at);
              return (
                <button
                  key={agent.avatar_id}
                  type="button"
                  onClick={() => onSelect(agent.avatar_id)}
                  className="group/avatar flex w-[76px] flex-col items-center gap-1.5 rounded-2xl py-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="relative">
                    <AgentAvatarTile
                      agentId={agent.avatar_id}
                      spriteIndexOverride={agent.sprite_index}
                      emoji={agent.avatar_emoji}
                      color={agent.avatar_color}
                      size={58}
                      className={cn(
                        'transition-transform duration-150 group-hover/avatar:-translate-y-0.5',
                        selectedId === agent.avatar_id && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                      )}
                    />
                    {fresh && (
                      <span
                        className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-[#00E676]"
                        aria-label="New picks"
                      />
                    )}
                    <StreakMarker streak={streak} />
                  </span>
                  <span className="w-full truncate text-[11px] font-semibold text-foreground">
                    {agent.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border/60 px-5 py-4">
            <SheetTitle className="text-lg font-extrabold">Following</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
            {agents.map((agent) => (
              <GlassCard
                key={agent.avatar_id}
                interactive
                role="button"
                tabIndex={0}
                onClick={() => {
                  setOpen(false);
                  onSelect(agent.avatar_id);
                }}
                className="p-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <AgentAvatarTile
                      agentId={agent.avatar_id}
                      spriteIndexOverride={agent.sprite_index}
                      emoji={agent.avatar_emoji}
                      color={agent.avatar_color}
                      size={48}
                    />
                    {hasFreshAgentPicks(agent.avatar_id, agent.last_generated_at) && (
                      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-[#00E676]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-foreground">{agent.name}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {agent.preferred_sports.map((sport) => sport.toUpperCase()).join(' · ')}
                      {' · '}
                      {formatRecord(agent.performance)}
                    </p>
                  </div>
                  <AgentFormChart performance={agent.performance} />
                </div>
                <div
                  className="mt-3 grid grid-cols-3 gap-1 border-t border-border/50 pt-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      setOpen(false);
                      onSelect(agent.avatar_id);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" /> Details
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-primary hover:bg-primary/10"
                    onClick={() => {
                      setOpen(false);
                      onCopy(agent.avatar_id);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10"
                    disabled={unfollow.isPending}
                    onClick={() => remove(agent)}
                  >
                    <UserMinus className="h-3.5 w-3.5" /> Unfollow
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
