import { cn } from '@/lib/utils';
import type { PropMarket } from '../types';
import { formatLine } from '../format';

export function MarketToggle({
  markets,
  selectedKey,
  onSelect,
}: {
  markets: PropMarket[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {markets.map((m) => {
        const active = m.key === selectedKey;
        const pending = m.status !== 'posted' || m.line == null;
        const lineLabel = !pending && m.line != null ? ` ${formatLine(m.line)}` : '';
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onSelect(m.key)}
            className={cn(
              'relative flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-all duration-150',
              active
                ? 'border-primary/50 bg-primary/15 text-primary shadow-[0_0_18px_rgba(59,130,246,0.35)]'
                : 'border-black/5 bg-white/60 text-foreground backdrop-blur-xl hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]'
            )}
          >
            <span>
              {m.label}
              {lineLabel}
            </span>
            {pending && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                title="Line pending"
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    active ? 'bg-primary/70' : 'bg-muted-foreground/60'
                  )}
                />
                <span>pending</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
