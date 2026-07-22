import * as React from 'react';
import { Medal, Sparkles, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard, SkeletonBlock, SkeletonCircle } from '@/components/ios';
import { AgentAvatarTile } from '@/components/agents/split/AgentAvatarTile';
import { AgentFormChart } from '@/components/agents/split/AgentListCard';
import { MiniHistoryTicket, type AgentHistoryItem } from '@/components/agents/split/AgentPicksSection';
import { useTopAgentPicks } from '@/hooks/useAgents';
import { getAgentColorPair } from '@/utils/agentColors';
import type { TopAgentPickFeedRow, TopAgentPicksFilter } from '@/services/agentPicksService';
import { HorizontalCardRail } from './HorizontalCardRail';
import { SectionHeader } from './SectionHeader';
import { useHorizontalRail } from '../hooks/useHorizontalRail';

function RankMark({ rank }: { rank: number | null }) {
  if (rank === 1) return <Trophy className="h-4 w-4 text-[#FFD700]" fill="currentColor" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-[#C0C0C0]" fill="currentColor" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-[#CD7F32]" />;
  return rank ? <span className="text-xs font-black text-[#00C968]">#{rank}</span> : null;
}

export function TopAgentPicksRail({ maxItems, sectionId }: { maxItems?: number; sectionId?: string } = {}) {
  const navigate = useNavigate();
  const [filter, setFilter] = React.useState<TopAgentPicksFilter>('top10');
  const { data: rows = [], isLoading } = useTopAgentPicks(filter, '');
  const sections = React.useMemo(() => {
    const grouped = new Map<string, TopAgentPickFeedRow[]>();
    for (const row of rows) grouped.set(row.avatar_id, [...(grouped.get(row.avatar_id) ?? []), row]);
    return [...grouped].map(([agentId, picks]) => ({ agentId, picks }));
  }, [rows]);
  const visibleSections = maxItems ? sections.slice(0, maxItems) : sections;
  const rail = useHorizontalRail(visibleSections.length);
  const openAgent = (agentId: string) => navigate(`/agents?tab=topPicks&selected=${encodeURIComponent(agentId)}`);

  return (
    <section id={sectionId} className="group scroll-mt-24 flex min-w-0 flex-col gap-2.5">
      <SectionHeader
        title="Top Agent Picks"
        subtitle="Today’s published plays from the highest-performing agents."
        icon={<Sparkles />}
        selector={{
          connective: 'Showing',
          value: filter,
          options: [
            { value: 'top10', label: 'Top 10' },
            { value: 'following', label: 'Following' },
            { value: 'favorites', label: 'Favorites' },
          ],
          onChange: (value) => setFilter(value as TopAgentPicksFilter),
        }}
        action={rail.hasOverflow ? {
          kind: 'chevrons',
          onPrev: rail.scrollPrev,
          onNext: rail.scrollNext,
          canPrev: rail.canScrollLeft,
          canNext: rail.canScrollRight,
          revealOnHover: true,
        } : { kind: 'link', label: 'View all', onClick: () => navigate('/agents?tab=topPicks') }}
      />

      <HorizontalCardRail rail={rail} className="scrollbar-transparent">
        {isLoading ? [0, 1, 2].map((index) => (
          <GlassCard key={index} radius={22} className="w-[402px] shrink-0 p-3.5">
            <div className="flex items-center gap-3"><SkeletonCircle diameter={46} /><div className="space-y-2"><SkeletonBlock width={120} height={14} /><SkeletonBlock width={80} height={10} /></div></div>
            <div className="mt-3 border-t border-border/50 pt-3"><SkeletonBlock width={178} height={264} radius={18} /></div>
          </GlassCard>
        )) : visibleSections.length === 0 ? (
          <GlassCard className="w-full shrink-0 px-5 py-6 text-center text-sm text-muted-foreground">No agent picks are available for this view yet.</GlassCard>
        ) : visibleSections.map(({ agentId, picks }) => {
          const agent = picks[0];
          const [accent] = getAgentColorPair(agent.agent_avatar_color);
          const record = `${agent.agent_wins}-${agent.agent_losses}${agent.agent_pushes ? `-${agent.agent_pushes}` : ''}`;
          return (
            <GlassCard key={agentId} radius={22} className="w-[min(402px,calc(100vw-32px))] shrink-0 overflow-hidden p-0">
              <button type="button" onClick={() => openAgent(agentId)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-background/35">
                <AgentAvatarTile agentId={agentId} emoji={agent.agent_avatar_emoji} color={agent.agent_avatar_color} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5"><RankMark rank={agent.agent_rank} /><p className="truncate text-sm font-black text-foreground">{agent.agent_name}</p></div>
                  <div className="mt-1 flex gap-2 text-[11px] font-semibold text-muted-foreground"><span>{record}</span><span className={agent.agent_net_units >= 0 ? 'text-emerald-500' : 'text-red-500'}>{agent.agent_net_units >= 0 ? '+' : ''}{agent.agent_net_units.toFixed(1)}u</span></div>
                </div>
                <AgentFormChart performance={{ avatar_id: agentId, wins: agent.agent_wins, losses: agent.agent_losses, current_streak: agent.agent_current_streak ?? 0 }} />
              </button>
              <div className="border-t border-border/50 px-3.5 py-3">
                <div className="flex gap-3 overflow-hidden">
                  {picks.slice(0, 2).map((pick) => {
                    const item: AgentHistoryItem = { kind: 'pick', date: pick.game_date, createdAt: pick.created_at, pick };
                    return <MiniHistoryTicket key={pick.id} item={item} accent={accent} selected={false} onSelect={() => openAgent(agentId)} />;
                  })}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </HorizontalCardRail>
    </section>
  );
}
