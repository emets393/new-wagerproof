import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { sportsbookFallbackUrl } from '../sections/cfb/FootballTeamTrends';
import {
  formatAmerican,
  isQuoteFromSelection,
  preferredQuote,
  type SportsbookMarketQuotes,
  type SportsbookQuote,
} from './quotes';

function SportsbookMark({
  bookKey,
  bookName,
}: {
  bookKey: string;
  bookName: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const src = sportsbookFallbackUrl(bookKey, bookName);
  const letter = (bookName || bookKey || 'B').trim().charAt(0).toUpperCase() || 'B';
  if (failed || !src) {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded bg-foreground text-[9px] font-black text-background">
        {letter}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={bookName}
      className="h-4 w-4 rounded object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function chipLabel(selectedBookKeys: Set<string>, fromSelection: boolean): string {
  if (selectedBookKeys.size === 0) return 'BEST LINE';
  if (fromSelection) return selectedBookKeys.size === 1 ? 'YOUR BOOK' : 'YOUR BOOKS';
  return 'NOT AT YOUR BOOKS';
}

function priceLabel(quote: SportsbookQuote, formatLine: (line: number) => string): string {
  const line = quote.line == null ? null : formatLine(quote.line);
  const price = quote.price == null ? null : formatAmerican(quote.price);
  return [line, price].filter(Boolean).join('  ');
}

function capturedLabel(capturedAt: string | null): string {
  if (!capturedAt) return 'Confirm the number at the book before betting.';
  const ms = Date.parse(capturedAt);
  if (!Number.isFinite(ms)) return 'Confirm the number at the book before betting.';
  const delta = Date.now() - ms;
  const minutes = Math.round(delta / 60000);
  let rel: string;
  if (minutes < 1) rel = 'just now';
  else if (minutes < 60) rel = `${minutes} min ago`;
  else if (minutes < 60 * 24) rel = `${Math.round(minutes / 60)} hr ago`;
  else rel = `${Math.round(minutes / (60 * 24))} days ago`;
  return `Lines captured ${rel}. Confirm at the book before betting.`;
}

/**
 * The sportsbook a card is quoting. Tap opens the full board.
 *
 * Port of iOS `BestBookChip` / `SportsbookLinesSheet`.
 */
export function BestBookChip({
  quotes,
  selectedBookKeys,
  marketTitle,
  selectionTitle,
  formatLine,
  className,
  compact = false,
}: {
  quotes: SportsbookMarketQuotes;
  selectedBookKeys: Set<string>;
  marketTitle: string;
  selectionTitle: string;
  formatLine: (line: number) => string;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const shown = preferredQuote(quotes, selectedBookKeys);
  if (!shown) return null;
  const fromSelection = isQuoteFromSelection(quotes, selectedBookKeys);
  const mine = quotes.quotes.filter((quote) => selectedBookKeys.has(quote.bookKey));
  const others = quotes.quotes.filter((quote) => !selectedBookKeys.has(quote.bookKey));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1.5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]',
          compact && 'gap-1 px-2 py-1',
          className,
        )}
      >
        <SportsbookMark bookKey={shown.bookKey} bookName={shown.bookName} />
        <span className="flex min-w-0 flex-col items-start leading-tight">
          {!compact && (
            <span className="text-[8px] font-black tracking-wide text-muted-foreground">
              {chipLabel(selectedBookKeys, fromSelection)}
            </span>
          )}
          <span className={cn('text-[13px] font-extrabold tabular-nums text-foreground', compact && 'text-[11px]')}>
            {priceLabel(shown, formatLine)}
          </span>
        </span>
        <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{marketTitle}</DialogTitle>
          </DialogHeader>
          {mine.length > 0 && (
            <BoardSection title="Your books" quotes={mine} all={quotes} selectedBookKeys={selectedBookKeys} formatLine={formatLine} />
          )}
          <BoardSection
            title={mine.length === 0 ? selectionTitle : 'Everywhere else'}
            quotes={others}
            all={quotes}
            selectedBookKeys={selectedBookKeys}
            formatLine={formatLine}
          />
          <p className="text-[11px] leading-4 text-muted-foreground">{capturedLabel(quotes.capturedAt)}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BoardSection({
  title,
  quotes,
  all,
  selectedBookKeys,
  formatLine,
}: {
  title: string;
  quotes: SportsbookQuote[];
  all: SportsbookMarketQuotes;
  selectedBookKeys: Set<string>;
  formatLine: (line: number) => string;
}) {
  if (quotes.length === 0) return null;
  const bestKey = all.quotes[0]?.bookKey;
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="divide-y divide-black/5 dark:divide-white/10">
        {quotes.map((quote) => {
          const isBest = quote.bookKey === bestKey;
          const isPinned = selectedBookKeys.has(quote.bookKey);
          return (
            <li key={quote.bookKey} className="flex items-center gap-3 py-2.5">
              <SportsbookMark bookKey={quote.bookKey} bookName={quote.bookName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{quote.bookName}</p>
                {(isPinned || isBest) && (
                  <p className="mt-0.5 flex gap-1.5 text-[8px] font-black tracking-wide">
                    {isPinned && <span className="text-sky-500">YOURS</span>}
                    {isBest && <span className="text-primary">BEST</span>}
                  </p>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                {quote.line != null && (
                  <span className={cn('text-[15px] font-extrabold tabular-nums', isBest ? 'text-primary' : 'text-foreground')}>
                    {formatLine(quote.line)}
                  </span>
                )}
                {quote.price != null && (
                  <span className="font-mono text-[13px] font-bold text-muted-foreground">
                    {formatAmerican(quote.price)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
