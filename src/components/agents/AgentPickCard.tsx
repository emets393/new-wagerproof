import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AgentPick, Sport } from '@/types/agent';
import { AgentOverlapFooter } from './AgentOverlapFooter';
import {
  AgentTicketShell,
  resolveTicketLogo,
  TicketSportIcon,
  TICKET_STATUS,
  TicketConfidence,
  TicketStamp,
  TicketStatusPill,
  TicketTeamDisc,
  teamColorPair,
  useTicketTear,
} from './AgentTicketShell';
import { formatAgentPickSelection } from '@/utils/agentPickDisplay';
import { AgentReasoningDetails } from './AgentReasoningDetails';
import {
  getCFBTeamInitials,
  getNCAABTeamInitials,
  getNBATeamInitials,
  getNFLTeamInitials,
} from '@/utils/teamColors';
import { MLB_FALLBACK_BY_NAME } from '@/utils/mlbTeamLogos';

interface AgentPickCardProps {
  pick: AgentPick;
  /** Agent brand tint — drives the units stamp + confidence dots. */
  accent?: string;
  onOpenAudit?: (pick: AgentPick) => void;
}

// Short market label for the stub stamp ("Moneyline" / "Spread" / "Total").
const MARKET_LABELS: Record<string, string> = {
  moneyline: 'Moneyline',
  spread: 'Spread',
  total: 'Total',
  prop: 'Prop',
};

export function parseMatchup(matchup: string): { away: string; home: string } {
  const separators = [' @ ', ' vs. ', ' vs '];
  for (const sep of separators) {
    const idx = matchup.indexOf(sep);
    if (idx !== -1) {
      return { away: matchup.substring(0, idx).trim(), home: matchup.substring(idx + sep.length).trim() };
    }
  }
  return { away: matchup, home: '' };
}

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

function lookupMLBAbbr(teamName: string): string | null {
  if (!teamName) return null;
  const key = teamName.trim().toLowerCase().replace(/[.'']/g, '').replace(/\s+/g, ' ');
  const hit = MLB_FALLBACK_BY_NAME[key];
  if (hit) return hit.team;
  for (const [mapKey, mapVal] of Object.entries(MLB_FALLBACK_BY_NAME)) {
    if (mapKey.includes(key) || key.includes(mapKey)) return mapVal.team;
  }
  return null;
}

export function teamAbbr(teamName: string, sport: Sport) {
  if (sport === 'nfl') return getNFLTeamInitials(teamName);
  if (sport === 'cfb') return getCFBTeamInitials(teamName);
  if (sport === 'nba') return getNBATeamInitials(teamName);
  if (sport === 'mlb') return lookupMLBAbbr(teamName) ?? teamName.substring(0, 3).toUpperCase();
  return getNCAABTeamInitials(teamName);
}

/** AWAY ●――⚾――● HOME route header: team-colored discs joined by the dashed
 *  route line with the sport glyph riding the middle (iOS PickRouteLineRow). */
export function PickRouteRow({
  awayAbbr,
  homeAbbr,
  awayColors,
  homeColors,
  awayLogo,
  homeLogo,
  sport,
  dotColor,
}: {
  awayAbbr: string;
  homeAbbr: string;
  awayColors: { primary: string; secondary: string };
  homeColors: { primary: string; secondary: string };
  awayLogo: string | null;
  homeLogo: string | null;
  sport: Sport;
  dotColor: string;
}) {
  const dashed = <span className="h-px flex-1 border-t border-dashed border-slate-400/60 dark:border-white/20" />;
  const dot = <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />;
  return (
    <div className="flex items-center gap-2.5">
      <TicketTeamDisc code={awayAbbr} primary={awayColors.primary} secondary={awayColors.secondary} logoUrl={awayLogo} />
      <div className="flex flex-1 items-center gap-1.5">
        {dot}
        {dashed}
        <TicketSportIcon sport={sport} className="h-[14px] w-[14px] shrink-0 text-slate-500 dark:text-white/55" />
        {dashed}
        {dot}
      </div>
      <TicketTeamDisc code={homeAbbr} primary={homeColors.primary} secondary={homeColors.secondary} logoUrl={homeLogo} />
    </div>
  );
}

export function AgentPickCard({ pick, accent = '#00E676', onOpenAudit }: AgentPickCardProps) {
  const status = TICKET_STATUS[pick.result];
  const { topRef, tear } = useTicketTear(150);

  const { away, home } = useMemo(() => parseMatchup(pick.matchup), [pick.matchup]);
  const awayAbbr = teamAbbr(away, pick.sport);
  const homeAbbr = teamAbbr(home, pick.sport);
  const awayColors = useMemo(() => teamColorPair(away, pick.sport, awayAbbr), [away, pick.sport, awayAbbr]);
  const homeColors = useMemo(() => teamColorPair(home, pick.sport, homeAbbr), [home, pick.sport, homeAbbr]);
  const awayLogo = useMemo(() => resolveTicketLogo(away, pick.sport, awayAbbr), [away, pick.sport, awayAbbr]);
  const homeLogo = useMemo(() => resolveTicketLogo(home, pick.sport, homeAbbr), [home, pick.sport, homeAbbr]);

  // Compact selection: team abbrev on ML/spread so long names don't truncate.
  const displaySelection = useMemo(() => {
    if (pick.bet_type === 'total') return formatAgentPickSelection(pick);
    const selectionLower = (pick.pick_selection || '').toLowerCase();
    const pickedAbbr =
      selectionLower.includes(awayAbbr.toLowerCase()) || selectionLower.includes(away.toLowerCase())
        ? awayAbbr
        : homeAbbr;
    if (pick.bet_type === 'spread') {
      const lineMatch = (pick.pick_selection || '').match(/[+-]\d+(?:\.\d+)?/);
      const compactSpread = lineMatch ? `${pickedAbbr} ${lineMatch[0]}` : pickedAbbr;
      return formatAgentPickSelection(pick, compactSpread);
    }
    return formatAgentPickSelection(pick, `${pickedAbbr} ML`);
  }, [pick, awayAbbr, homeAbbr, away]);

  const marketLabel = MARKET_LABELS[pick.bet_type] ?? 'Pick';
  const reasoning = (pick.reasoning_text || '').trim();

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <AgentTicketShell tear={tear} interactive onClick={() => onOpenAudit?.(pick)}>
        <TicketSportIcon sport={pick.sport} className="pointer-events-none absolute -right-7 -top-7 h-32 w-32 text-slate-900 opacity-[0.04] dark:text-white dark:opacity-[0.045]" />
        {/* Top section — measured to place the tear on its bottom edge. */}
        <div ref={topRef} className="px-5 pb-3.5 pt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-medium text-slate-500 dark:text-white/60">{formatGameDate(pick.game_date)}</span>
            <TicketStatusPill result={pick.result} />
          </div>

          {/* The pick, promoted to the hero line. */}
          <p className="mt-3 truncate text-[26px] font-black leading-tight text-slate-950 dark:text-white">{displaySelection}</p>

          <div className="mt-3">
            <PickRouteRow
              awayAbbr={awayAbbr}
              homeAbbr={homeAbbr}
              awayColors={awayColors}
              homeColors={homeColors}
              awayLogo={awayLogo}
              homeLogo={homeLogo}
              sport={pick.sport}
              dotColor={pick.result === 'pending' ? 'rgba(255,255,255,0.4)' : status.color}
            />
          </div>
        </div>

        {/* Stub — market / odds / units stamps, confidence, reasoning snippet. */}
        <div className="space-y-3 px-5 pb-4 pt-3.5">
          <div className="flex items-start justify-between gap-3">
            <TicketStamp label="Market" value={marketLabel} align="left" />
            <TicketStamp label="Odds" value={pick.odds || '—'} align="center" />
            <TicketStamp label="Units" value={`${pick.units}u`} align="right" tint={accent} />
          </div>

          <TicketConfidence confidence={pick.confidence} accent={accent} />

          <AgentReasoningDetails reasoning={reasoning} keyFactors={pick.key_factors} trace={pick.ai_decision_trace} accent={accent} />
        </div>

        {pick.overlap && pick.overlap.totalCount > 0 && (
          <div className="px-5 pb-4">
            <AgentOverlapFooter overlap={pick.overlap} />
          </div>
        )}
      </AgentTicketShell>
    </motion.div>
  );
}
