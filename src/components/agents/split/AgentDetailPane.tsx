import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bot, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { GlassCard, SkeletonBlock, SkeletonCircle, TeamAura, WidgetCard } from '@/components/ios';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AgentGenerationTerminal, AgentPerformanceCharts, AgentRecentActivity } from '@/components/agents';
import { AgentDetailHero } from './AgentDetailHero';
import { AgentPicksSection, AgentTodaysPicksSection, type AgentHistoryItem } from './AgentPicksSection';
import { useAgent } from '@/hooks/useAgents';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import { useAgentFollow } from '@/hooks/useAgentFollow';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getAgentColorPair, DEFAULT_AGENT_COLOR } from '@/utils/agentColors';
import { BarChart3 } from 'lucide-react';
import type { AgentGenerationState } from './generationState';

interface AgentDetailPaneProps {
  agentId: string | null;
  generation?: AgentGenerationState;
  onGenerate: (agentId: string) => void;
  onClearSelection: () => void;
  onSelectAgent?: (agentId: string) => void;
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
  onSelectAgent,
  selectedTicketId,
  onSelectTicket,
}: AgentDetailPaneProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: agent, isLoading } = useAgent(agentId ?? undefined);
  const { canViewAgentPicks, isPro, isAdmin } = useAgentEntitlements();

  const isOwner = !!agent && agent.user_id === user?.id;
  const canSeePicks = canViewAgentPicks || isOwner;
  const follow = useAgentFollow(agentId ?? undefined, { enabled: !!agent && !isOwner });

  const [copyConfirmOpen, setCopyConfirmOpen] = React.useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = React.useState(false);
  const [copyPending, setCopyPending] = React.useState(false);

  const runCopyBuild = React.useCallback(async () => {
    if (!user?.id || !agentId) {
      toast.error('Sign in to copy this agent');
      return;
    }
    setCopyPending(true);
    try {
      const { data: newAgentId, error } = await (supabase as any).rpc('clone_public_agent', {
        p_source_avatar_id: agentId,
      });

      if (error) {
        const msg = error.message || '';
        if (msg.includes('agent_limit_reached')) {
          setLimitDialogOpen(true);
        } else if (msg.includes('source_not_found_or_not_public')) {
          toast.error('This agent is no longer available');
        } else {
          toast.error("Couldn't copy this agent, try again.");
        }
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['agents', 'user', user.id] });
      const nextId = String(newAgentId);
      if (onSelectAgent) {
        onSelectAgent(nextId);
      } else {
        navigate(`/agents?selected=${nextId}&tab=mine`, { replace: true });
      }
    } catch {
      toast.error("Couldn't copy this agent, try again.");
    } finally {
      setCopyPending(false);
      setCopyConfirmOpen(false);
    }
  }, [user?.id, agentId, queryClient, onSelectAgent, navigate]);

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
          onCopyBuild={() => setCopyConfirmOpen(true)}
          copyPending={copyPending}
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

      <AlertDialog open={copyConfirmOpen} onOpenChange={setCopyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copy build</AlertDialogTitle>
            <AlertDialogDescription>
              This creates YOUR OWN copy of this agent — same brain and settings, but a fresh 0-0
              record. It won&apos;t share the original&apos;s picks or history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={copyPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={copyPending}
              onClick={(event) => {
                event.preventDefault();
                void runCopyBuild();
              }}
            >
              {copyPending ? 'Copying…' : 'Copy build'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Agent limit reached</AlertDialogTitle>
            <AlertDialogDescription>
              {isAdmin || isPro
                ? 'Pro users can have up to 30 total agents. If all 10 live auto-agent slots are full, new agents start in manual mode.'
                : 'Free users can have 1 active agent. Upgrade to Pro for more.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            {!isPro && !isAdmin && (
              <AlertDialogAction onClick={() => navigate('/access-denied')}>
                Upgrade
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
