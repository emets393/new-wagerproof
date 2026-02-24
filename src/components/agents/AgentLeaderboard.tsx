import { motion } from 'framer-motion';
import { ChevronRight, Medal, Trophy } from 'lucide-react';
import { LeaderboardEntry } from '@/services/agentPerformanceService';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNetUnits, Sport } from '@/types/agent';

interface AgentLeaderboardProps {
  rows: LeaderboardEntry[];
  onRowClick?: (avatarId: string) => void;
}

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

function getPrimaryColor(value: string): string {
  if (value.startsWith('gradient:')) return value.replace('gradient:', '').split(',')[0];
  return value;
}

export function AgentLeaderboard({ rows, onRowClick }: AgentLeaderboardProps) {
  if (!rows.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No public agents available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((entry, idx) => {
        const rank = idx + 1;
        const record = `${entry.wins}-${entry.losses}${entry.pushes > 0 ? `-${entry.pushes}` : ''}`;
        const winRate = entry.win_rate ? `${(entry.win_rate * 100).toFixed(1)}%` : '--';
        const units = formatNetUnits(entry.net_units);
        const unitsPositive = entry.net_units >= 0;
        const avatarColor = getPrimaryColor(entry.avatar_color || '#6366f1');

        return (
          <motion.div
            key={entry.avatar_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.02 }}
            onClick={() => onRowClick?.(entry.avatar_id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick?.(entry.avatar_id); } }}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            className={onRowClick ? 'cursor-pointer' : undefined}
          >
            <Card className="border-border/70 bg-card/95 transition-colors hover:border-primary/40">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-7 text-center">
                    {rank === 1 ? (
                      <Trophy className="h-5 w-5 text-yellow-400 mx-auto" />
                    ) : rank === 2 ? (
                      <Medal className="h-5 w-5 text-slate-300 mx-auto" />
                    ) : rank === 3 ? (
                      <Medal className="h-5 w-5 text-amber-600 mx-auto" />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">{rank}</span>
                    )}
                  </div>

                  <div className="h-9 w-9 rounded-lg grid place-items-center text-lg" style={{ background: `${avatarColor}22` }}>
                    {entry.avatar_emoji || '🤖'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{entry.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {entry.preferred_sports.slice(0, 2).map((sport) => (
                        <Badge key={`${entry.avatar_id}-${sport}`} variant="outline" className="text-[10px] h-5 px-2">
                          {SPORT_LABELS[sport]}
                        </Badge>
                      ))}
                      {entry.preferred_sports.length > 2 ? (
                        <Badge variant="outline" className="text-[10px] h-5 px-2">+{entry.preferred_sports.length - 2}</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{record}</p>
                    <p className={`text-sm font-bold ${unitsPositive ? 'text-emerald-500' : 'text-red-500'}`}>{units}</p>
                  </div>

                  <div className="text-right min-w-[52px]">
                    <p className="text-xs text-primary font-semibold">{winRate}</p>
                    <p className="text-[11px] text-muted-foreground">WR</p>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
