import { motion } from 'framer-motion';
import { Clock3, Layers, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgentParlay, AgentParlayLeg, PickResult, Scale1To5 } from '@/types/agent';

// Result colors match AgentPickCard (iOS bet-slip WIN/LOSS/PUSH).
const RESULT_CONFIG: Record<PickResult, { label: string; color: string; bgColor: string }> = {
  won: { label: 'WON', color: '#22C55E', bgColor: 'rgba(34, 197, 94, 0.15)' },
  lost: { label: 'LOST', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  push: { label: 'PUSH', color: '#EAB308', bgColor: 'rgba(234, 179, 8, 0.15)' },
  pending: { label: 'PENDING', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
};

const LEG_BET_TYPE_LABELS: Record<AgentParlayLeg['bet_type'], string> = {
  spread: 'Spread',
  moneyline: 'ML',
  total: 'Total',
  prop: 'Prop',
  team_total: 'Team Total',
};

// Parlay tickets get a distinct purple accent so they read differently from
// straight-pick cards at a glance.
const PARLAY_ACCENT = 'linear-gradient(90deg, #7C3AED, #A855F7, #EC4899)';

function formatGameDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Pending';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function ConfidenceDots({ confidence }: { confidence: Scale1To5 }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((level) => (
        <span
          key={level}
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: level <= confidence ? '#22c55e' : 'rgba(148, 163, 184, 0.35)' }}
        />
      ))}
    </div>
  );
}

function LegRow({ leg }: { leg: AgentParlayLeg }) {
  const legResult = RESULT_CONFIG[leg.leg_result];
  // Selection text often already carries the period marker ("Yankees F5 -0.5")
  // — only prefix when it doesn't, so we never render "F5 ... F5 ...".
  const selection = leg.pick_selection ?? '';
  const marker = leg.period === 'f5' ? 'F5' : leg.period === 'h1' ? '1H' : '';
  const periodPrefix = marker && !selection.toUpperCase().includes(marker) ? `${marker} ` : '';
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: leg.leg_result === 'pending' ? 'rgba(148, 163, 184, 0.5)' : legResult.color }}
        title={legResult.label}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {periodPrefix}
          {leg.pick_selection}
        </p>
        <p className="truncate text-xs text-muted-foreground">{leg.matchup}</p>
      </div>
      <span className="shrink-0 rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
        {LEG_BET_TYPE_LABELS[leg.bet_type] ?? leg.bet_type}
      </span>
      {leg.odds ? (
        <span className="shrink-0 rounded-full bg-muted/70 px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
          {leg.odds}
        </span>
      ) : null}
    </div>
  );
}

interface AgentParlayCardProps {
  parlay: AgentParlay;
}

/**
 * Parlay ticket card for pick history: header (legs count, combined odds,
 * result), one row per leg with its own result dot, then reasoning. Visual
 * language mirrors AgentPickCard so tickets slot into the same grid.
 */
export function AgentParlayCard({ parlay }: AgentParlayCardProps) {
  const result = RESULT_CONFIG[parlay.result];
  const legs = [...(parlay.legs ?? [])].sort((a, b) => a.game_date.localeCompare(b.game_date));

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className="overflow-hidden rounded-xl border-border/70 bg-card/95 transition-colors hover:border-primary/45">
        <div className="h-[3px] w-full" style={{ background: PARLAY_ACCENT }} />

        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ color: '#A855F7', backgroundColor: 'rgba(168, 85, 247, 0.15)' }}>
                <Layers className="h-3 w-3" />
              </span>
              <span className="text-sm font-semibold">{parlay.legs_count}-Leg Parlay</span>
              {parlay.combined_odds ? (
                <span className="rounded-full bg-muted/70 px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
                  {parlay.combined_odds}
                </span>
              ) : null}
            </div>

            <div className="flex flex-shrink-0 items-center gap-1.5">
              <Badge variant="outline" className="h-6 text-[10px]">
                <Clock3 className="mr-1 h-3 w-3" /> {formatGameDate(parlay.target_date)}
              </Badge>
              {parlay.result !== 'pending' ? (
                <span
                  className="rounded-md px-2.5 py-1 text-[10px] font-bold"
                  style={{ color: result.color, backgroundColor: result.bgColor }}
                >
                  {result.label}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-3 divide-y divide-border/50 rounded-md border border-border/50 px-2.5">
            {legs.map((leg) => (
              <LegRow key={leg.id} leg={leg} />
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Confidence</span>
            <ConfidenceDots confidence={parlay.confidence} />
            {parlay.actual_result ? (
              <span className="ml-2 truncate text-xs text-muted-foreground">{parlay.actual_result}</span>
            ) : null}
            <span className="ml-auto rounded-full px-2 py-0.5 font-mono text-[11px] font-bold" style={{ color: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
              {parlay.units}u
            </span>
          </div>

          {parlay.reasoning_text ? (
            <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reasoning</p>
              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{parlay.reasoning_text}</p>

              {parlay.key_factors?.length ? (
                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 pt-1">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Key Factors</p>
                  <div className="space-y-1">
                    {parlay.key_factors.slice(0, 2).map((factor, idx) => (
                      <div key={`${parlay.id}-factor-${idx}`} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <TrendingUp className="mt-[2px] h-3.5 w-3.5 text-primary" />
                        <span className="line-clamp-1">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}
