import { Check, Minus, X } from 'lucide-react';
import { GlassCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import type { CompGame, CompPick } from '../types';
import { formatCoverPoints, formatSignedLine, matchupLabel, pickSummaryLabel } from '../format';

export function GradedPicksView({
  picks,
  gamesById,
}: {
  picks: CompPick[];
  gamesById: Map<number, CompGame>;
}) {
  const weekPts = picks.reduce((s, p) => s + (p.points ?? 0), 0);

  if (picks.length === 0) {
    return (
      <GlassCard radius={18} className="p-6 text-center text-[13px] text-muted-foreground">
        You sat this week out — no penalty.
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      <GlassCard radius={18} className="flex items-center justify-between p-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Week points
          </div>
          <div className="mt-1 font-mono text-[28px] font-black">{weekPts}</div>
        </div>
      </GlassCard>

      {picks.map((p) => {
        const game = gamesById.get(p.game_id);
        const Icon =
          p.result === 'win' ? Check : p.result === 'loss' ? X : Minus;
        return (
          <div
            key={p.id}
            className={cn(
              'rounded-2xl border p-3.5',
              p.result === 'win' && 'border-emerald-500/30 bg-emerald-500/10',
              p.result === 'loss' && 'border-rose-500/30 bg-rose-500/10',
              (p.result === 'push' || !p.result) &&
                'border-black/5 bg-white/50 dark:border-white/10 dark:bg-white/[0.04]'
            )}
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 items-center justify-center rounded-full',
                  p.result === 'win' && 'bg-emerald-500/20 text-emerald-600',
                  p.result === 'loss' && 'bg-rose-500/20 text-rose-600',
                  (p.result === 'push' || !p.result) && 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-muted-foreground">
                  {game ? matchupLabel(game) : 'Game'}
                  {p.is_potw ? ' · POTW' : ''}
                </div>
                <div className="font-bold">
                  {pickSummaryLabel(game, { market: p.market, side: p.side, line: p.line })}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                  <span>Stamped {formatSignedLine(p.line)}</span>
                  {game?.is_final && (
                    <span>
                      Final {game.away_score}-{game.home_score}
                    </span>
                  )}
                  {p.cover_points != null && (
                    <span className="font-mono font-semibold">
                      Cover {formatCoverPoints(p.cover_points)}
                    </span>
                  )}
                  {p.points != null && <span>{p.points} pt{p.points === 1 ? '' : 's'}</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
