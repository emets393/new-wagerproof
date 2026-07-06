import { Globe, Settings, Sparkles, UserMinus, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ios';
import { AgentAvatarTile } from './AgentAvatarTile';
import { AgentStatTile } from './AgentStatTile';
import { getPersonalityPills } from '@/utils/agentPersonality';
import { getAgentColorPair, DEFAULT_AGENT_COLOR } from '@/utils/agentColors';
import {
  AgentWithPerformance,
  formatNetUnits,
  formatRecord,
  formatStreak,
} from '@/types/agent';

interface AgentDetailHeroProps {
  agent: AgentWithPerformance;
  isOwner: boolean;
  canSeeNetUnits: boolean;
  isFollowing: boolean;
  followPending: boolean;
  onToggleFollow: () => void;
  onGenerate: () => void;
  generateDisabled: boolean;
  onOpenSettings: () => void;
}

/**
 * iOS-style agent hero: agent-color gradient field behind a glass card, big
 * avatar + name + pills on the left, 2×2 stat quadrant on the right, action
 * row (Generate/Settings for owners, Follow for visitors) below.
 */
export function AgentDetailHero({
  agent,
  isOwner,
  canSeeNetUnits,
  isFollowing,
  followPending,
  onToggleFollow,
  onGenerate,
  generateDisabled,
  onOpenSettings,
}: AgentDetailHeroProps) {
  const perf = agent.performance;
  const [primary, secondary] = getAgentColorPair(agent.avatar_color || DEFAULT_AGENT_COLOR);
  const pills = getPersonalityPills(agent.personality_params);

  return (
    <GlassCard className="relative overflow-hidden">
      {/* Agent-color field (web stand-in for the iOS pixel-wave background) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 8% 0%, ${primary}2e 0%, transparent 60%), radial-gradient(120% 90% at 92% 100%, ${secondary}26 0%, transparent 62%)`,
        }}
      />

      <div className="relative flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <AgentAvatarTile
              agentId={agent.id}
              spriteIndexOverride={(agent as any).sprite_index}
              emoji={agent.avatar_emoji}
              color={agent.avatar_color}
              size={72}
            />
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-[22px] font-bold leading-tight text-foreground">
                <span className="truncate">{agent.name}</span>
                {agent.is_active && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#10B981]" title="Active" />
                )}
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                {agent.preferred_sports.map((s) => s.toUpperCase()).join(' · ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {agent.is_public && (
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Globe className="h-3 w-3" /> Public
                  </Badge>
                )}
                {pills.map((pill) => (
                  <Badge
                    key={pill}
                    variant="outline"
                    className="text-[10px]"
                    style={{ borderColor: `${primary}40`, color: primary }}
                  >
                    {pill}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-[240px]">
            <AgentStatTile label="Record" value={formatRecord(perf)} />
            <AgentStatTile
              label="Net Units"
              value={formatNetUnits(perf?.net_units ?? 0)}
              locked={!canSeeNetUnits}
              positive={(perf?.net_units ?? 0) >= 0}
              negative={(perf?.net_units ?? 0) < 0}
            />
            <AgentStatTile
              label="Win Rate"
              value={perf?.win_rate ? `${(perf.win_rate * 100).toFixed(1)}%` : '--'}
            />
            <AgentStatTile label="Streak" value={formatStreak(perf?.current_streak ?? 0)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOwner ? (
            <>
              <Button size="sm" className="rounded-full" onClick={onGenerate} disabled={generateDisabled}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {generateDisabled ? 'Generating…' : 'Generate Picks'}
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={onOpenSettings}>
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Settings
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant={isFollowing ? 'outline' : 'default'}
              className="rounded-full"
              onClick={onToggleFollow}
              disabled={followPending}
            >
              {isFollowing ? (
                <>
                  <UserMinus className="mr-1.5 h-3.5 w-3.5" /> Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Follow
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
