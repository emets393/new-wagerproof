import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { AnnouncementsBanner } from '@/components/AnnouncementsBanner';
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
import { AgentsListPanel, type AgentsSegment } from '@/components/agents/split/AgentsListPanel';
import { AgentDetailPane } from '@/components/agents/split/AgentDetailPane';
import { TicketDetailPane } from '@/components/agents/split/TicketDetailPane';
import { AgentsAvatarRail, type AgentRailItem } from '@/components/agents/split/AgentsAvatarRail';
import type { AgentHistoryItem } from '@/components/agents/split/AgentPicksSection';
import {
  clearActiveGeneration,
  loadActiveGenerations,
  persistActiveGeneration,
  subscribeToActiveGenerations,
  type GenerationByAgent,
} from '@/components/agents/split/generationState';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import {
  useAgentLeaderboard,
  useDeleteAgent,
  useGenerateAgentPicks,
  useUpdateAgent,
  useUserAgents,
} from '@/hooks/useAgents';
import { useFollowedAgentsDetailed } from '@/hooks/useFollowedAgents';
import type {
  LeaderboardSortMode,
  LeaderboardTimeframe,
} from '@/services/agentPerformanceService';
import { Sport } from '@/types/agent';

/**
 * /agents — iOS-style split view. Left: My Agents / Leaderboard feed with
 * filter pills. Right: unified AgentDetailPane (owner + public). Selection
 * and segment live in the URL (?selected, ?tab) so legacy /agents/:id links
 * redirect in cleanly and mobile back works.
 */
export default function Agents() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useIsDesktopSplit();

  const selectedId = searchParams.get('selected');
  const tabParam = searchParams.get('tab');

  const [sportFilter, setSportFilter] = React.useState<Sport | 'all'>('all');
  const [sortMode, setSortMode] = React.useState<LeaderboardSortMode>('overall');
  const [excludeUnder10Picks, setExcludeUnder10Picks] = React.useState(false);
  const [timeframe, setTimeframe] = React.useState<LeaderboardTimeframe>('all_time');
  const [togglePendingId, setTogglePendingId] = React.useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  // Lifted per-agent generation state: the polling promise runs up to 5 min,
  // so it must survive switching selection (see generationState.ts).
  const [generationByAgent, setGenerationByAgent] = React.useState<GenerationByAgent>(loadActiveGenerations);
  const [selectedTicket, setSelectedTicket] = React.useState<{
    item: AgentHistoryItem;
    accent?: string;
  } | null>(null);

  const { data: agents, isLoading: agentsLoading, error: agentsError } = useUserAgents();
  const { data: followedAgents = [] } = useFollowedAgentsDetailed();
  const {
    data: leaderboard,
    isLoading: leaderboardLoading,
    error: leaderboardError,
    refetch: refetchLeaderboard,
  } = useAgentLeaderboard(
    sportFilter === 'all' ? undefined : sportFilter,
    sortMode,
    excludeUnder10Picks,
    timeframe
  );
  const updateAgentMutation = useUpdateAgent();
  const deleteAgentMutation = useDeleteAgent();
  const generateMutation = useGenerateAgentPicks();
  const { canCreateAnotherAgent, isAdmin, maxActiveAgents, maxTotalAgents } =
    useAgentEntitlements();

  React.useEffect(() => subscribeToActiveGenerations((active) => {
    setGenerationByAgent((previous) => {
      const next = { ...previous };
      for (const [agentId, state] of Object.entries(next)) {
        if (state.status === 'generating' && !active[agentId]) delete next[agentId];
      }
      for (const [agentId, state] of Object.entries(active)) next[agentId] = state;
      return next;
    });
  }), []);

  const totalCount = agents?.length || 0;
  const activeCount = agents?.filter((a) => a.is_active).length || 0;
  const canCreateMore = canCreateAnotherAgent(activeCount, totalCount);
  const followedIdSet = React.useMemo(
    () => new Set(followedAgents.map((f) => f.avatar_id)),
    [followedAgents]
  );

  // Segment: explicit ?tab wins; else infer from whether the selection is mine
  // or a followed agent (stay on My Agents) vs a leaderboard public agent.
  const isSelectedMine = !!selectedId && !!agents?.some((a) => a.id === selectedId);
  const isSelectedFollowed = !!selectedId && followedIdSet.has(selectedId);
  const segment: AgentsSegment =
    tabParam === 'leaderboard' || tabParam === 'mine' || tabParam === 'topPicks'
      ? tabParam
      : selectedId && agents && !isSelectedMine && !isSelectedFollowed
        ? 'leaderboard'
        : 'mine';

  const setSegment = (next: AgentsSegment) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('tab', next);
        return params;
      },
      { replace: true }
    );
  };

  const selectAgent = React.useCallback(
    (id: string | null, options?: { replace?: boolean; tab?: AgentsSegment }) => {
      setSelectedTicket(null);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (id) params.set('selected', id);
          else params.delete('selected');
          if (options?.tab) params.set('tab', options.tab);
          return params;
        },
        { replace: options?.replace ?? false }
      );
    },
    [setSearchParams]
  );

  // Desktop auto-select: first of my agents, else leaderboard #1. Never on
  // mobile — deep-linking /agents on a phone must land on the list.
  React.useEffect(() => {
    if (!isDesktop || selectedId) return;
    if (agentsLoading) return;
    const candidate = agents?.[0]?.id ?? leaderboard?.[0]?.avatar_id;
    if (candidate) selectAgent(candidate, { replace: true });
  }, [isDesktop, selectedId, agentsLoading, agents, leaderboard, selectAgent]);

  const handleToggleActive = async (agentId: string, checked: boolean) => {
    if (togglePendingId === agentId || updateAgentMutation.isPending) return;
    setTogglePendingId(agentId);
    try {
      await updateAgentMutation.mutateAsync({
        agentId,
        data: { is_active: checked, auto_generate: checked },
      });
    } finally {
      setTogglePendingId(null);
    }
  };

  const handleGenerate = async (agentId: string) => {
    const initialState = { status: 'generating' as const, error: null, result: null, progress: null };
    setGenerationByAgent((prev) => ({ ...prev, [agentId]: initialState }));
    persistActiveGeneration(agentId, initialState);
    try {
      const result = await generateMutation.mutateAsync({
        agentId,
        isAdmin,
        onProgress: (progress) => {
          const runningState = { status: 'generating' as const, error: null, result: null, progress };
          setGenerationByAgent((prev) => ({ ...prev, [agentId]: runningState }));
          persistActiveGeneration(agentId, runningState);
        },
      });
      clearActiveGeneration(agentId);
      setGenerationByAgent((prev) => ({
        ...prev,
        [agentId]: { status: 'success', error: null, result, progress: prev[agentId]?.progress ?? null },
      }));
    } catch (err: any) {
      clearActiveGeneration(agentId);
      setGenerationByAgent((prev) => ({
        ...prev,
        [agentId]: { status: 'error', error: err?.message || 'Failed to generate picks.', result: null, progress: prev[agentId]?.progress ?? null },
      }));
    }
  };

  const handleTogglePinned = async (agentId: string, pinned: boolean) => {
    await updateAgentMutation.mutateAsync({
      agentId,
      data: { is_widget_favorite: pinned },
    });
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId || deleteAgentMutation.isPending) return;
    const deletingId = pendingDeleteId;
    await deleteAgentMutation.mutateAsync(deletingId);
    setPendingDeleteId(null);
    if (selectedId === deletingId) selectAgent(null, { replace: true });
  };

  const pendingDeleteAgent = agents?.find((agent) => agent.id === pendingDeleteId) ?? null;
  const selectedTicketId = selectedTicket
    ? selectedTicket.item.kind === 'pick'
      ? selectedTicket.item.pick.id
      : selectedTicket.item.parlay.id
    : null;
  const railItems = React.useMemo<AgentRailItem[]>(() => {
    if (segment === 'leaderboard') {
      return (leaderboard ?? []).map((entry) => ({
        id: entry.avatar_id,
        name: entry.name,
        color: entry.avatar_color,
        emoji: entry.avatar_emoji,
        spriteIndex: entry.sprite_index,
      }));
    }
    return (agents ?? [])
      .filter((agent) => sportFilter === 'all' || agent.preferred_sports.includes(sportFilter))
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        color: agent.avatar_color,
        emoji: agent.avatar_emoji,
        spriteIndex: agent.sprite_index,
      }));
  }, [agents, leaderboard, segment, sportFilter]);
  const agentDetail = (
    <AgentDetailPane
      agentId={selectedId}
      generation={selectedId ? generationByAgent[selectedId] : undefined}
      onGenerate={handleGenerate}
      onClearSelection={() => selectAgent(null)}
      onSelectAgent={(id) => selectAgent(id, { replace: true, tab: 'mine' })}
      selectedTicketId={selectedTicketId}
      onSelectTicket={(item, accent) => setSelectedTicket({ item, accent })}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AnnouncementsBanner />
      <div className="min-h-0 flex-1">
        {selectedTicket ? (
          <div className="flex h-full min-h-0">
            {isDesktop && (
              <AgentsAvatarRail
                items={railItems}
                selectedId={selectedId}
                onExpand={() => setSelectedTicket(null)}
                onSelect={(id) => selectAgent(id)}
              />
            )}
            <div className="min-w-0 flex-1">
              <SplitViewLayout
            storageId="wagerproof-agent-ticket-split"
            showDetailOnMobile
            onBackFromDetail={() => setSelectedTicket(null)}
            detailBackLabel="Agent"
            listDefaultSize={54}
            listMinSize={42}
            listMaxSize={65}
            list={agentDetail}
            detail={
              <TicketDetailPane
                item={selectedTicket.item}
                accent={selectedTicket.accent}
                onClose={() => setSelectedTicket(null)}
              />
            }
              />
            </div>
          </div>
        ) : (
          <SplitViewLayout
            storageId="wagerproof-agents-split"
            showDetailOnMobile={!!selectedId}
            onBackFromDetail={() => selectAgent(null)}
            detailBackLabel="Agents"
            list={
              <AgentsListPanel
                segment={segment}
                onSegmentChange={setSegment}
                agents={agents ?? []}
                agentsLoading={agentsLoading}
                agentsError={!!agentsError}
                leaderboard={leaderboard ?? []}
                leaderboardLoading={leaderboardLoading}
                leaderboardError={!!leaderboardError}
                onRetryLeaderboard={() => void refetchLeaderboard()}
                selectedId={selectedId}
                onSelect={(id) => selectAgent(id)}
                sportFilter={sportFilter}
                onSportFilterChange={setSportFilter}
                sortMode={sortMode}
                onSortModeChange={setSortMode}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                excludeUnder10Picks={excludeUnder10Picks}
                onExcludeUnder10PicksChange={setExcludeUnder10Picks}
                onToggleActive={handleToggleActive}
                onTogglePinned={handleTogglePinned}
                onEditAgent={(id) => navigate(`/agents/${id}/settings`)}
                onDeleteAgent={setPendingDeleteId}
                togglePendingId={togglePendingId}
                canCreateMore={canCreateMore}
                activeCount={activeCount}
                totalCount={totalCount}
                maxActiveAgents={maxActiveAgents}
                maxTotalAgents={maxTotalAgents}
                isAdmin={isAdmin}
                onCreate={() => navigate('/agents/create')}
              />
            }
            detail={agentDetail}
          />
        )}
      </div>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !deleteAgentMutation.isPending) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteAgent?.name ?? 'This agent'} and its saved configuration will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAgentMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={deleteAgentMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAgentMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
