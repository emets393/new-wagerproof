import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ios';
import { CLUSTER_TIPS } from '../statTips';
import { StatTip } from './StatTip';

type WindowRec = { h: number; l?: number; n: number; p?: number; pct: number };
type SituationBucket = Record<string, WindowRec>;

const BUCKET_LABELS: Record<string, string> = {
  overall: 'Overall',
  home: 'Home',
  away: 'Away',
  division: 'Division',
  primetime: 'Primetime',
  regular: 'Regular',
};

/** Expandable situational records — render served windows only. */
export function SituationsDrawer({
  splits,
  marketKey,
}: {
  splits: unknown;
  marketKey: string;
}) {
  const [open, setOpen] = useState(false);
  const byMarket =
    splits && typeof splits === 'object'
      ? (splits as Record<string, Record<string, SituationBucket>>)[marketKey]
      : undefined;

  if (!byMarket) return null;

  const buckets = Object.entries(byMarket).filter(([k]) => BUCKET_LABELS[k]);

  return (
    <GlassCard radius={16} className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Situations
          <StatTip tip={CLUSTER_TIPS.situations} />
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-black/5 px-3 pb-3 pt-2.5 dark:border-white/10">
          {buckets.map(([key, windows]) => {
            const w5 = windows['5'] ?? windows['7'] ?? windows['3'];
            if (!w5) return null;
            return (
              <div key={key} className="flex items-center justify-between text-[13px]">
                <span className="font-semibold">{BUCKET_LABELS[key]}</span>
                <span className="font-mono text-muted-foreground">
                  {w5.h}/{w5.n}
                  {typeof w5.pct === 'number' ? ` · ${Math.round(w5.pct * 100)}%` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
