import { cn } from '@/lib/utils';
import type { CompLeaderboardRow } from '../types';
import { formatCoverPoints } from '../format';

/** Compact season standings chip for the competition page header. */
export function MyRecordStrip({
  row,
  practice,
}: {
  row: CompLeaderboardRow | null | undefined;
  /** Practice week — season totals stay 0 until Week 1. */
  practice?: boolean;
}) {
  const wins = row?.wins ?? 0;
  const losses = row?.losses ?? 0;
  const pushes = row?.pushes ?? 0;
  const points = row?.points ?? 0;
  const cover = row != null ? Number(row.cover_points) : 0;

  return (
    <div
      className="flex flex-nowrap items-stretch gap-1 sm:gap-2"
      title={
        practice
          ? 'Season record starts in Week 1 — practice does not count'
          : undefined
      }
    >
      <StatChip label="Record" value={`${wins}-${losses}-${pushes}`} />
      <StatChip label="Pts" value={String(points)} emphasize />
      <StatChip
        label="Cover"
        value={formatCoverPoints(cover)}
        className={cn(
          cover > 0 && 'text-emerald-700 dark:text-emerald-300',
          cover < 0 && 'text-rose-700 dark:text-rose-300'
        )}
      />
    </div>
  );
}

function StatChip({
  label,
  value,
  emphasize,
  className,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  className?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-black/5 bg-white/60 px-2 py-1 dark:border-white/10 dark:bg-white/[0.06] sm:min-w-[4.5rem] sm:rounded-2xl sm:px-3 sm:py-1.5">
      <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-[9px]">
        {label}
      </div>
      <div
        className={cn(
          'mt-0.5 font-mono text-[12px] font-black leading-none tabular-nums sm:text-[15px]',
          emphasize && 'text-amber-800 dark:text-amber-200',
          className
        )}
      >
        {value}
      </div>
    </div>
  );
}
