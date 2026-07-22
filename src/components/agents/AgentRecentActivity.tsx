import { BarChart3, Clock3, Sparkles, Zap } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import type { AgentWithPerformance } from '@/types/agent';

interface AgentRecentActivityProps { agent: AgentWithPerformance }

function relativeDate(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (elapsed < 60_000) return 'just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function AgentRecentActivity({ agent }: AgentRecentActivityProps) {
  const events = [
    agent.last_generated_at && { id: 'generation', at: agent.last_generated_at, title: 'Last generation', detail: 'Manual or automatic pick generation.', icon: Sparkles, color: '#3b82f6' },
    agent.performance?.last_calculated_at && { id: 'performance', at: agent.performance.last_calculated_at, title: 'Performance updated', detail: `${agent.performance.wins}-${agent.performance.losses}${agent.performance.pushes ? `-${agent.performance.pushes}` : ''} · ${agent.performance.net_units >= 0 ? '+' : ''}${agent.performance.net_units.toFixed(2)}u`, icon: BarChart3, color: agent.performance.net_units >= 0 ? '#10b981' : '#ef4444' },
    agent.auto_generate && { id: 'autopilot', at: agent.updated_at, title: 'Autopilot active', detail: `Scheduled for ${agent.auto_generate_time || 'the daily window'}.`, icon: Zap, color: agent.avatar_color },
  ].filter(Boolean).sort((a, b) => new Date(b!.at).getTime() - new Date(a!.at).getTime()) as Array<{ id: string; at: string; title: string; detail: string; icon: typeof Sparkles; color: string }>;

  if (!events.length) return null;
  return (
    <WidgetCard icon={<Clock3 />} title="Recent Activity" subtitle="The latest changes and completed work from this agent.">
      <div>
        {events.map((event, index) => {
          const Icon = event.icon;
          return (
            <div key={event.id} className="flex gap-3">
              <div className="flex w-7 flex-col items-center">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ color: event.color, background: `${event.color}20` }}><Icon className="h-3.5 w-3.5" /></span>
                {index < events.length - 1 && <span className="my-1 w-px flex-1 bg-border/70" />}
              </div>
              <div className={`min-w-0 flex-1 ${index < events.length - 1 ? 'pb-4' : ''}`}>
                <div className="flex items-baseline justify-between gap-3"><p className="text-sm font-bold text-foreground">{event.title}</p><span className="shrink-0 text-[11px] text-muted-foreground">{relativeDate(event.at)}</span></div>
                <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
