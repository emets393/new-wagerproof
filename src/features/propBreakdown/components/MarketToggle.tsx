import { cn } from '@/lib/utils';
import type { PropMarket } from '../types';
import { formatLine } from '../format';
import { BestBookChip, formatSignedLine, type SportsbookMarketQuotes } from '@/features/games/detail/sportsbooks';

type MarketBoard = { over: SportsbookMarketQuotes; under: SportsbookMarketQuotes };

export function MarketToggle({
  markets,
  selectedKey,
  onSelect,
  boardsByMarket,
  selectedBookKeys,
}: {
  markets: PropMarket[];
  selectedKey: string;
  onSelect: (key: string) => void;
  boardsByMarket: Record<string, MarketBoard | null>;
  selectedBookKeys: Set<string>;
}) {
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      {markets.map((m) => {
        const active = m.key === selectedKey;
        const pending = m.status !== 'posted' || m.line == null;
        const board = boardsByMarket[m.key];
        return (
          <div
            key={m.key}
            className={cn(
              'flex min-w-[104px] flex-col items-center rounded-xl px-2 py-1.5 transition-colors',
              active ? 'bg-primary/[0.08]' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(m.key)}
              className={cn(
                'max-w-[150px] truncate px-1 pb-1 text-[12px] font-bold transition-colors',
                active ? 'text-primary' : 'text-foreground',
              )}
            >
              {m.label}
            </button>
            {board?.over.quotes.length ? (
              <BestBookChip
                quotes={board.over}
                selectedBookKeys={selectedBookKeys}
                marketTitle={m.label}
                selectionTitle={`Over ${m.label}`}
                formatLine={formatSignedLine}
                compact
                className="max-w-full"
              />
            ) : (
              <span className="inline-flex min-h-7 items-center rounded-full border border-black/[0.06] bg-white/50 px-2 text-[9px] font-bold uppercase tracking-wide text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
                {pending ? 'Line pending' : `Best ${formatLine(m.line!)}`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
