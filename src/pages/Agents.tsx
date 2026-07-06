import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SplitViewLayout, useIsDesktopSplit } from '@/components/layout/SplitViewLayout';
import { AnnouncementsBanner } from '@/components/AnnouncementsBanner';
import { AgentsListPanel, type AgentsSegment } from '@/components/agents/split/AgentsListPanel';
import { AgentDetailPane } from '@/components/agents/split/AgentDetailPane';
import type { GenerationByAgent } from '@/components/agents/split/generationState';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import {
  useAgentLeaderboard,
  useGenerateAgentPicks,
  useUpdateAgent,
  useUserAgents,
} from '@/hooks/useAgents';
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
  // Lifted per-agent generation state: the polling promise runs up to 5 min,
  // so it must survive switching selection (see generationState.ts).
  const [generationByAgent, setGenerationByAgent] = React.useState<GenerationByAgent>({});

  const { data: agents, isLoading: agentsLoading, error: agentsError } = useUserAgents();
  const { data: leaderboard, isLoading: leaderboardLoading } = useAgentLeaderboard(
    sportFilter === 'all' ? undefined : sportFilter,
    sortMode,
    excludeUnder10Picks,
    timeframe
  );
  const updateAgentMutation = useUpdateAgent();
  const generateMutation = useGenerateAgentPicks();
  const { canCreateAnotherAgent, isAdmin, maxActiveAgents, maxTotalAgents } =
    useAgentEntitlements();

  const totalCount = agents?.length || 0;
  const activeCount = agents?.filter((a) => a.is_active).length || 0;
  const canCreateMore = canCreateAnotherAgent(activeCount, totalCount);

  // Segment: explicit ?tab wins; else infer from whether the selection is mine.
  const isSelectedMine = !!selectedId && !!agents?.some((a) => a.id === selectedId);
  const segment: AgentsSegment =
    tabParam === 'leaderboard' || tabParam === 'mine'
      ? tabParam
      : selectedId && agents && !isSelectedMine
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
    (id: string | null, options?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (id) params.set('selected', id);
          else params.delete('selected');
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
    setGenerationByAgent((prev) => ({
      ...prev,
      [agentId]: { status: 'generating', error: null, result: null },
    }));
    try {
      const result = await generateMutation.mutateAsync({ agentId, isAdmin });
      setGenerationByAgent((prev) => ({
        ...prev,
        [agentId]: { status: 'success', error: null, result },
      }));
    } catch (err: any) {
      setGenerationByAgent((prev) => ({
        ...prev,
        [agentId]: { status: 'error', error: err?.message || 'Failed to generate picks.', result: null },
      }));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AnnouncementsBanner />
      <div className="min-h-0 flex-1">
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
          detail={
            <AgentDetailPane
              agentId={selectedId}
              generation={selectedId ? generationByAgent[selectedId] : undefined}
              onGenerate={handleGenerate}
              onClearSelection={() => selectAgent(null)}
            />
          }
        />
      </div>
    </div>
  );
}
