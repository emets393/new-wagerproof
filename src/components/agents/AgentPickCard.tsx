import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Clock3, DollarSign, Diff, FileSearch, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgentPick, BetType, PickResult, Scale1To5, Sport } from '@/types/agent';
import { AgentOverlapFooter } from './AgentOverlapFooter';
import { formatAgentBetTypeLabel, formatAgentPickSelection } from '@/utils/agentPickDisplay';
import {
  getCFBTeamInitials,
  getNCAABTeamInitials,
  getNBATeamInitials,
  getNFLTeamInitials,
} from '@/utils/teamColors';
import { MLB_FALLBACK_BY_NAME } from '@/utils/mlbTeamLogos';

interface AgentPickCardProps {
  pick: AgentPick;
  onOpenAudit?: (pick: AgentPick) => void;
}

const BET_TYPE_LABELS: Record<Exclude<BetType, 'any'>, string> = {
  spread: 'Spread',
  moneyline: 'ML',
  total: 'Total',
  prop: 'Prop',
};

const BET_TYPE_COLORS: Record<Exclude<BetType, 'any'>, string> = {
  spread: '#3b82f6',
  moneyline: '#8b5cf6',
  total: '#06b6d4',
  prop: '#f59e0b',
};

// Result colors aligned to the iOS bet-slip card (WIN/LOSS/PUSH).
const RESULT_CONFIG: Record<PickResult, { label: string; color: string; bgColor: string }> = {
  won: { label: 'WON', color: '#22C55E', bgColor: 'rgba(34, 197, 94, 0.15)' },
  lost: { label: 'LOST', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  push: { label: 'PUSH', color: '#EAB308', bgColor: 'rgba(234, 179, 8, 0.15)' },
  pending: { label: 'PENDING', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
};

// iOS bet-slip top accent gradient (indigo → cyan → green → amber).
const SLIP_ACCENT = 'linear-gradient(90deg, #4F46E5, #06B6D4, #10B981, #F59E0B)';

/** Icon disc for the pick pill: O/U arrows, ± for spread, $ for moneyline. */
function PickIconDisc({ pick }: { pick: AgentPick }) {
  const isOver = (pick.pick_selection || '').toLowerCase().includes('over');
  const config =
    pick.bet_type === 'total'
      ? isOver
        ? { icon: <ArrowUp className="h-3 w-3" />, color: '#22C55E' }
        : { icon: <ArrowDown className="h-3 w-3" />, color: '#EF4444' }
      : pick.bet_type === 'spread'
        ? { icon: <Diff className="h-3 w-3" />, color: '#3B82F6' }
        : { icon: <DollarSign className="h-3 w-3" />, color: '#22C55E' };

  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
      style={{ color: config.color, backgroundColor: `${config.color}20` }}
    >
      {config.icon}
    </span>
  );
}

function parseMatchup(matchup: string): { away: string; home: string } {
  const separators = [' @ ', ' vs. ', ' vs '];
  for (const sep of separators) {
    const idx = matchup.indexOf(sep);
    if (idx !== -1) {
      return { away: matchup.substring(0, idx).trim(), home: matchup.substring(idx + sep.length).trim() };
    }
  }
  return { away: matchup, home: '' };
}

// Mirrors the mobile formatGameDate helper: shows Today / Tomorrow / "Apr 20"
// so the date badge stays short. Falls back to the raw string on parse errors.
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
  // Fuzzy: match on prefix/suffix so "Cincinnati" alone still resolves.
  for (const [mapKey, mapVal] of Object.entries(MLB_FALLBACK_BY_NAME)) {
    if (mapKey.includes(key) || key.includes(mapKey)) return mapVal.team;
  }
  return null;
}

function teamAbbr(teamName: string, sport: Sport) {
  if (sport === 'nfl') return getNFLTeamInitials(teamName);
  if (sport === 'cfb') return getCFBTeamInitials(teamName);
  if (sport === 'nba') return getNBATeamInitials(teamName);
  if (sport === 'mlb') {
    // Use the real MLB mapping (BOS, NYY, TB...) instead of NCAAB fallthrough.
    return lookupMLBAbbr(teamName) ?? teamName.substring(0, 3).toUpperCase();
  }
  return getNCAABTeamInitials(teamName);
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

export function AgentPickCard({ pick, onOpenAudit }: AgentPickCardProps) {
  const result = RESULT_CONFIG[pick.result];
  const betTypeColor = BET_TYPE_COLORS[pick.bet_type];

  const { away, home } = useMemo(() => parseMatchup(pick.matchup), [pick.matchup]);
  const awayAbbr = teamAbbr(away, pick.sport);
  const homeAbbr = teamAbbr(home, pick.sport);

  // Compact pick text: use the team abbreviation on ML/spread picks so long
  // names don't truncate. Spread keeps its line (e.g. "MIN -3.5"), ML renders
  // as "MIN ML", totals render verbatim ("Over 225.5").
  const displaySelection = useMemo(() => {
    if (pick.bet_type === 'total') return formatAgentPickSelection(pick);
    const selectionLower = (pick.pick_selection || '').toLowerCase();
    const pickedAbbr = selectionLower.includes(awayAbbr.toLowerCase()) || selectionLower.includes(away.toLowerCase())
      ? awayAbbr
      : homeAbbr;
    if (pick.bet_type === 'spread') {
      const lineMatch = (pick.pick_selection || '').match(/[+-]\d+(?:\.\d+)?/);
      const compactSpread = lineMatch ? `${pickedAbbr} ${lineMatch[0]}` : pickedAbbr;
      return formatAgentPickSelection(pick, compactSpread);
    }
    return formatAgentPickSelection(pick, `${pickedAbbr} ML`);
  }, [pick.bet_type, pick.period, pick.pick_selection, awayAbbr, homeAbbr, away]);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className="overflow-hidden rounded-xl border-border/70 bg-card/95 transition-colors hover:border-primary/45">
        <div className="h-[3px] w-full" style={{ background: SLIP_ACCENT }} />

        <CardContent className="p-4">
          <button type="button" onClick={() => onOpenAudit?.(pick)} className="w-full text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span>{awayAbbr}</span>
                  <span className="text-muted-foreground">@</span>
                  <span>{homeAbbr}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{pick.matchup}</p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant="outline" className="text-[10px] h-6">
                  <Clock3 className="h-3 w-3 mr-1" /> {formatGameDate(pick.game_date)}
                </Badge>
                {pick.result !== 'pending' ? (
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-md"
                    style={{ color: result.color, backgroundColor: result.bgColor }}
                  >
                    {result.label}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <PickIconDisc pick={pick} />
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-md"
                style={{ color: betTypeColor, backgroundColor: `${betTypeColor}20` }}
              >
                {formatAgentBetTypeLabel(BET_TYPE_LABELS[pick.bet_type], pick)}
              </span>
              <p className="text-sm font-semibold truncate">{displaySelection}</p>
              {pick.odds ? (
                <span className="rounded-full bg-muted/70 px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
                  {pick.odds}
                </span>
              ) : null}
              <span className="ml-auto rounded-full px-2 py-0.5 font-mono text-[11px] font-bold" style={{ color: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
                {pick.units}u
              </span>
            </div>

            <div className="flex items-center mt-3 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Confidence</span>
                <ConfidenceDots confidence={pick.confidence} />
              </div>
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-primary font-medium">
                <FileSearch className="h-3.5 w-3.5" />
                View audit
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-border/70 space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reasoning</p>
              <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">{pick.reasoning_text}</p>

              {pick.key_factors?.length ? (
                <div className="pt-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Key Factors</p>
                  <div className="space-y-1">
                    {pick.key_factors.slice(0, 2).map((factor, idx) => (
                      <div key={`${pick.id}-factor-${idx}`} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5 text-primary mt-[2px]" />
                        <span className="line-clamp-1">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </button>
          {pick.overlap && pick.overlap.totalCount > 0 && (
            <AgentOverlapFooter overlap={pick.overlap} />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
