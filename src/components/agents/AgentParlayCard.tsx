import { motion } from 'framer-motion';
import { Link2 } from 'lucide-react';
import { AgentParlay, AgentParlayLeg, Sport } from '@/types/agent';
import {
  AgentTicketShell,
  TicketSportIcon,
  TICKET_STATUS,
  TicketStamp,
  TicketStatusPill,
  useTicketTear,
} from './AgentTicketShell';
import { AgentReasoningDetails } from './AgentReasoningDetails';

interface AgentParlayCardProps {
  parlay: AgentParlay;
  /** Agent brand tint — drives the badge, units stamp + confidence dots. */
  accent?: string;
}

const LEG_MARKET_LABELS: Record<AgentParlayLeg['bet_type'], string> = {
  spread: 'Spread',
  moneyline: 'ML',
  total: 'Total',
  prop: 'Prop',
  team_total: 'Team Total',
};

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'CBB',
  mlb: 'MLB',
};

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

function legMarket(leg: AgentParlayLeg): string {
  const base = LEG_MARKET_LABELS[leg.bet_type] ?? leg.bet_type;
  const marker = leg.period === 'f5' ? 'F5 ' : leg.period === 'h1' ? '1H ' : '';
  return `${marker}${base}`;
}

/** One leg inside the ticket: result dot, selection, market · matchup, odds. */
function LegRow({ leg, showDivider }: { leg: AgentParlayLeg; showDivider: boolean }) {
  const color = TICKET_STATUS[leg.leg_result].color;
  const dotColor = leg.leg_result === 'pending' ? 'rgba(255,255,255,0.4)' : color;
  const selection = leg.pick_selection ?? '';
  const marker = leg.period === 'f5' ? 'F5' : leg.period === 'h1' ? '1H' : '';
  const periodPrefix = marker && !selection.toUpperCase().includes(marker) ? `${marker} ` : '';

  return (
    <div className={showDivider ? 'border-b border-dashed border-stone-300 dark:border-white/10' : ''}>
      <div className="flex items-center gap-2.5 py-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} title={TICKET_STATUS[leg.leg_result].text} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold text-slate-950 dark:text-white">
            {periodPrefix}
            {leg.pick_selection}
          </p>
          <p className="flex items-center gap-1.5 truncate text-[12px] text-slate-500 dark:text-white/50">
            <TicketSportIcon sport={leg.sport} className="h-3 w-3 shrink-0" />
            <span>{legMarket(leg)}</span>
            <span className="text-slate-400 dark:text-white/30">·</span>
            <span className="truncate">{leg.matchup}</span>
          </p>
        </div>
        <span className="shrink-0 font-mono text-[14px] font-semibold text-slate-800 dark:text-white/90">{leg.odds || '—'}</span>
      </div>
    </div>
  );
}

/**
 * Multi-leg parlay in the same boarding-pass vocabulary as AgentPickCard: the
 * single away↔home route row becomes a stack of compact leg rows, and the
 * per-pick stamps become one ticket-level Legs / Combined Odds / Units row.
 */
export function AgentParlayCard({ parlay, accent = '#00E676' }: AgentParlayCardProps) {
  const { topRef, tear } = useTicketTear(180);
  const legs = [...(parlay.legs ?? [])].sort((a, b) => a.game_date.localeCompare(b.game_date));

  const sports = Array.from(new Set(legs.map((l) => l.sport)));
  const sportLabel = sports.length === 1 ? `${SPORT_LABELS[sports[0]]} ticket` : 'Cross-sport ticket';
  const reasoning = (parlay.reasoning_text || '').trim();

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <AgentTicketShell tear={tear}>
        <Link2 className="pointer-events-none absolute -right-7 -top-7 h-32 w-32 text-slate-900 opacity-[0.035] dark:text-white dark:opacity-[0.04]" strokeWidth={1.2} />
        {/* Top section — header + legs, measured to place the tear below them. */}
        <div ref={topRef} className="px-5 pb-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-[14px] font-medium text-slate-500 dark:text-white/60">{formatGameDate(parlay.target_date)}</span>
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
                style={{ color: accent, backgroundColor: `${accent}24` }}
              >
                <Link2 className="h-2.5 w-2.5" />
                {parlay.legs_count}-Leg
              </span>
            </div>
            <TicketStatusPill result={parlay.result} />
          </div>

          <div className="mt-2">
            {legs.map((leg, i) => (
              <LegRow key={leg.id} leg={leg} showDivider={i < legs.length - 1} />
            ))}
          </div>
        </div>

        {/* Stub — Legs / Combined Odds / Units, then sport label + confidence. */}
        <div className="space-y-3 px-5 pb-4 pt-3.5">
          <div className="flex items-start justify-between gap-3">
            <TicketStamp label="Legs" value={`${parlay.legs_count}`} align="left" />
            <TicketStamp label="Combined Odds" value={parlay.combined_odds || '—'} align="center" />
            <TicketStamp label="Units" value={`${parlay.units}u`} align="right" tint={accent} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-slate-600 dark:text-white/60">{sportLabel}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-white/45">Conf</span>
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="h-[7px] w-[7px] rounded-full bg-stone-300 dark:bg-white/15"
                    style={i < parlay.confidence ? { backgroundColor: accent } : undefined}
                  />
                ))}
              </div>
            </div>
          </div>

          <AgentReasoningDetails reasoning={reasoning} keyFactors={parlay.key_factors} accent={accent} />
        </div>
      </AgentTicketShell>
    </motion.div>
  );
}
