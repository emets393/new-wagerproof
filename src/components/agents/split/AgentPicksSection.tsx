import * as React from 'react';
import { History, Lock, Target, Trophy } from 'lucide-react';
import { FilterPill, WidgetCard } from '@/components/ios';
import { GlassCard } from '@/components/ios';
import { AgentPickCard } from '../AgentPickCard';
import { AgentPickAuditPanel } from '../AgentPickAuditPanel';
import { useAgentPicks } from '@/hooks/useAgents';
import {
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

  const { data: picks, isLoading } = useAgentPicks(canSeePicks ? agentId : undefined, {
    sport: sportFilter === 'all' ? undefined : sportFilter,
    result: resultFilter === 'all' ? undefined : resultFilter,
  });

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
      {!isLoading && (picks?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">No picks found for current filters.</p>
      )}

      {!selectedPick ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {(picks ?? []).map((pick) => (
            <AgentPickCard
              key={pick.id}
              pick={pick}
              onOpenAudit={(p) => setSelectedPick((prev) => (prev?.id === p.id ? null : p))}
            />
          ))}
        </div>
      ) : (
        <AgentPickAuditPanel pick={selectedPick} onBack={() => setSelectedPick(null)} />
      )}
    </WidgetCard>
  );
}
