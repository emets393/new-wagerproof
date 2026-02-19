import { AgentWithPerformance } from '@/types/agent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AgentPerformanceChartsProps {
  agent: AgentWithPerformance;
}

export function AgentPerformanceCharts({ agent }: AgentPerformanceChartsProps) {
  const perf = agent.performance;
  const winRate = perf?.win_rate ? (perf.win_rate * 100).toFixed(1) : '--';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Performance Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Total Picks" value={`${perf?.total_picks || 0}`} />
        <Metric label="Win Rate" value={winRate === '--' ? '--' : `${winRate}%`} />
        <Metric label="Net Units" value={`${perf?.net_units?.toFixed(2) || '0.00'}u`} />
        <Metric label="Best Streak" value={`${perf?.best_streak || 0}`} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  );
}
