import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  HISTORY_PAGE,
  formatAmerican,
  formatRoi,
  formatUnits,
  gradedHistory,
  summarizeLedger,
  type LedgerRow,
  type MarketRecord,
} from '@/features/nflTools/propMatchups/recordSheet';

function lineText(row: LedgerRow): string {
  if (row.line == null) return '';
  return Number.isInteger(row.line) ? String(row.line) : row.line.toFixed(1);
}

function moneyTone(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value === 0) return 'text-muted-foreground';
  return value > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300';
}

function rateTone(rate: number | null): string {
  if (rate == null) return 'text-muted-foreground';
  if (rate > 0.5) return 'text-emerald-600 dark:text-emerald-300';
  if (rate < 0.5) return 'text-red-600 dark:text-red-300';
  return 'text-foreground';
}

function marketEmoji(label: string): string {
  const text = label.toLowerCase();
  if (text.includes('touchdown') || text.includes(' td')) return '🏈';
  if (text.includes('pass')) return '🎯';
  if (text.includes('rush')) return '🏃';
  if (text.includes('receiv') || text.includes('reception') || text.includes('catch')) return '🙌';
  return '📌';
}

function resultMark(result: string | null): { emoji: string; label: string; tone: string } {
  const value = (result ?? '').toLowerCase();
  if (value === 'win') return { emoji: '✅', label: 'Win', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' };
  if (value === 'loss') return { emoji: '❌', label: 'Loss', tone: 'bg-red-500/15 text-red-700 dark:text-red-300' };
  return { emoji: '➖', label: 'Push', tone: 'bg-black/5 text-muted-foreground dark:bg-white/10' };
}

function Kpi({ emoji, label, value, sub, tone }: { emoji: string; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-muted/40 px-3 py-3 dark:border-white/10">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{emoji} {label}</p>
      <p className={cn('mt-1 text-[26px] font-black tabular-nums leading-none', tone)}>{value}</p>
      {sub ? <p className="mt-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function MarketTable({ markets }: { markets: MarketRecord[] }) {
  return (
    <div className="overflow-x-auto overflow-hidden rounded-2xl border border-black/5 dark:border-white/10">
      <table className="w-full min-w-[520px] text-[13px] tabular-nums">
        <thead className="bg-muted/40 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Market</th>
            <th className="px-3 py-2 text-right">W-L-P</th>
            <th className="px-3 py-2 text-right">Win rate</th>
            <th className="px-3 py-2 text-right">Units</th>
            <th className="px-3 py-2 text-right">ROI</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((market) => {
            const decided = market.wins + market.losses;
            const rate = decided > 0 ? market.wins / decided : null;
            return (
              <tr key={market.label} className="border-t border-black/5 dark:border-white/10">
                <td className="px-3 py-2 font-semibold">{marketEmoji(market.label)} {market.label}</td>
                <td className="px-3 py-2 text-right font-bold">
                  <span className="text-emerald-600 dark:text-emerald-300">{market.wins}</span>
                  <span className="text-muted-foreground">-</span>
                  <span className="text-red-600 dark:text-red-300">{market.losses}</span>
                  <span className="text-muted-foreground">-{market.pushes}</span>
                </td>
                <td className={cn('px-3 py-2 text-right font-bold', rateTone(rate))}>{rate == null ? '—' : `${(rate * 100).toFixed(1)}%`}</td>
                <td className={cn('px-3 py-2 text-right font-bold', moneyTone(market.units))}>{formatUnits(market.units) ?? '—'}</td>
                <td className={cn('px-3 py-2 text-right font-bold', moneyTone(market.roi))}>{formatRoi(market.roi) ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function NflRecordSheet({
  rows,
  isLoading,
  onClose,
}: {
  rows: LedgerRow[];
  isLoading: boolean;
  onClose: () => void;
}) {
  const summary = summarizeLedger(rows);
  const history = gradedHistory(rows);
  const [shown, setShown] = React.useState(HISTORY_PAGE);
  const record = summary.graded === 0 ? '—' : `${summary.wins}-${summary.losses}`;
  const rate = summary.winRate == null ? '—' : `${(summary.winRate * 100).toFixed(1)}%`;
  const units = summary.graded === 0 ? '—' : formatUnits(summary.units) ?? '—';
  const roi = formatRoi(summary.roi) ?? '—';
  const sheetTone = summary.units > 0
    ? 'border-emerald-500/30 bg-emerald-500/10'
    : summary.units < 0
      ? 'border-red-500/30 bg-red-500/10'
      : 'border-black/5 bg-muted/30 dark:border-white/10';

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const overlay = (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background text-foreground" role="dialog" aria-modal="true" aria-label="Spotlight record">
      <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="text-[17px] font-bold"><span aria-hidden>🏆 </span>Spotlight record</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close spotlight record"
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.06] text-foreground hover:bg-black/10 dark:bg-white/[0.08] dark:hover:bg-white/15"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? <p className="px-4 py-4 text-[13px] text-muted-foreground">⏳ Loading the record.</p> : (
          <div className="space-y-4 px-4 py-4">
            <div className={cn('rounded-2xl border px-4 py-4', sheetTone)}>
              <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">🏆 Season record</p>
              <p className={cn('mt-1 text-[40px] font-black leading-none tabular-nums', moneyTone(summary.graded === 0 ? null : summary.units))}>{record}</p>
              <p className="mt-2 text-[13px] font-semibold text-muted-foreground">
                {summary.graded} graded · {summary.pending} pending
                {summary.pushes > 0 ? ` · ${summary.pushes} push${summary.pushes === 1 ? '' : 'es'}` : ''}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi emoji="🎯" label="Win rate" value={rate} sub="Wins and losses" tone={rateTone(summary.winRate)} />
              <Kpi emoji="💰" label="Units" value={units} sub="Push counts as 0" tone={moneyTone(summary.graded === 0 ? null : summary.units)} />
              <Kpi emoji="📈" label="ROI" value={roi} sub="Units ÷ graded" tone={moneyTone(summary.roi)} />
              <Kpi emoji="🗂️" label="Graded" value={String(summary.graded)} sub={`${summary.pending} still out`} />
            </div>
            {summary.markets.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-[15px] font-bold">📊 By market</h3>
                <MarketTable markets={summary.markets} />
              </section>
            ) : null}
            <section className="space-y-2">
              <h3 className="text-[15px] font-bold">🗂️ Past picks</h3>
              {history.length === 0 ? (
                <p className="rounded-2xl border border-black/5 px-4 py-8 text-center text-[13px] text-muted-foreground dark:border-white/10">No graded picks yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.slice(0, shown).map((row) => {
                    const mark = resultMark(row.result);
                    const price = formatAmerican(row.price);
                    const unitsText = formatUnits(row.units);
                    const number = lineText(row);
                    return (
                      <li key={`${row.season}-${row.week}-${row.player_name}-${row.market_label}-${row.board_rank}`} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
                        <span aria-hidden className="text-[18px] leading-none">{mark.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-bold">{row.player_name}</div>
                          <div className="truncate text-[12px] font-semibold text-muted-foreground">
                            {marketEmoji(row.market_label)} Week {row.week} · {row.market_label} {row.side}{number ? ` ${number}` : ''}
                          </div>
                          <div className="truncate text-[11px] font-semibold text-muted-foreground">
                            {price ?? 'No price'}
                            {row.book_name ? ` · ${row.book_name}` : ''}
                            {row.actual_value != null ? ` · finished ${row.actual_value}` : ''}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold', mark.tone)}>{mark.label}</span>
                          <div className={cn('mt-1 text-[13px] font-black tabular-nums', moneyTone(row.units))}>{unitsText ? `${unitsText}u` : '—'}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {shown < history.length ? (
                <button type="button" className="h-9 rounded-full border border-black/10 px-4 text-[13px] font-bold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10" onClick={() => setShown((count) => count + HISTORY_PAGE)}>
                  Load more
                </button>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined' || !document.body) return overlay;
  return createPortal(overlay, document.body);
}
