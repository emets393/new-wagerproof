import * as React from 'react';
import { Medal, Sparkles, Trophy } from 'lucide-react';
import { GlassCard, SkeletonBlock, SkeletonCircle, StaggeredItem } from '@/components/ios';
import { useTopAgentPicks } from '@/hooks/useAgents';
import { getAgentColorPair } from '@/utils/agentColors';
import { AgentAvatarTile } from './AgentAvatarTile';
import { AgentFormChart } from './AgentListCard';
import { MiniHistoryTicket, type AgentHistoryItem } from './AgentPicksSection';
import type { TopAgentPickFeedRow, TopAgentPicksFilter } from '@/services/agentPicksService';

interface TopAgentPicksPanelProps {
  filter: TopAgentPicksFilter;
  searchText: string;
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
}

interface AgentPickSection {
  agentId: string;
  rows: TopAgentPickFeedRow[];
}

function rankMark(rank: number | null) {
  if (rank === 1) return <Trophy className="h-4 w-4 text-[#FFD700]" fill="currentColor" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-[#C0C0C0]" fill="currentColor" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-[#CD7F32]" />;
  return rank ? <span className="text-xs font-black text-[#00C968]">#{rank}</span> : null;
}

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((index) => (
        <GlassCard key={index} radius={24} className="overflow-hidden p-0">
          <div className="flex items-center gap-3 px-3.5 py-3">
            <SkeletonCircle diameter={48} />
            <div className="space-y-2"><SkeletonBlock width={130} height={14} /><SkeletonBlock width={90} height={10} /></div>
          </div>
          <div className="border-t border-border/50 px-3.5 py-3"><SkeletonBlock width={178} height={264} radius={18} /></div>
        </GlassCard>
      ))}
    </div>
  );
}

export function TopAgentPicksPanel({ filter, searchText, selectedId, onSelectAgent }: TopAgentPicksPanelProps) {
  const deferredSearch = React.useDeferredValue(searchText);
  const { data: rows = [], isLoading, error, refetch } = useTopAgentPicks(filter, deferredSearch);
  const sections = React.useMemo<AgentPickSection[]>(() => {
    const grouped = new Map<string, TopAgentPickFeedRow[]>();
    for (const row of rows) grouped.set(row.avatar_id, [...(grouped.get(row.avatar_id) ?? []), row]);
    return [...grouped].map(([agentId, agentRows]) => ({ agentId, rows: agentRows }));
  }, [rows]);

  if (isLoading) return <FeedSkeleton />;
  if (error) {
    return (
      <GlassCard className="flex flex-col items-center gap-3 px-6 py-9 text-center">
        <p className="text-sm font-semibold text-destructive">Couldn&apos;t load top agent picks</p>
        <button type="button" onClick={() => void refetch()} className="rounded-full border border-border px-3 py-1.5 text-xs font-bold">Retry</button>
      </GlassCard>
    );
  }
  if (!sections.length) {
    const message = searchText.trim()
      ? `Nothing matched “${searchText.trim()}”. Try another agent, team, or pick.`
      : filter === 'following'
        ? 'Follow agents from the Leaderboard to see their latest picks here.'
        : filter === 'favorites'
          ? 'Favorite an agent to build a focused picks feed.'
          : 'Picks appear here when the leaderboard’s top agents publish today’s slate.';
    return (
      <GlassCard className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <Sparkles className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">No top picks yet</p>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{message}</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const agent = section.rows[0];
        const [accent] = getAgentColorPair(agent.agent_avatar_color);
        const record = `${agent.agent_wins}-${agent.agent_losses}${agent.agent_pushes ? `-${agent.agent_pushes}` : ''}`;
        return (
          <StaggeredItem key={section.agentId} index={index}>
            <GlassCard radius={24} className={`overflow-hidden p-0 ${selectedId === section.agentId ? 'ring-1 ring-primary/40' : ''}`}>
              <button type="button" onClick={() => onSelectAgent(section.agentId)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-background/35">
                <AgentAvatarTile agentId={section.agentId} emoji={agent.agent_avatar_emoji} color={agent.agent_avatar_color} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="grid min-w-5 place-items-center">{rankMark(agent.agent_rank)}</span>
                    <p className="truncate text-[15px] font-black text-foreground">{agent.agent_name}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                    <span>{record}</span><span aria-hidden>•</span>
                    <span className={agent.agent_net_units >= 0 ? 'text-emerald-500' : 'text-red-500'}>{agent.agent_net_units >= 0 ? '+' : ''}{agent.agent_net_units.toFixed(1)}u</span>
                  </div>
                </div>
                <AgentFormChart performance={{
                  avatar_id: section.agentId,
                  wins: agent.agent_wins,
                  losses: agent.agent_losses,
                  current_streak: agent.agent_current_streak ?? 0,
                }} />
              </button>
              <div className="border-t border-border/50 py-3">
                <div className="overflow-x-auto px-3.5 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex w-max snap-x snap-mandatory gap-3 pr-8">
                    {section.rows.slice(0, 4).map((row) => {
                      const item: AgentHistoryItem = { kind: 'pick', date: row.game_date, createdAt: row.created_at, pick: row };
                      return <MiniHistoryTicket key={row.id} item={item} accent={accent} selected={false} onSelect={() => onSelectAgent(section.agentId)} />;
                    })}
                  </div>
                </div>
              </div>
            </GlassCard>
          </StaggeredItem>
        );
      })}
    </div>
  );
}
