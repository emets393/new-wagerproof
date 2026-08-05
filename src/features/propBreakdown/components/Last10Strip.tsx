import { cn } from '@/lib/utils';
import type { TrendGameLogEntry } from '../types';
import { CLUSTER_TIPS } from '../statTips';
import { GlassCard } from '@/components/ios';
import { StatTip } from './StatTip';

function resultTone(raw: string | undefined): {
  bg: string;
  label: string;
} {
  if (!raw) return { bg: 'bg-muted text-muted-foreground', label: '—' };
  const v = raw.toUpperCase();
  if (v === 'O' || v === 'Y') return { bg: 'bg-emerald-500/90 text-white', label: v };
  if (v === 'U' || v === 'N') return { bg: 'bg-rose-500/90 text-white', label: v };
  if (v === 'P') return { bg: 'bg-muted text-muted-foreground', label: 'P' };
  return { bg: 'bg-muted text-muted-foreground', label: v };
}

export function Last10Strip({
  log,
  marketKey,
}: {
  log: TrendGameLogEntry[] | null | undefined;
  marketKey: string;
}) {
  const games = (log ?? []).slice(0, 10).slice().reverse();

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
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        <span>Last {games.length}</span>
        <StatTip tip={CLUSTER_TIPS.last10} />
      </div>
      <div className="flex min-h-[88px] flex-wrap content-center gap-2">
        {games.map((g) => {
          const raw = g.markets?.[marketKey];
          const tone = resultTone(raw);
          const tip = [
            `${g.season} wk${g.week}`,
            g.is_home ? 'Home' : 'Away',
            g.is_div ? 'Div' : null,
            g.is_primetime ? 'Primetime' : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <div
              key={`${g.season}-${g.week}-${g.opp}`}
              title={tip}
              className="flex w-9 flex-col items-center gap-1"
            >
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg text-[12px] font-bold',
                  tone.bg
                )}
              >
                {tone.label}
              </div>
              <span className="text-[9px] font-bold uppercase text-muted-foreground">{g.opp}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
