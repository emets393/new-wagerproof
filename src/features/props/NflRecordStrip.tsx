import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  HISTORY_PAGE,
  formatAmerican,
  formatRoi,
  formatUnits,
  gradedHistory,
  summarizeLedger,
  type LedgerRow,
} from '@/features/nflTools/propMatchups/recordSheet';

function lineText(row: LedgerRow): string {
  if (row.line == null) return '\u2014';
  return Number.isInteger(row.line) ? String(row.line) : row.line.toFixed(1);
}

export function NflRecordStrip({ rows, isLoading }: { rows: LedgerRow[]; isLoading: boolean }) {
  const summary = summarizeLedger(rows);
  const history = gradedHistory(rows);
  const [open, setOpen] = React.useState(false);
  const [shown, setShown] = React.useState(HISTORY_PAGE);
  const record = summary.graded === 0 ? null : `${summary.wins}-${summary.losses}`;
  const rate = summary.winRate == null ? null : `${(summary.winRate * 100).toFixed(1)}%`;
  const units = summary.graded === 0 ? null : formatUnits(summary.units);
  const roi = formatRoi(summary.roi);

  return (
    <div className="border-b border-black/5 px-3 py-2 dark:border-white/10">
      {isLoading ? <p className="text-[12px] text-muted-foreground">Loading the record.</p> : (
        <>
          <p className="text-[12px] font-bold tabular-nums">
            {record ?? 'No graded picks yet'}
            {rate ? <span className="ml-2 text-muted-foreground">{rate}</span> : null}
            {units ? <span className="ml-2">{units} units</span> : null}
            {roi ? <span className="ml-2 text-muted-foreground">{roi} ROI</span> : null}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
            {summary.graded} graded · {summary.pending} pending
          </p>
          {summary.markets.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {summary.markets.map((market) => (
                <li key={market.label} className="flex justify-between gap-3 text-[11px] tabular-nums">
                  <span className="truncate font-semibold">{market.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {market.wins}-{market.losses}
                    {formatUnits(market.units) ? `  ${formatUnits(market.units)}u` : ''}
                    {formatRoi(market.roi) ? `  ${formatRoi(market.roi)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {history.length > 0 ? (
            <div className="mt-1">
              <button type="button" className="text-[11px] font-bold text-primary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
                {open ? 'Hide past picks' : 'Past picks'}
              </button>
              {open ? (
                <>
                  <ul className="mt-1 space-y-1">
                    {history.slice(0, shown).map((row) => {
                      const price = formatAmerican(row.price);
                      const unitsText = formatUnits(row.units);
                      return (
                        <li key={`${row.season}-${row.week}-${row.player_name}-${row.market_label}-${row.board_rank}`} className="text-[11px] leading-snug">
                          <span className="font-semibold">{row.player_name}</span>
                          <span className="text-muted-foreground">
                            {' · '}{row.market_label} · {row.side} · {lineText(row)}
                            {price ? ` · ${price}` : ''}
                            {row.book_name ? ` · ${row.book_name}` : ''}
                            {' · '}{row.result}
                            {row.actual_value != null ? ` · ${row.actual_value}` : ''}
                            {unitsText ? ` · ${unitsText}u` : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {shown < history.length ? (
                    <button type="button" className={cn('mt-1 text-[11px] font-bold text-primary')} onClick={() => setShown((count) => count + HISTORY_PAGE)}>
                      Load more
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
