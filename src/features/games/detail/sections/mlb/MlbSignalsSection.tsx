import * as React from 'react';
import { Chip, Pagination } from '@heroui/react';
import { Activity } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import {
  combineSignalsOrdered,
  signalsRowForGamePk,
  type MLBGameSignalsRow,
  type MLBPredictionRow,
  type MLBSignalItem,
} from '../../../api/mlbGames';
import { isOfficialDateToday, SignalCategoryIcon } from './shared';

/** Signals shown at once. Also the reserved row count, so paging can't jump the layout. */
const ROWS_PER_PAGE = 4;

/** Severity → HeroUI Chip tone. 'over'/'under' mirror the totals color language. */
const SEVERITY_TONE: Record<string, 'success' | 'warning' | 'primary' | 'default'> = {
  positive: 'success',
  negative: 'warning',
  over: 'success',
  under: 'primary',
};

/** Left accent bar per severity — carries the tone without tinting the whole row. */
const SEVERITY_ACCENT: Record<string, string> = {
  positive: 'bg-emerald-500',
  negative: 'bg-orange-500',
  over: 'bg-amber-500',
  under: 'bg-blue-500',
};

function SignalRow({ signal }: { signal: MLBSignalItem }) {
  const tone = SEVERITY_TONE[signal.severity] ?? 'default';
  const accent = SEVERITY_ACCENT[signal.severity] ?? 'bg-muted-foreground/40';

  return (
    <div className="flex items-stretch gap-2.5 overflow-hidden rounded-lg border border-black/5 bg-black/[0.02] pr-2.5 dark:border-white/10 dark:bg-white/[0.03]">
      <span className={cn('w-1 shrink-0', accent)} aria-hidden />
      <span className="flex shrink-0 items-center py-2 text-muted-foreground">
        <SignalCategoryIcon category={signal.category} />
      </span>
      <span className="min-w-0 flex-1 self-center py-2 text-[11px] leading-snug text-foreground">
        {signal.message}
      </span>
      {tone !== 'default' && (
        <span className="flex shrink-0 items-center">
          <Chip
            size="sm"
            variant="flat"
            color={tone}
            classNames={{ base: 'h-5', content: 'px-1.5 text-[9px] font-bold uppercase' }}
          >
            {signal.severity}
          </Chip>
        </span>
      )}
    </div>
  );
}

/**
 * Supplemental betting signals from mlb_game_signals (game-level first, then
 * home, then away). Only rendered for games whose official_date is today in ET,
 * since signals are refreshed for the current slate.
 *
 * A fixed 4-row window with HeroUI Pagination, replacing the old horizontal pill
 * scroller: signal text is a full sentence, so pills forced either truncation or
 * a very wide rail, and horizontally-scrolled content gave no sense of how much
 * was left to read.
 */
export function MlbSignalsSection({
  raw,
  signalsByGamePk,
}: {
  raw: MLBPredictionRow;
  signalsByGamePk: Map<string, MLBGameSignalsRow>;
}) {
  const [page, setPage] = React.useState(1);

  const isToday = isOfficialDateToday(raw.official_date);
  // Hooks must run before the early return, so this stays above it and simply
  // yields [] when the game isn't on today's slate.
  const allSignals = React.useMemo(
    () => (isToday ? combineSignalsOrdered(signalsRowForGamePk(signalsByGamePk, raw.game_pk)) : []),
    [isToday, signalsByGamePk, raw.game_pk],
  );

  const pageCount = Math.max(1, Math.ceil(allSignals.length / ROWS_PER_PAGE));
  // A refresh can shrink the list out from under the current page.
  const activePage = Math.min(page, pageCount);
  const visible = allSignals.slice((activePage - 1) * ROWS_PER_PAGE, activePage * ROWS_PER_PAGE);

  if (!isToday) return null;

  return (
    <WidgetCard
      icon={<Activity />}
      title="Game Signals"
      subtitle="Situational notes the model flagged for this matchup — context the projections don't capture."
      accessory={
        allSignals.length > 0 ? (
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            {allSignals.length} signal{allSignals.length === 1 ? '' : 's'}
          </span>
        ) : undefined
      }
    >
      {allSignals.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            {visible.map((sig, i) => (
              <SignalRow
                key={`${raw.game_pk}-sig-${(activePage - 1) * ROWS_PER_PAGE + i}`}
                signal={sig}
              />
            ))}
            {/* Hold the full 4-row height on a short last page so the pager stays
                put instead of sliding up as you tab through. */}
            {Array.from({ length: ROWS_PER_PAGE - visible.length }).map((_, i) => (
              <div key={`pad-${i}`} className="h-[2.5rem]" aria-hidden />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex justify-center pt-0.5">
              <Pagination
                total={pageCount}
                page={activePage}
                onChange={setPage}
                size="sm"
                radius="md"
                variant="light"
                showControls
                aria-label="Game signals pages"
              />
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-black/5 bg-black/[0.03] px-3 py-2.5 text-left text-[11px] leading-relaxed text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
          No supplemental betting signals for this matchup right now. Your projections and edges
          above are the same full model outputs—this block only adds extra situational or trend
          context when our system surfaces it.
        </p>
      )}
    </WidgetCard>
  );
}
