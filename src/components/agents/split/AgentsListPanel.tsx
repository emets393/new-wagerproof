import * as React from 'react';
import { ArrowUpDown, Calendar, Lock, Plus, Search, Sparkles, Trophy, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  FilterPill,
  GlassCard,
  SegmentedControl,
  SkeletonBlock,
  SkeletonCircle,
  StaggeredItem,
  TogglePill,
} from '@/components/ios';
import { AgentListCard } from './AgentListCard';
import { LeaderboardRowCard } from './LeaderboardRowCard';
import { TopAgentPicksPanel } from './TopAgentPicksPanel';
import type { TopAgentPicksFilter } from '@/services/agentPicksService';
import { SPORTS, Sport, AgentWithPerformance } from '@/types/agent';
import type {
  LeaderboardEntry,
  LeaderboardSortMode,
  LeaderboardTimeframe,
} from '@/services/agentPerformanceService';

export type AgentsSegment = 'mine' | 'leaderboard' | 'topPicks';
type MyAgentsSort = 'winRate' | 'units' | 'streak' | 'name' | 'newest';

function ListCardSkeleton() {
  return (
    <GlassCard className="p-3.5">
      <div className="flex items-start gap-3">
        <SkeletonBlock width={48} height={48} radius={16} />
        <div className="flex-1 space-y-2">
          <SkeletonBlock width={140} height={15} />
          <SkeletonBlock width={100} height={11} />
        </div>
        <div className="flex w-24 flex-col items-end gap-1.5">
          <SkeletonBlock width={58} height={14} radius={999} />
          <div className="flex h-7 items-end gap-[3px]">
            {[14, 22, 10, 26, 18, 12].map((height, index) => (
              <SkeletonBlock key={index} width={8} height={height} radius={2} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-black/5 dark:border-white/10" />
      <div className="mt-2.5 flex items-center justify-between">
        <SkeletonBlock width={90} height={14} />
        <SkeletonBlock width={110} height={14} />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 dark:border-white/10">
        <SkeletonBlock width={86} height={12} />
        <SkeletonBlock width={36} height={20} radius={999} />
      </div>
    </GlassCard>
  );
}

function RowSkeleton() {
  return (
    <GlassCard radius={18} className="px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <SkeletonBlock width={20} height={14} />
        <SkeletonCircle diameter={34} />
        <div className="flex-1 space-y-1.5">
          <SkeletonBlock width={120} height={13} />
          <SkeletonBlock width={70} height={9} />
        </div>
        <SkeletonBlock width={72} height={22} radius={999} />
      </div>
    </GlassCard>
  );
}

interface AgentsListPanelProps {
  segment: AgentsSegment;
  onSegmentChange: (segment: AgentsSegment) => void;
  agents: AgentWithPerformance[];
  agentsLoading: boolean;
  agentsError: boolean;
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  leaderboardError: boolean;
  onRetryLeaderboard: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sportFilter: Sport | 'all';
  onSportFilterChange: (sport: Sport | 'all') => void;
  sortMode: LeaderboardSortMode;
  onSortModeChange: (mode: LeaderboardSortMode) => void;
  timeframe: LeaderboardTimeframe;
  onTimeframeChange: (tf: LeaderboardTimeframe) => void;
  excludeUnder10Picks: boolean;
  onExcludeUnder10PicksChange: (v: boolean) => void;
  onToggleActive: (agentId: string, checked: boolean) => void;
  onTogglePinned: (agentId: string, pinned: boolean) => void;
  onEditAgent: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;
  togglePendingId: string | null;
  canCreateMore: boolean;
  activeCount: number;
  totalCount: number;
  maxActiveAgents: number | null;
  maxTotalAgents: number | null;
  isAdmin: boolean;
  onCreate: () => void;
}

/**
 * Left panel of the /agents split view: My Agents / Leaderboard segments,
 * entitlement strip, name search, iOS filter pills, and the card list.
 * (iOS also has a "Top Picks" segment — deferred: web has no aggregated
 * picks-feed query yet.)
 */
export function AgentsListPanel(props: AgentsListPanelProps) {
  const {
    segment,
    onSegmentChange,
    agents,
    agentsLoading,
    agentsError,
    leaderboard,
    leaderboardLoading,
    leaderboardError,
    onRetryLeaderboard,
    selectedId,
    onSelect,
    sportFilter,
    onSportFilterChange,
    sortMode,
    onSortModeChange,
    timeframe,
    onTimeframeChange,
    excludeUnder10Picks,
    onExcludeUnder10PicksChange,
    onToggleActive,
    onTogglePinned,
    onEditAgent,
    onDeleteAgent,
    togglePendingId,
    canCreateMore,
    activeCount,
    totalCount,
    maxActiveAgents,
    maxTotalAgents,
    isAdmin,
    onCreate,
  } = props;

  const [searchText, setSearchText] = React.useState('');
  const [myAgentsSort, setMyAgentsSort] = React.useState<MyAgentsSort>('winRate');
  const [topPicksFilter, setTopPicksFilter] = React.useState<TopAgentPicksFilter>('top10');

  const filteredAgents = React.useMemo(() => {
    let list = [...agents];
    if (sportFilter !== 'all') {
      list = list.filter((a) => a.preferred_sports.includes(sportFilter));
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      switch (myAgentsSort) {
        case 'units':
          return (b.performance?.net_units ?? 0) - (a.performance?.net_units ?? 0);
        case 'streak':
          return (b.performance?.current_streak ?? 0) - (a.performance?.current_streak ?? 0);
        case 'name':
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'winRate':
        default: {
          const aSettled = (a.performance?.wins ?? 0) + (a.performance?.losses ?? 0);
          const bSettled = (b.performance?.wins ?? 0) + (b.performance?.losses ?? 0);
          const aRate = aSettled > 0 ? (a.performance?.wins ?? 0) / aSettled : -1;
          const bRate = bSettled > 0 ? (b.performance?.wins ?? 0) / bSettled : -1;
          return bRate - aRate;
        }
      }
    });

    const pinned = list.filter((agent) => agent.is_widget_favorite);
    const unpinned = list.filter((agent) => !agent.is_widget_favorite);
    return [...pinned, ...unpinned];
  }, [agents, sportFilter, searchText, myAgentsSort]);

  const filteredLeaderboard = React.useMemo(() => {
    if (!searchText.trim()) return leaderboard;
    const q = searchText.toLowerCase();
    return leaderboard.filter((e) => e.name.toLowerCase().includes(q));
  }, [leaderboard, searchText]);

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto">
      {/* Floating glass header */}
      <div className="sticky top-0 z-20 space-y-2 px-3 pb-2 pt-3 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_calc(100%_-_8px),transparent)]">
        <div className="flex items-center gap-1.5">
          {/* No explicit JSX generic — the lovable dev-build tagger can't parse it. */}
          <SegmentedControl
            layoutId="agents-segment"
            className="min-w-0 flex-1"
            options={[
              { value: 'mine', label: 'My Agents', icon: <Users className="h-3.5 w-3.5" /> },
              { value: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="h-3.5 w-3.5" /> },
              { value: 'topPicks', label: 'Top Picks', icon: <Sparkles className="h-3.5 w-3.5" /> },
            ]}
            value={segment}
            onChange={onSegmentChange}
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={!canCreateMore}
            title={canCreateMore ? 'Create agent' : 'Agent limit reached'}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-foreground backdrop-blur-xl hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]',
              !canCreateMore && 'cursor-not-allowed text-muted-foreground opacity-70'
            )}
          >
            {canCreateMore ? <Plus className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search agents"
            className="h-9 w-full rounded-full border border-black/5 bg-white/60 pl-8 pr-8 text-[13px] font-medium text-foreground outline-none backdrop-blur-xl placeholder:text-muted-foreground focus:border-primary/40 dark:border-white/10 dark:bg-white/[0.06]"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-transparent">
          {segment !== 'topPicks' && (
            <FilterPill
              icon={<Trophy />}
              label="Sport"
              defaultValue="all"
              value={sportFilter}
              onChange={(v) => onSportFilterChange(v as Sport | 'all')}
              options={[
                { value: 'all', label: 'All Sports' },
                ...SPORTS.map((s) => ({ value: s, label: s.toUpperCase() })),
              ]}
            />
          )}
          {segment === 'mine' && (
            <FilterPill
              className="ml-auto"
              icon={<ArrowUpDown />}
              label="Win %"
              defaultValue="winRate"
              value={myAgentsSort}
              onChange={setMyAgentsSort}
              options={[
                { value: 'winRate', label: 'Win %' },
                { value: 'units', label: 'Units' },
                { value: 'streak', label: 'Streak' },
                { value: 'name', label: 'Name' },
                { value: 'newest', label: 'Newest' },
              ]}
            />
          )}
          {segment === 'leaderboard' && (
            <>
              <FilterPill
                icon={<ArrowUpDown />}
                label="Sort"
                defaultValue="overall"
                value={sortMode}
                onChange={(v) => onSortModeChange(v as LeaderboardSortMode)}
                options={[
                  { value: 'overall', label: 'Top 100' },
                  { value: 'recent_run', label: 'Recent Run' },
                  { value: 'longest_streak', label: 'Longest Streak' },
                  { value: 'bottom_100', label: 'Bottom 100' },
                ]}
              />
              <FilterPill
                icon={<Calendar />}
                label="All Time"
                defaultValue="all_time"
                value={timeframe}
                onChange={(v) => onTimeframeChange(v as LeaderboardTimeframe)}
                options={[
                  { value: 'all_time', label: 'All Time' },
                  { value: 'last_7_days', label: '7 Days' },
                  { value: 'last_30_days', label: '30 Days' },
                ]}
              />
              <TogglePill
                label="10+ Picks"
                active={excludeUnder10Picks}
                onToggle={onExcludeUnder10PicksChange}
              />
            </>
          )}
          {segment === 'topPicks' && (
            <FilterPill
              icon={<Sparkles />}
              label={topPicksFilter === 'top10' ? 'Top 10' : topPicksFilter === 'following' ? 'Following' : 'Favorites'}
              defaultValue="top10"
              value={topPicksFilter}
              onChange={(value) => setTopPicksFilter(value as TopAgentPicksFilter)}
              options={[
                { value: 'top10', label: 'Top 10' },
                { value: 'following', label: 'Following' },
                { value: 'favorites', label: 'Favorites' },
              ]}
            />
          )}
        </div>
      </div>

      <div className="space-y-2.5 px-3 pb-6 pt-1">
        {/* Entitlement strip (admins have no limits) */}
        {segment === 'mine' && !isAdmin && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 text-[11px] font-semibold text-muted-foreground">
            <span className="rounded-full bg-muted/60 px-2 py-0.5">
              Active {activeCount}/{maxActiveAgents ?? '∞'}
            </span>
            <span className="rounded-full bg-muted/60 px-2 py-0.5">
              Created {totalCount}/{maxTotalAgents ?? '∞'}
            </span>
            {!canCreateMore && (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
                Limit reached
              </span>
            )}
          </div>
        )}

        {segment === 'mine' ? (
          agentsLoading ? (
            <>
              <ListCardSkeleton />
              <ListCardSkeleton />
              <ListCardSkeleton />
            </>
          ) : agentsError ? (
            <GlassCard className="px-6 py-10 text-center text-sm text-destructive">
              Failed to load agents.
            </GlassCard>
          ) : filteredAgents.length === 0 ? (
            <GlassCard className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                {agents.length === 0 ? 'No agents yet' : 'No matching agents'}
              </p>
              <p className="max-w-[240px] text-sm text-muted-foreground">
                {agents.length === 0
                  ? 'Create your first agent to start generating and tracking picks.'
                  : 'Try a different search or sport filter.'}
              </p>
              {agents.length === 0 && (
                <Button
                  size="sm"
                  className="rounded-full bg-[#00E676] text-black hover:bg-[#00E676]/90"
                  onClick={onCreate}
                  disabled={!canCreateMore}
                >
                  Create Your First Agent
                </Button>
              )}
            </GlassCard>
          ) : (
            filteredAgents.map((agent, index) => (
              <StaggeredItem key={agent.id} index={index}>
                <AgentListCard
                  agent={agent}
                  isSelected={agent.id === selectedId}
                  onSelect={onSelect}
                  onToggleActive={onToggleActive}
                  onTogglePinned={onTogglePinned}
                  onEdit={onEditAgent}
                  onDelete={onDeleteAgent}
                  isTogglePending={togglePendingId === agent.id}
                />
              </StaggeredItem>
            ))
          )
        ) : segment === 'topPicks' ? (
          <TopAgentPicksPanel filter={topPicksFilter} searchText={searchText} selectedId={selectedId} onSelectAgent={onSelect} />
        ) : leaderboardLoading ? (
          <>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : leaderboardError ? (
          <GlassCard className="flex flex-col items-center gap-3 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-destructive">Couldn&apos;t load leaderboard</p>
            <Button size="sm" variant="outline" className="rounded-full" onClick={onRetryLeaderboard}>
              Retry
            </Button>
          </GlassCard>
        ) : filteredLeaderboard.length === 0 ? (
          <GlassCard className="px-6 py-10 text-center text-sm text-muted-foreground">
            No public agents available yet.
          </GlassCard>
        ) : (
          filteredLeaderboard.map((entry, index) => (
            <StaggeredItem key={entry.avatar_id} index={index}>
              <LeaderboardRowCard
                entry={entry}
                rank={index + 1}
                isSelected={entry.avatar_id === selectedId}
                isBottomMode={sortMode === 'bottom_100'}
                onSelect={onSelect}
              />
            </StaggeredItem>
          ))
        )}
      </div>
      </div>

      {/* Bottom fade so the last card melts into the pane, matching the /games feed. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-10 bg-gradient-to-b from-transparent via-background/75 to-background dark:via-black/75 dark:to-black"
      />
    </div>
  );
}
