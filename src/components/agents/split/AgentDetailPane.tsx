import { useNavigate } from 'react-router-dom';
import { Bot, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GlassCard, SkeletonBlock, SkeletonCircle, TeamAura, WidgetCard } from '@/components/ios';
import { AgentGenerationTerminal, AgentPerformanceCharts, AgentRecentActivity } from '@/components/agents';
import { AgentDetailHero } from './AgentDetailHero';
import { AgentPicksSection, AgentTodaysPicksSection, type AgentHistoryItem } from './AgentPicksSection';
import { useAgent } from '@/hooks/useAgents';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import { useAgentFollow } from '@/hooks/useAgentFollow';
import { useAuth } from '@/contexts/AuthContext';
import { getAgentColorPair, DEFAULT_AGENT_COLOR } from '@/utils/agentColors';
import { BarChart3 } from 'lucide-react';
import type { AgentGenerationState } from './generationState';

interface AgentDetailPaneProps {
  agentId: string | null;
  generation?: AgentGenerationState;
  onGenerate: (agentId: string) => void;
  onClearSelection: () => void;
  selectedTicketId: string | null;
  onSelectTicket: (item: AgentHistoryItem, accent?: string) => void;
}

function HeroSkeleton() {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start gap-4">
        <SkeletonCircle diameter={72} />
        <div className="flex-1 space-y-2">
          <SkeletonBlock width={180} height={20} />
          <SkeletonBlock width={120} height={12} />
          <SkeletonBlock width={220} height={12} />
        </div>
        <div className="grid w-[240px] grid-cols-2 gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBlock key={i} height={54} radius={16} />
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

/**
 * Right pane of the /agents split view — unifies the legacy AgentDetail
 * (owner) and PublicAgentDetail pages: ownership is resolved client-side
 * (RLS already permits reading any public agent by id).
 */
export function AgentDetailPane({
  agentId,
  generation,
  onGenerate,
  onClearSelection,
  selectedTicketId,
  onSelectTicket,
}: AgentDetailPaneProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: agent, isLoading } = useAgent(agentId ?? undefined);
  const { canViewAgentPicks } = useAgentEntitlements();

  const isOwner = !!agent && agent.user_id === user?.id;
  const canSeePicks = canViewAgentPicks || isOwner;
  const follow = useAgentFollow(agentId ?? undefined, { enabled: !!agent && !isOwner });

  if (!agentId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Bot className="h-9 w-9 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-muted-foreground">
            Select an agent to see its profile and picks
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <HeroSkeleton />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <GlassCard className="flex flex-col items-center gap-3 px-8 py-10 text-center">
          <Lock className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Agent not found or private</p>
          <Button variant="outline" size="sm" className="rounded-full" onClick={onClearSelection}>
            Back to list
          </Button>
        </GlassCard>
      </div>
    );
  }

  const [primary, secondary] = getAgentColorPair(agent.avatar_color || DEFAULT_AGENT_COLOR);
  const showTerminal = isOwner && generation && generation.status !== 'idle';

  return (
    <div className="relative h-full overflow-y-auto">
      {/* Same team-color aura the /games detail pane uses, seeded from the
          agent's two-tone color pair instead of two team colors. */}
      <TeamAura awayColor={primary} homeColor={secondary} />

      <motion.div
        key={agent.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative mx-auto max-w-3xl space-y-3 p-4 pb-10"
      >
        <AgentDetailHero
          agent={agent}
          isOwner={isOwner}
          canSeeNetUnits={canSeePicks}
          isFollowing={follow.isFollowing}
          followPending={follow.togglePending}
          onToggleFollow={follow.toggleFollow}
          onGenerate={() => onGenerate(agent.id)}
          generateDisabled={generation?.status === 'generating'}
          onOpenSettings={() => navigate(`/agents/${agent.id}/settings`)}
          onCopyBuild={() => navigate(`/agents/create?copy=${agent.id}`)}
        />

        {showTerminal && (
          <AgentGenerationTerminal
            status={generation.status}
            errorMessage={generation.error}
            result={generation.result}
            progress={generation.progress}
            accent={primary}
          />
        )}

        {/* Widgets render on the /games detail-pane slate surface (light mode)
            via the shared tint vars, so both pages read as one product.
            See src/features/games/detail/WIDGET_DESIGN.md. */}
        <div className="space-y-3 [--widget-card-bg:rgba(241,245,249,0.92)] [--widget-card-border:rgba(15,23,42,0.1)]">
          {canSeePicks && (
            <AgentTodaysPicksSection
              agentId={agent.id}
              accent={primary}
              selectedTicketId={selectedTicketId}
              onSelectTicket={(item) => onSelectTicket(item, primary)}
            />
          )}

          {canSeePicks ? (
            <AgentPerformanceCharts agent={agent} />
          ) : (
            <WidgetCard
              icon={<BarChart3 />}
              title="Performance"
              subtitle="How this agent's graded picks have paid out to date."
            >
              <div className="flex flex-col items-center gap-2 py-6">
                <Lock className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Upgrade to Pro to view performance charts
                </p>
              </div>
            </WidgetCard>
          )}

          <AgentRecentActivity agent={agent} />

          <AgentPicksSection
            agentId={agent.id}
            canSeePicks={canSeePicks}
            accent={primary}
            selectedTicketId={selectedTicketId}
            onSelectTicket={(item) => onSelectTicket(item, primary)}
          />
        </div>
      </motion.div>

    </div>
  );
}
