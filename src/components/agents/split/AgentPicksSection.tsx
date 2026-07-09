import * as React from 'react';
import { History, Lock, Target, Trophy } from 'lucide-react';
import { FilterPill, WidgetCard } from '@/components/ios';
import { GlassCard } from '@/components/ios';
import { AgentPickCard } from '../AgentPickCard';
import { AgentParlayCard } from '../AgentParlayCard';
import { AgentPickAuditPanel } from '../AgentPickAuditPanel';
import { useAgentParlays, useAgentPicks } from '@/hooks/useAgents';
import {
  AgentParlay,
  AgentPick,
  PICK_RESULTS,
  PickResult,
  SPORTS,
  Sport,
} from '@/types/agent';

function LockedPlaceholderCard() {
  return (
    <GlassCard radius={16} className="flex min-h-[150px] flex-col items-center justify-center gap-2 p-4">
      <Lock className="h-6 w-6 text-muted-foreground" />
      <p className="text-center text-sm text-muted-foreground">Upgrade to Pro to view picks</p>
    </GlassCard>
  );
}

// History mixes straight picks (avatar_picks) and parlay tickets
// (avatar_parlays) — parlay agents write ONLY to the latter, so without this
// merge their history renders empty.
type HistoryItem =
  | { kind: 'pick'; date: string; createdAt: string; pick: AgentPick }
  | { kind: 'parlay'; date: string; createdAt: string; parlay: AgentParlay };

interface AgentPicksSectionProps {
  agentId: string;
  canSeePicks: boolean;
}

/**
 * Pick history: sport/result filter pills, then the pick-card grid that swaps
 * in place for the audit panel (legacy AgentDetail mechanics). Filters reset
 * when the selected agent changes.
 */
export function AgentPicksSection({ agentId, canSeePicks }: AgentPicksSectionProps) {
  const [sportFilter, setSportFilter] = React.useState<Sport | 'all'>('all');
  const [resultFilter, setResultFilter] = React.useState<PickResult | 'all'>('all');
  const [selectedPick, setSelectedPick] = React.useState<AgentPick | null>(null);

  React.useEffect(() => {
    setSportFilter('all');
    setResultFilter('all');
    setSelectedPick(null);
  }, [agentId]);

  const filters = {
    sport: sportFilter === 'all' ? undefined : sportFilter,
    result: resultFilter === 'all' ? undefined : resultFilter,
  };
  const { data: picks, isLoading: picksLoading } = useAgentPicks(canSeePicks ? agentId : undefined, filters);
  const { data: parlays, isLoading: parlaysLoading } = useAgentParlays(canSeePicks ? agentId : undefined, filters);
  const isLoading = picksLoading || parlaysLoading;

  const items = React.useMemo<HistoryItem[]>(() => {
    const merged: HistoryItem[] = [
      ...(picks ?? []).map((pick) => ({
        kind: 'pick' as const,
        date: pick.game_date,
        createdAt: pick.created_at,
        pick,
      })),
      ...(parlays ?? []).map((parlay) => ({
        kind: 'parlay' as const,
        date: parlay.target_date ?? parlay.created_at.slice(0, 10),
        createdAt: parlay.created_at,
        parlay,
      })),
    ];
    // Same ordering the picks query used: newest slate first, then newest pick.
    return merged.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [picks, parlays]);

  if (!canSeePicks) {
    return (
      <WidgetCard icon={<History />} title="Pick History">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LockedPlaceholderCard />
          <LockedPlaceholderCard />
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard icon={<History />} title="Pick History">
      <div className="mb-3 flex flex-wrap gap-1.5">
        <FilterPill
          icon={<Trophy />}
          label="Sport"
          defaultValue="all"
          value={sportFilter}
          onChange={(v) => setSportFilter(v as Sport | 'all')}
          options={[
            { value: 'all', label: 'All sports' },
            ...SPORTS.map((s) => ({ value: s, label: s.toUpperCase() })),
          ]}
        />
        <FilterPill
          icon={<Target />}
          label="Result"
          defaultValue="all"
          value={resultFilter}
          onChange={(v) => setResultFilter(v as PickResult | 'all')}
          options={[
            { value: 'all', label: 'All results' },
            ...PICK_RESULTS.map((r) => ({ value: r, label: r.toUpperCase() })),
          ]}
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading picks…</p>}
      {!isLoading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">No picks found for current filters.</p>
      )}

      {!selectedPick ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {items.map((item) =>
            item.kind === 'pick' ? (
              <AgentPickCard
                key={item.pick.id}
                pick={item.pick}
                onOpenAudit={(p) => setSelectedPick((prev) => (prev?.id === p.id ? null : p))}
              />
            ) : (
              <AgentParlayCard key={item.parlay.id} parlay={item.parlay} />
            ),
          )}
        </div>
      ) : (
        <AgentPickAuditPanel pick={selectedPick} onBack={() => setSelectedPick(null)} />
      )}
    </WidgetCard>
  );
}
