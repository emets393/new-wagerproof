import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock3, FileSearch, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgentPick, BetType, PickResult, Scale1To5, Sport } from '@/types/agent';
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

function teamColors(teamName: string, sport: Sport) {
  if (sport === 'nfl') return getNFLTeamColors(teamName);
  if (sport === 'cfb') return getCFBTeamColors(teamName);
  if (sport === 'nba') return getNBATeamColors(teamName);
  return getNCAABTeamColors(teamName);
}

function teamAbbr(teamName: string, sport: Sport) {
  if (sport === 'nfl') return getNFLTeamInitials(teamName);
  if (sport === 'cfb') return getCFBTeamInitials(teamName);
  if (sport === 'nba') return getNBATeamInitials(teamName);
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

              {pick.result === 'pending' ? (
                <Badge variant="outline" className="text-[10px] h-6">
                  <Clock3 className="h-3 w-3 mr-1" /> {pick.game_date || 'Pending'}
                </Badge>
              ) : (
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-md"
                  style={{ color: result.color, backgroundColor: result.bgColor }}
                >
                  {result.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-md"
                style={{ color: betTypeColor, backgroundColor: `${betTypeColor}20` }}
              >
                {BET_TYPE_LABELS[pick.bet_type]}
              </span>
              <p className="text-sm font-semibold truncate">{pick.pick_selection}</p>
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
        </CardContent>
      </Card>
    </motion.div>
  );
}
