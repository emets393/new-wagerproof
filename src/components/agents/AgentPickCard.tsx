import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock3, FileSearch, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgentPick, BetType, PickResult, Scale1To5, Sport } from '@/types/agent';
import { AgentOverlapFooter } from './AgentOverlapFooter';
import {
  getCFBTeamColors,
  getCFBTeamInitials,
  getNCAABTeamColors,
  getNCAABTeamInitials,
  getNBATeamColors,
  getNBATeamInitials,
  getNFLTeamColors,
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
};

const BET_TYPE_COLORS: Record<Exclude<BetType, 'any'>, string> = {
  spread: '#3b82f6',
  moneyline: '#8b5cf6',
  total: '#06b6d4',
};

const RESULT_CONFIG: Record<PickResult, { label: string; color: string; bgColor: string }> = {
  won: { label: 'WON', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
  lost: { label: 'LOST', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  push: { label: 'PUSH', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.15)' },
  pending: { label: 'PENDING', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
};

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

function teamColors(teamName: string, sport: Sport) {
  if (sport === 'nfl') return getNFLTeamColors(teamName);
  if (sport === 'cfb') return getCFBTeamColors(teamName);
  if (sport === 'nba') return getNBATeamColors(teamName);
  return getNCAABTeamColors(teamName);
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
  const awayColors = teamColors(away, pick.sport);
  const homeColors = teamColors(home, pick.sport);

  // Compact pick text: use the team abbreviation on ML/spread picks so long
  // names don't truncate. Spread keeps its line (e.g. "MIN -3.5"), ML renders
  // as "MIN ML", totals render verbatim ("Over 225.5").
  const displaySelection = useMemo(() => {
    if (pick.bet_type === 'total') return pick.pick_selection;
    const selectionLower = (pick.pick_selection || '').toLowerCase();
    const pickedAbbr = selectionLower.includes(awayAbbr.toLowerCase()) || selectionLower.includes(away.toLowerCase())
      ? awayAbbr
      : homeAbbr;
    if (pick.bet_type === 'spread') {
      const lineMatch = (pick.pick_selection || '').match(/[+-]\d+(?:\.\d+)?/);
      return lineMatch ? `${pickedAbbr} ${lineMatch[0]}` : pickedAbbr;
    }
    return `${pickedAbbr} ML`;
  }, [pick.bet_type, pick.pick_selection, awayAbbr, homeAbbr, away]);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className="overflow-hidden border-border/70 bg-card/95 transition-colors hover:border-primary/45">
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(90deg, ${awayColors.primary}, ${awayColors.secondary}, ${homeColors.primary}, ${homeColors.secondary})`,
          }}
        />

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
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-md"
                style={{ color: betTypeColor, backgroundColor: `${betTypeColor}20` }}
              >
                {BET_TYPE_LABELS[pick.bet_type]}
              </span>
              <p className="text-sm font-semibold truncate">{displaySelection}</p>
              {pick.odds ? <p className="text-xs text-muted-foreground">({pick.odds})</p> : null}
              <span className="ml-auto text-xs text-muted-foreground">{pick.units}u</span>
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
