import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AgentCard, AgentLeaderboard } from '@/components/agents';
import { useAgentEntitlements } from '@/hooks/useAgentEntitlements';
import { useAgentLeaderboard, useUpdateAgent, useUserAgents } from '@/hooks/useAgents';
import { Sport, SPORTS } from '@/types/agent';

export default function Agents() {
  const navigate = useNavigate();
  const [sportFilter, setSportFilter] = useState<Sport | 'all'>('all');
  const [sortMode, setSortMode] = useState<'overall' | 'recent_run' | 'longest_streak' | 'bottom_100'>('overall');
  const [excludeUnder10Picks, setExcludeUnder10Picks] = useState(false);
  const { data: agents, isLoading, error } = useUserAgents();
  const updateAgentMutation = useUpdateAgent();
  const [togglePendingId, setTogglePendingId] = useState<string | null>(null);
  const { data: leaderboard, isLoading: leaderboardLoading } = useAgentLeaderboard(
    sportFilter === 'all' ? undefined : sportFilter,
    sortMode,
    excludeUnder10Picks
  );
  const { canCreateAnotherAgent, isPro, isAdmin, maxActiveAgents, maxTotalAgents } = useAgentEntitlements();

  const totalCount = agents?.length || 0;
  const activeCount = agents?.filter((a) => a.is_active).length || 0;
  const canCreateMore = canCreateAnotherAgent(activeCount, totalCount);

  const filteredMyAgents = useMemo(() => {
    if (!agents) return [];
    if (sportFilter === 'all') return agents;
    return agents.filter((a) => a.preferred_sports.includes(sportFilter));
  }, [agents, sportFilter]);

  const handleToggleActive = async (agentId: string, checked: boolean) => {
    if (togglePendingId === agentId || updateAgentMutation.isPending) return;
    setTogglePendingId(agentId);
    try {
      await updateAgentMutation.mutateAsync({
        agentId,
        data: {
          is_active: checked,
          auto_generate: checked,
        },
      });
    } finally {
      setTogglePendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">Create, track, and compare AI betting agents.</p>
        </div>
        <Button onClick={() => navigate('/agents/create')} disabled={!canCreateMore}>
          <Plus className="mr-2 h-4 w-4" /> Create Agent
        </Button>
      </div>

      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Limits:</span>
          <span>
            Active {activeCount}/{maxActiveAgents ?? 'Unlimited'}
          </span>
          <span>Created {totalCount}/{maxTotalAgents ?? 'Unlimited'}</span>
          {!canCreateMore ? <span className="text-destructive">Limit reached</span> : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Select value={sportFilter} onValueChange={(v) => setSportFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sport" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sports</SelectItem>
            {SPORTS.map((sport) => (
              <SelectItem key={sport} value={sport}>{sport.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortMode} onValueChange={(v) => setSortMode(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overall">Top 100</SelectItem>
            <SelectItem value="recent_run">Recent run</SelectItem>
            <SelectItem value="longest_streak">Longest streak</SelectItem>
            <SelectItem value="bottom_100">Bottom 100</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <Switch checked={excludeUnder10Picks} onCheckedChange={setExcludeUnder10Picks} />
          <span className="text-sm">10+ picks only</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <section className="lg:col-span-2 space-y-3">
          <div>
            <h2 className="text-lg font-semibold">My Agents</h2>
            <p className="text-xs text-muted-foreground">Your created agents and their current performance.</p>
          </div>

          {isLoading ? <Card><CardContent className="py-10 text-center">Loading agents...</CardContent></Card> : null}
          {error ? <Card><CardContent className="py-10 text-center text-destructive">Failed to load agents.</CardContent></Card> : null}
          {!isLoading && !error && filteredMyAgents.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No agents yet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Create your first agent to start generating and tracking picks.</p>
                <Button onClick={() => navigate('/agents/create')}>Create your first agent</Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid md:grid-cols-2 gap-3">
            {filteredMyAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onOpen={(id) => navigate(`/agents/${id}`)}
                onToggleActive={handleToggleActive}
                isTogglePending={togglePendingId === agent.id}
              />
            ))}
          </div>
        </section>

        <aside className="lg:col-span-1 space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Leaderboard</h2>
            <p className="text-xs text-muted-foreground">Top public agents by performance.</p>
          </div>
          {leaderboardLoading ? <Card><CardContent className="py-10 text-center">Loading leaderboard...</CardContent></Card> : null}
          {!leaderboardLoading ? <AgentLeaderboard rows={leaderboard || []} onRowClick={(id) => navigate(`/agents/public/${id}`)} /> : null}
        </aside>
      </div>
    </div>
  );
}
