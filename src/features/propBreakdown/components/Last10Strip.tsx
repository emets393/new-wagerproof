import { cn } from '@/lib/utils';
import type { TrendGameLogEntry } from '../types';
import { CLUSTER_TIPS } from '../statTips';
import { GlassCard } from '@/components/ios';
import { StatTip } from './StatTip';

export function Last10Strip({
  log,
  marketKey,
  line,
}: {
  log: TrendGameLogEntry[] | null | undefined;
  marketKey: string;
  line?: number | null;
}) {
  const games = (log ?? []).slice(0, 10).slice().reverse();
  const hasAmounts = games.some((game) => Number.isFinite(game.actuals?.[marketKey]));
  const referenceLine = Number.isFinite(line) ? Number(line) : null;
  const actualValues = games
    .map((game) => game.actuals?.[marketKey])
    .filter((value): value is number => Number.isFinite(value));
  const hitCount = referenceLine === null
    ? 0
    : actualValues.filter((value) => value > referenceLine).length;
  const gradedCount = actualValues.length;
  const amountCeiling = hasAmounts
    ? Math.max(
        1,
        referenceLine ?? 0,
        ...games.map((game) => game.actuals?.[marketKey] ?? 0),
      ) * 1.14
    : 1;
  const linePosition = referenceLine === null
    ? null
    : Math.min(94, Math.max(4, (referenceLine / amountCeiling) * 100));

  if (games.length === 0) {
    return (
      <GlassCard radius={16} className="p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <span>Last 10</span>
          <StatTip tip={CLUSTER_TIPS.last10} />
        </div>
        <div className="flex min-h-[88px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-muted/20 text-[13px] text-muted-foreground dark:border-white/10">
          No recent game log yet
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard radius={16} className="min-w-0 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <span>Last {games.length}</span>
          <StatTip tip={CLUSTER_TIPS.last10} />
        </div>
        <span className="font-mono text-[11px] font-bold text-foreground">
          {hitCount}/{gradedCount} hits
        </span>
      </div>
      <div className="relative h-44">
        <div
          className="absolute inset-x-0 z-10 border-t border-dashed border-primary/70"
          style={{ bottom: linePosition !== null ? `calc(${linePosition}% + 20px)` : 'calc(48% + 20px)' }}
          aria-hidden
        />
        <span
          className="absolute right-0 z-10 -translate-y-full rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-bold text-primary"
          style={{ bottom: linePosition !== null ? `calc(${linePosition}% + 22px)` : 'calc(48% + 22px)' }}
        >
          {referenceLine !== null ? `Line ${referenceLine}` : 'Market line'}
        </span>
        <div className="flex h-full items-end gap-1.5 pt-5 sm:gap-2">
        {games.map((g) => {
          const actual = g.actuals?.[marketKey];
          const delta = Number.isFinite(actual) && referenceLine !== null
            ? Number(actual) - referenceLine
            : null;
          const amountHeight = Number.isFinite(actual)
            ? Math.max(3, (Number(actual) / amountCeiling) * 100)
            : 8;
          const amountTone = !Number.isFinite(actual) || referenceLine === null || Number(actual) === referenceLine
            ? { bar: 'bg-muted-foreground/40', text: 'text-muted-foreground' }
            : Number(actual) > referenceLine
              ? { bar: 'bg-emerald-500/90', text: 'text-emerald-600 dark:text-emerald-300' }
              : { bar: 'bg-rose-500/75', text: 'text-rose-600 dark:text-rose-300' };
          const tip = [
            `${g.season} wk${g.week}`,
            g.is_home ? 'Home' : 'Away',
            g.is_div ? 'Div' : null,
            g.is_primetime ? 'Primetime' : null,
            Number.isFinite(actual) ? `Actual ${actual}` : null,
            referenceLine !== null ? `Threshold ${referenceLine}` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <div
              key={`${g.season}-${g.week}-${g.opp}`}
              title={tip}
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            >
              <div className="mb-1 flex h-7 flex-col items-center justify-end leading-none">
                <span className={cn('text-[11px] font-black tabular-nums', amountTone.text)}>
                  {Number.isFinite(actual) ? actual : '—'}
                </span>
                {delta !== null ? (
                  <span className={cn('mt-1 text-[8px] font-bold tabular-nums', amountTone.text)}>
                    {delta > 0 ? '+' : ''}{Number.isInteger(delta) ? delta : delta.toFixed(1)}
                  </span>
                ) : null}
              </div>
              <div
                className={cn('w-full max-w-10 rounded-t-sm transition-all duration-200', amountTone.bar)}
                style={{ height: `${amountHeight}%` }}
              />
              <span className="mt-1 max-w-full truncate text-[9px] font-bold uppercase text-muted-foreground">{g.opp}</span>
            </div>
          );
        })}
        </div>
      </div>
      <p className="mt-2 text-center text-[9px] text-muted-foreground">
        {hasAmounts ? 'Bar label = actual · +/− vs today’s line · ' : ''}
        Oldest left → most recent right
      </p>
    </GlassCard>
  );
}
