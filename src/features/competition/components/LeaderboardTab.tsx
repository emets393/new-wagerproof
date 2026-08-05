import { Info } from 'lucide-react';
import { GlassCard, SegmentedControl } from '@/components/ios';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { CompLeaderboardRow } from '../types';
import { formatCoverPoints } from '../format';

export function LeaderboardTab({
  mode,
  onModeChange,
  rows,
  isLoading,
  error,
}: {
  mode: 'week' | 'season';
  onModeChange: (m: 'week' | 'season') => void;
  rows: CompLeaderboardRow[] | undefined;
  isLoading: boolean;
  error: string | null;
}) {
  const { user } = useAuth();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          layoutId="comp-lb-mode"
          size="sm"
          options={[
            { value: 'week' as const, label: 'This Week' },
            { value: 'season' as const, label: 'Season' },
          ]}
          value={mode}
          onChange={onModeChange}
        />
        <p className="text-[11px] font-semibold text-muted-foreground">
          Ranked by pts · Cover settles ties
        </p>
      </div>

      {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />}

      {error && (
        <GlassCard radius={18} className="p-6 text-center text-[13px] text-muted-foreground">
          {error}
        </GlassCard>
      )}

      {!isLoading && !error && (rows?.length ?? 0) === 0 && (
        <GlassCard radius={18} className="p-6 text-center text-[13px] text-muted-foreground">
          Leaderboard is empty — season hasn&apos;t started scoring yet.
        </GlassCard>
      )}

      {!isLoading && rows && rows.length > 0 && (
        <GlassCard radius={18} className="overflow-hidden p-0">
          <div className="grid grid-cols-[36px_minmax(0,1fr)_64px_44px_64px] gap-1 border-b border-black/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:grid-cols-[40px_minmax(0,1fr)_72px_56px_72px] dark:border-white/10">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">W-L-P</span>
            <span className="text-right">Pts</span>
            <span className="flex items-center justify-end gap-0.5">
              Cover
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-[12px]">
                  How much your picks beat their lines by, cumulative. Settles ties when points are
                  equal.
                </TooltipContent>
              </Tooltip>
            </span>
          </div>
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {rows.map((r, i) => {
              const mine = user?.id === r.user_id;
              const prev = i > 0 ? rows[i - 1] : null;
              const tiedOnPts = prev != null && Number(prev.points) === Number(r.points);
              const top = Number(r.rank) <= 3;

              return (
                <div
                  key={r.user_id}
                  className={cn(
                    'grid grid-cols-[36px_minmax(0,1fr)_64px_44px_64px] gap-1 px-3 py-2.5 text-[13px] sm:grid-cols-[40px_minmax(0,1fr)_72px_56px_72px]',
                    mine && 'bg-amber-500/10',
                    top && !mine && 'bg-muted/20'
                  )}
                >
                  <span
                    className={cn(
                      'font-mono font-bold text-muted-foreground',
                      Number(r.rank) === 1 && 'text-amber-600 dark:text-amber-300',
                      Number(r.rank) === 2 && 'text-slate-500 dark:text-slate-300',
                      Number(r.rank) === 3 && 'text-orange-700/80 dark:text-orange-300'
                    )}
                  >
                    {r.rank}
                  </span>
                  <span
                    className={cn(
                      'truncate font-semibold',
                      mine && 'text-amber-800 dark:text-amber-200'
                    )}
                  >
                    {r.display_name}
                    {mine ? ' (you)' : ''}
                  </span>
                  <span className="text-right font-mono text-[12px] tabular-nums">
                    {r.wins}-{r.losses}-{r.pushes}
                  </span>
                  <span className="text-right font-mono text-[13px] font-black tabular-nums">
                    {r.points}
                  </span>
                  <span
                    className={cn(
                      'text-right font-mono text-[12px] font-bold tabular-nums',
                      Number(r.cover_points) > 0 && 'text-emerald-600 dark:text-emerald-300',
                      Number(r.cover_points) < 0 && 'text-rose-600 dark:text-rose-300',
                      tiedOnPts && 'underline decoration-dotted decoration-muted-foreground/50'
                    )}
                    title={tiedOnPts ? 'Cover settles this points tie' : undefined}
                  >
                    {formatCoverPoints(Number(r.cover_points))}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
