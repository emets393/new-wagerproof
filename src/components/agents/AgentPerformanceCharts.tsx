import * as React from 'react';
import { BarChart3, Calendar, Trophy } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FilterPill, WidgetCard } from '@/components/ios';
import { AgentStatTile } from './split/AgentStatTile';
import { useAgentParlays, useAgentPicks } from '@/hooks/useAgents';
import type { LeaderboardTimeframe } from '@/services/agentPerformanceService';
import { AgentParlay, AgentPick, AgentWithPerformance, formatNetUnits, PickResult, Sport, SPORTS } from '@/types/agent';

interface AgentPerformanceChartsProps { agent: AgentWithPerformance }
type SettledItem = { date: string; createdAt: string; sport: string; result: PickResult; units: number; odds: string | null };

function americanProfit(odds: string | null, units: number) {
  const value = Number.parseFloat(odds?.replace(/[+,]/g, '') ?? '');
  if (!Number.isFinite(value) || value === 0) return units;
  return value > 0 ? units * value / 100 : units * 100 / Math.abs(value);
}

function contribution(item: SettledItem) {
  if (item.result === 'lost') return -item.units;
  if (item.result === 'won') return americanProfit(item.odds, item.units);
  return 0;
}

function toItems(picks: AgentPick[], parlays: AgentParlay[]): SettledItem[] {
  return [
    ...picks.map((pick) => ({ date: pick.game_date, createdAt: pick.created_at, sport: pick.sport, result: pick.result, units: pick.units, odds: pick.odds })),
    ...parlays.map((parlay) => ({ date: parlay.target_date ?? parlay.created_at.slice(0, 10), createdAt: parlay.created_at, sport: parlay.sport, result: parlay.result, units: parlay.units, odds: parlay.combined_odds })),
  ].filter((item) => item.result !== 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function cutoffFor(timeframe: LeaderboardTimeframe) {
  if (timeframe === 'all_time') return null;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - (timeframe === 'last_7_days' ? 7 : 30));
  return cutoff.toISOString().slice(0, 10);
}

function longestWinStreak(items: SettledItem[]) {
  let current = 0;
  let best = 0;
  items.forEach((item) => {
    if (item.result === 'won') {
      current += 1;
      best = Math.max(best, current);
    } else if (item.result === 'lost') {
      current = 0;
    }
  });
  return best;
}

export function AgentPerformanceCharts({ agent }: AgentPerformanceChartsProps) {
  const [sport, setSport] = React.useState<Sport | 'all'>('all');
  const [timeframe, setTimeframe] = React.useState<LeaderboardTimeframe>('all_time');
  const { data: picks = [], isLoading: picksLoading } = useAgentPicks(agent.id);
  const { data: parlays = [], isLoading: parlaysLoading } = useAgentParlays(agent.id);
  const cutoff = cutoffFor(timeframe);
  const items = toItems(picks, parlays).filter((item) => (
    (sport === 'all' || item.sport === sport) && (!cutoff || item.date >= cutoff)
  ));
  let running = 0;
  const chartData = [{ index: 0, units: 0, label: 'Start' }, ...items.map((item, index) => {
    running += contribution(item);
    return { index: index + 1, units: Number(running.toFixed(2)), label: item.date };
  })];
  const positive = running >= 0;
  const lineColor = positive ? '#10b981' : '#ef4444';
  const wins = items.filter((item) => item.result === 'won').length;
  const losses = items.filter((item) => item.result === 'lost').length;
  const settled = wins + losses;
  const winRate = settled ? ((wins / settled) * 100).toFixed(1) : '--';
  const bestStreak = longestWinStreak(items);
  const sportRows = agent.preferred_sports.map((sport) => {
    const sportItems = items.filter((item) => item.sport === sport);
    const sportWins = sportItems.filter((item) => item.result === 'won').length;
    const sportLosses = sportItems.filter((item) => item.result === 'lost').length;
    const sportPushes = sportItems.filter((item) => item.result === 'push').length;
    const rate = sportWins + sportLosses ? Math.round((sportWins / (sportWins + sportLosses)) * 100) : 0;
    return { sport, total: sportItems.length, wins: sportWins, losses: sportLosses, pushes: sportPushes, rate };
  }).filter((row) => row.total > 0);

  return (
    <WidgetCard icon={<BarChart3 />} title="Performance" subtitle="Cumulative returns and results from every graded ticket.">
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto scrollbar-transparent" aria-label="Performance filters">
        <FilterPill
          icon={<Trophy />}
          label="Sport"
          defaultValue="all"
          value={sport}
          onChange={(value) => setSport(value as Sport | 'all')}
          options={[
            { value: 'all', label: 'All Sports' },
            ...SPORTS.map((value) => ({ value, label: value.toUpperCase() })),
          ]}
        />
        <FilterPill
          icon={<Calendar />}
          label="All Time"
          defaultValue="all_time"
          value={timeframe}
          onChange={(value) => setTimeframe(value as LeaderboardTimeframe)}
          options={[
            { value: 'all_time', label: 'All Time' },
            { value: 'last_7_days', label: '7 Days' },
            { value: 'last_30_days', label: '30 Days' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <AgentStatTile label="Total Picks" value={`${items.length}`} />
        <AgentStatTile label="Win Rate" value={winRate === '--' ? '--' : `${winRate}%`} />
        <AgentStatTile label="Net Units" value={formatNetUnits(running)} positive={running > 0} negative={running < 0} />
        <AgentStatTile label="Best Streak" value={`${bestStreak}`} />
      </div>

      <div className="mt-3 rounded-2xl border border-border/60 bg-background/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-foreground">Cumulative Units</p>
          <p className={`font-mono text-sm font-extrabold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>{formatNetUnits(running)}</p>
        </div>
        {picksLoading || parlaysLoading ? (
          <div className="h-[180px] animate-pulse rounded-xl bg-muted/50" />
        ) : items.length === 0 ? (
          <div className="flex h-[180px] items-center justify-center px-6 text-center text-sm text-muted-foreground">No graded tickets match these filters. Try another sport or timeframe.</div>
        ) : chartData.length < 4 ? (
          <div className="flex h-[180px] items-center justify-center px-6 text-center text-sm text-muted-foreground">A performance trend will appear after three tickets are graded in this slice.</div>
        ) : (
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs><linearGradient id={`agent-units-${agent.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={lineColor} stopOpacity={0.3} /><stop offset="100%" stopColor={lineColor} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="currentColor" className="text-border/45" vertical={false} />
                <XAxis dataKey="index" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(value) => value === 0 ? 'Start' : value === chartData.length - 1 ? 'Now' : ''} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`} />
                <Tooltip formatter={(value: number) => [`${value > 0 ? '+' : ''}${value.toFixed(2)}u`, 'Units']} labelFormatter={(index) => chartData[Number(index)]?.label ?? ''} contentStyle={{ borderRadius: 12, borderColor: 'hsl(var(--border))', background: 'hsl(var(--popover))' }} />
                <Area type="monotone" dataKey="units" stroke={lineColor} strokeWidth={2.5} fill={`url(#agent-units-${agent.id})`} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {sportRows.length > 1 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">By Sport</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {sportRows.map(({ sport, total, wins, losses, pushes, rate }) => (
              <div key={sport} className="rounded-xl border border-border/55 bg-background/30 p-3">
                <div className="flex items-center justify-between"><span className="text-sm font-extrabold uppercase">{sport}</span><span className="text-xs font-bold text-muted-foreground">{wins}-{losses}{pushes ? `-${pushes}` : ''}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${rate}%`, background: agent.avatar_color }} /></div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{rate}% win rate · {total} graded</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
